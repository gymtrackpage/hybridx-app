// src/app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  console.log('=== STRAVA ACTIVITIES API START ===');
  
  try {
    const cookieStore = cookies();
    console.log('All cookies:', cookieStore.getAll());
    const sessionCookie = cookieStore.get('__session')?.value;
    
    if (!sessionCookie) {
      console.error('❌ NO SESSION COOKIE in API route');
      return NextResponse.json({ error: 'Authentication required: No session cookie found.' }, { status: 401 });
    }

    let decodedToken;
    const adminAuth = getAdminAuth();
    try {
      decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
    } catch (verifyError: any) {
      console.error('❌ Session verification failed:', verifyError.message);
      return NextResponse.json({ error: 'Invalid session. Please log in again.' }, { status: 401 });
    }

    const userId = decodedToken.uid;
    console.log('🔐 Authenticated user:', userId);

    const user = await getUser(userId);
    const stravaTokens = user?.strava;

    if (!stravaTokens?.accessToken) {
      console.error('No Strava tokens found for user:', userId);
      return NextResponse.json({ error: 'Strava account not connected.' }, { status: 400 });
    }

    const now = new Date();
    let accessToken = stravaTokens.accessToken;

    if (stravaTokens.expiresAt && stravaTokens.expiresAt.getTime() - now.getTime() < 300000) { // 5-min buffer
      console.log('🔄 Token expiring soon, refreshing...');
      try {
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
        console.log('✅ Token refreshed successfully');
        
      } catch (refreshError: any) {
        console.error('❌ Token refresh failed:', refreshError.response?.data);
        // If refresh fails, connection might be invalid. Log out user.
        return NextResponse.json({ error: 'Strava connection expired. Please reconnect your account.' }, { status: 401 });
      }
    }

    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { Authorization: `Bearer ${accessToken}` },
      params: { per_page: 30, page: 1 },
    });

    const activities = activitiesResponse.data;
    console.log(`✅ Successfully fetched ${activities.length} activities from Strava`);
    await updateUserAdmin(userId, { lastStravaSync: new Date() });

    return NextResponse.json(activities);

  } catch (error: any) {
    console.error('❌ Strava activities API error:', error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Failed to fetch activities from Strava.';
    return NextResponse.json({ error: message }, { status });
  }
}
