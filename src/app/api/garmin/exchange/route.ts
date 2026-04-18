// src/app/api/garmin/exchange/route.ts
// OAuth callback. Exchanges the authorization code + PKCE verifier for
// tokens, stores them on the user doc, and redirects back to /profile.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { GARMIN_TOKEN_URL } from '@/lib/garmin/oauth';
import { fetchGarminUserId } from '@/lib/garmin/training-api';
import { logger } from '@/lib/logger';
import type { GarminTokens } from '@/models/types';
import { FieldValue } from 'firebase-admin/firestore';

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const back = (params: Record<string, string>) =>
    NextResponse.redirect(
      new URL(
        `/profile?${new URLSearchParams(params).toString()}`,
        appUrl,
      ),
    );

  if (error) {
    logger.error('Garmin authorization error:', error);
    return back({ 'garmin-error': error });
  }
  if (!code || !state) {
    return back({ 'garmin-error': 'missing-params' });
  }

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      throw new Error(
        'Your session expired during the Garmin connection. Please log in and try again.',
      );
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(userId);
    const userSnap = await userRef.get();
    const pending = userSnap.data()?.pendingGarminAuth;

    if (!pending?.codeVerifier || !pending?.state) {
      throw new Error(
        'No pending Garmin authorization found. Please start the connection again from your profile.',
      );
    }
    if (pending.state !== state) {
      throw new Error('State mismatch (CSRF protection). Please try again.');
    }
    if (typeof pending.expiresAt === 'number' && Date.now() > pending.expiresAt) {
      throw new Error(
        'OAuth state expired. Please start the Garmin connection again.',
      );
    }

    const clientId = process.env.GARMIN_CLIENT_ID;
    const clientSecret = process.env.GARMIN_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Garmin client credentials missing on server.');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: pending.codeVerifier,
      redirect_uri: `${appUrl}/api/garmin/exchange`,
    });

    const tokenRes = await axios.post(GARMIN_TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = tokenRes.data;
    if (!data.access_token) throw new Error('Invalid token response from Garmin.');

    const now = Date.now();
    const tokens: GarminTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(now + (data.expires_in ?? 3600) * 1000),
      refreshExpiresAt: data.refresh_token_expires_in
        ? new Date(now + data.refresh_token_expires_in * 1000)
        : undefined,
      scope: data.scope,
      tokenType: data.token_type,
    };

    // Best-effort: fetch the Garmin user UUID so webhooks can resolve user.
    try {
      const garminUserId = await fetchGarminUserId(tokens.accessToken);
      if (garminUserId) tokens.garminUserId = garminUserId;
    } catch (e: any) {
      logger.warn('Garmin user-id fetch failed (continuing):', e.message);
    }

    await userRef.update({
      garmin: tokens,
      garminConnectedAt: new Date(),
      pendingGarminAuth: FieldValue.delete(),
    });

    return back({ garmin: 'success' });
  } catch (err: any) {
    logger.error('Garmin token exchange failed:', {
      message: err.message,
      response: err.response?.data,
    });
    const msg =
      err.response?.data?.error_description ||
      err.response?.data?.error ||
      err.message ||
      'Failed to connect Garmin.';
    return back({ 'garmin-error': msg });
  }
}
