// src/app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { getValidStravaToken } from '@/lib/strava-token';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;

    // 20 requests per minute per user
    const rl = checkRateLimit(`strava-activities:${userId}`, 60_000, 20);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many requests. Please wait before syncing again.' }, {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
        });
    }

    let accessToken: string;
    try {
      accessToken = await getValidStravaToken(userId);
    } catch (tokenErr: any) {
      if (tokenErr.code === 'STRAVA_NOT_CONNECTED') {
        return NextResponse.json({ error: 'Strava account not connected. Please connect it in your profile.' }, { status: 400 });
      }
      // STRAVA_REFRESH_FAILED — token expired/revoked, user must reconnect
      return NextResponse.json({ error: 'Strava connection expired. Please reconnect your account.' }, { status: 401 });
    }

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') ?? '1', 10));
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 30, page },
    });

    const activities = activitiesResponse.data;
    if (page === 1) await updateUserAdmin(userId, { lastStravaSync: new Date() });

    return NextResponse.json({ activities, hasMore: activities.length === 30 });

  } catch (error: any) {
    let status = 500;
    let message = 'Failed to fetch activities from Strava.';
    
    if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
            status = 401;
            message = 'Strava authorization expired. Please reconnect your account.';
        } else if (error.response?.status) {
            status = error.response.status;
            message = error.response.data?.message || message;
        }
    } else if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/argument-error') {
        status = 401;
        message = 'Your session has expired. Please log in again.';
    }

    logger.error('Strava activities fetch error:', { message: error.message, code: error.code });
    return NextResponse.json({ error: message }, { status });
  }
}
