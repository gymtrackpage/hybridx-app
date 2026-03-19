// src/app/api/strava/training-summary/route.ts
// Returns computed training load metrics (ATL, CTL, TSB, activity breakdown)
// by fetching the athlete's recent Strava activities and processing them through
// the training-load-service.

import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserAdmin } from '@/services/user-service';
import { computeTrainingSummary } from '@/services/training-load-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

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

    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const stravaTokens = user?.strava;
    if (!stravaTokens?.accessToken || !stravaTokens.refreshToken) {
      return NextResponse.json({ error: 'Strava account not connected.' }, { status: 400 });
    }

    // Refresh token if needed
    let accessToken = stravaTokens.accessToken;
    const now = new Date();
    if (
      stravaTokens.expiresAt instanceof Date &&
      stravaTokens.expiresAt.getTime() < now.getTime() + 300000
    ) {
      const refreshResponse = await axios.post('https://www.strava.com/oauth/token', {
        client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: stravaTokens.refreshToken,
      });

      const newTokens: StravaTokens = {
        ...stravaTokens,
        accessToken: refreshResponse.data.access_token,
        refreshToken: refreshResponse.data.refresh_token,
        expiresAt: new Date(refreshResponse.data.expires_at * 1000),
      };

      await updateUserAdmin(userId, { strava: newTokens });
      accessToken = newTokens.accessToken;
    }

    // Fetch enough activities to cover the 42-day CTL window.
    // Two pages of 50 gives us 100 activities — plenty for most athletes.
    const [page1, page2] = await Promise.all([
      axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { per_page: 50, page: 1 },
      }),
      axios.get('https://www.strava.com/api/v3/athlete/activities', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { per_page: 50, page: 2 },
      }),
    ]);

    const activities = [...page1.data, ...page2.data];
    const summary = computeTrainingSummary(activities);

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error('Training summary API error:', error.message);
    let status = 500;
    let message = 'Failed to compute training summary.';

    if (axios.isAxiosError(error)) {
      status = error.response?.status ?? 500;
      message = error.response?.data?.message || message;
    } else if (error.code === 'auth/session-cookie-expired') {
      status = 401;
      message = 'Session expired. Please log in again.';
    }

    return NextResponse.json({ error: message }, { status });
  }
}
