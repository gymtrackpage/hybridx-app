// src/app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

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

    const user = await getUser(userId);
    if (!user) {
        console.error(`❌ User data not found in Firestore for UID: ${userId}`);
        return NextResponse.json({ error: 'User data not found.' }, { status: 404 });
    }
    
    const stravaTokens = user?.strava;
    if (!stravaTokens?.accessToken || !stravaTokens.refreshToken) {
      console.error('❌ No Strava tokens found for user:', userId);
      return NextResponse.json({ error: 'Strava account not connected. Please connect it in your profile.' }, { status: 400 });
    }

    let accessToken = stravaTokens.accessToken;
    const now = new Date();
    
    if (stravaTokens.expiresAt instanceof Date && stravaTokens.expiresAt.getTime() < now.getTime() + 300000) { // 5 min buffer
      console.log(`🔄 Strava token for user ${userId} is expiring soon, refreshing...`);
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
        console.log(`✅ Strava token for user ${userId} refreshed successfully`);
      } catch (refreshError: any) {
        console.error(`❌ Strava token refresh failed for user ${userId}:`, refreshError.response?.data || refreshError.message);
        return NextResponse.json({ error: 'Strava connection expired. Please reconnect your account.' }, { status: 401 });
      }
    } else {
      console.log(`✅ Strava token for user ${userId} is still valid.`);
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
