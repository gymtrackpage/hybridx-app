// src/app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { getValidStravaToken } from '@/lib/strava-token';
import { checkRateLimit } from '@/lib/rate-limit';

export async function GET(req: NextRequest) {
  console.log('=== ENHANCED DEBUG STRAVA ACTIVITIES API START ===');
  
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;

    if (!sessionCookie) {
      const allCookies = cookieStore.getAll();
      console.error('❌ No session cookie found in API route');
      return NextResponse.json({ 
        error: 'Authentication required: No session cookie found.',
        debug: {
          cookiesReceived: allCookies.length,
          cookieNames: allCookies.map(c => c.name),
          hasRawCookieHeader: !!req.headers.get('cookie'),
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;
    console.log('✅ Session cookie verified for user:', userId);

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

    console.log(`🚀 Fetching activities from Strava API for user ${userId}...`);
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 30, page: 1 },
    });

    const activities = activitiesResponse.data;
    console.log(`✅ Successfully fetched ${activities.length} activities from Strava for user ${userId}`);
    await updateUserAdmin(userId, { lastStravaSync: new Date() });

    return NextResponse.json(activities);

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

    console.error('❌ Final catch block in Strava activities API:', {
      message: error.message,
      code: error.code,
      axios_response: error.response?.data
    });
    
    return NextResponse.json({ error: message, debug: error.message }, { status });
  }
}
