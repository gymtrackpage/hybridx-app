// src/app/api/strava/activities/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { getUser, updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';

export async function GET(req: NextRequest) {
  try {
    console.log('=== STRAVA ACTIVITIES API START ===');
    
    // Authenticate user
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    
    if (!sessionCookie) {
      console.error('No session cookie found');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;
    console.log('Authenticated user:', userId);

    // Get user's Strava tokens
    const user = await getUser(userId);
    const stravaTokens = user?.strava;

    if (!stravaTokens?.accessToken) {
      console.error('No Strava tokens found for user');
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
    }

    console.log('Found Strava tokens for athlete:', stravaTokens.athleteId);

    // Check if token needs refresh
    const now = new Date();
    let accessToken = stravaTokens.accessToken;

    if (stravaTokens.expiresAt && stravaTokens.expiresAt.getTime() - now.getTime() < 300000) {
      console.log('Token expiring soon, refreshing...');
      
      try {
        const refreshResponse = await axios.post('https://www.strava.com/oauth/token', {
          client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
          client_secret: process.env.STRAVA_CLIENT_SECRET,
          grant_type: 'refresh_token',
          refresh_token: stravaTokens.refreshToken,
        });

        const newTokens: StravaTokens = {
          ...stravaTokens, // Retain existing properties
          accessToken: refreshResponse.data.access_token,
          refreshToken: refreshResponse.data.refresh_token,
          expiresAt: new Date(refreshResponse.data.expires_at * 1000),
        };

        await updateUserAdmin(userId, { strava: newTokens });
        accessToken = newTokens.accessToken;
        console.log('Token refreshed successfully');
        
      } catch (refreshError: any) {
        console.error('Token refresh failed:', refreshError.response?.data);
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
      }
    }

    // Fetch activities from Strava
    console.log('Fetching activities from Strava API...');
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'HybridX/1.0'
      },
      params: {
        per_page: 30,
        page: 1,
      },
      timeout: 15000
    });

    const activities = activitiesResponse.data;
    console.log(`Fetched ${activities.length} activities`);

    // Update last sync time
    await updateUserAdmin(userId, { lastStravaSync: new Date() });

    return NextResponse.json(activities);

  } catch (error: any) {
    console.error('Strava activities API error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    if (error.response?.status === 401) {
      return NextResponse.json({ error: 'Strava authorization expired' }, { status: 401 });
    } else if (error.response?.status === 429) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    } else {
      return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
    }
  }
}