// src/app/api/garmin/connect/route.ts
// Initiates a Garmin OAuth 2.0 + PKCE flow. Stores the code_verifier and
// state nonce in a single-use field on the user doc so /exchange can
// recover it after the redirect.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import {
  buildAuthorizeUrl,
  generatePkceChallenge,
  generatePkceVerifier,
  generateState,
} from '@/lib/garmin/oauth';
import { logger } from '@/lib/logger';
import type { PendingGarminAuth } from '@/models/types';

const PENDING_AUTH_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 },
      );
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;

    const clientId = process.env.GARMIN_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!clientId || !appUrl) {
      throw new Error('Garmin integration is not configured on the server.');
    }

    const codeVerifier = generatePkceVerifier();
    const codeChallenge = generatePkceChallenge(codeVerifier);
    const state = generateState();
    const redirectUri = `${appUrl}/api/garmin/exchange`;

    const pending: PendingGarminAuth = {
      codeVerifier,
      state,
      expiresAt: Date.now() + PENDING_AUTH_TTL_MS,
    };

    // Store verifier server-side keyed by uid; deleted on exchange.
    await getAdminDb().collection('users').doc(userId).update({
      pendingGarminAuth: pending,
    });

    const authUrl = buildAuthorizeUrl({
      clientId,
      redirectUri,
      codeChallenge,
      state,
      scope: process.env.GARMIN_SCOPES, // optional, partner-defined
    });

    return NextResponse.json({ url: authUrl });
  } catch (err: any) {
    logger.error('Garmin connect error:', err.message);
    if (
      err.code === 'auth/session-cookie-expired' ||
      err.code === 'auth/session-cookie-revoked'
    ) {
      return NextResponse.json(
        { error: 'Your session has expired. Please log in again.' },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: err.message || 'Failed to initiate Garmin connection.' },
      { status: 500 },
    );
  }
}
