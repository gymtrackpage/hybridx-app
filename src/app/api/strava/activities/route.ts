// src/app/api/strava/activities/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { getUser, updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';

export async function GET(req: NextRequest) {
  console.log('=== STRAVA ACTIVITIES API START ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  console.log('Request headers:', Object.fromEntries(req.headers.entries()));
  
  try {
    // Enhanced cookie debugging
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    console.log('All cookies received:', allCookies.map(c => ({
      name: c.name,
      value: c.value.substring(0, 30) + '...',
      length: c.value.length
    })));
    
    const sessionCookie = cookieStore.get('__session')?.value;
    console.log('Session cookie details:', {
      exists: !!sessionCookie,
      length: sessionCookie?.length || 0,
      firstChars: sessionCookie?.substring(0, 50) + '...'
    });
    
    if (!sessionCookie) {
      console.error('❌ NO SESSION COOKIE in API route');
      console.log('Available cookies:', allCookies.map(c => c.name));
      return NextResponse.json({ 
        error: 'Authentication required',
        debug: {
          cookiesReceived: allCookies.length,
          cookieNames: allCookies.map(c => c.name),
          sessionCookieExists: false,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    // Try to verify session with detailed error info
    let decodedToken;
    try {
      console.log('🔍 Attempting to verify session cookie...');
      decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
      console.log('✅ Session verified successfully:', {
        uid: decodedToken.uid,
        email: decodedToken.email,
        iat: new Date(decodedToken.iat * 1000).toISOString(),
        exp: new Date(decodedToken.exp * 1000).toISOString()
      });
    } catch (verifyError: any) {
      console.error('❌ Session verification failed:', {
        code: verifyError.code,
        message: verifyError.message,
        errorInfo: verifyError.errorInfo
      });
      return NextResponse.json({ 
        error: 'Invalid session',
        debug: {
          verificationError: verifyError.code,
          message: verifyError.message,
          cookieLength: sessionCookie.length,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    const userId = decodedToken.uid;
    console.log('🔐 Authenticated user:', userId);

    // Get user's Strava tokens
    console.log('📚 Fetching user from database...');
    const user = await getUser(userId);
    const stravaTokens = user?.strava;

    if (!stravaTokens?.accessToken) {
      console.error('No Strava tokens found for user:', userId);
      console.log('User strava object:', user?.strava);
      return NextResponse.json({ 
        error: 'Strava not connected',
        debug: {
          userId,
          hasStravaObject: !!user?.strava,
          hasAccessToken: !!stravaTokens?.accessToken
        }
      }, { status: 400 });
    }

    console.log('✅ Found Strava tokens:', {
      athleteId: stravaTokens.athleteId,
      hasAccessToken: !!stravaTokens.accessToken,
      hasRefreshToken: !!stravaTokens.refreshToken,
      expiresAt: stravaTokens.expiresAt?.toISOString(),
      scope: stravaTokens.scope
    });

    // Check if token needs refresh
    const now = new Date();
    let accessToken = stravaTokens.accessToken;

    if (stravaTokens.expiresAt && stravaTokens.expiresAt.getTime() - now.getTime() < 300000) {
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
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
      }
    } else {
      console.log('✅ Token is still valid');
    }

    // Fetch activities from Strava
    console.log('🚀 Fetching activities from Strava API...');
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
    console.log(`✅ Successfully fetched ${activities.length} activities from Strava`);

    // Update last sync time
    await updateUserAdmin(userId, { lastStravaSync: new Date() });

    return NextResponse.json(activities);

  } catch (error: any) {
    console.error('❌ Strava activities API error:', {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3),
      response: error.response?.data,
      status: error.response?.status
    });

    if (error.response?.status === 401) {
      return NextResponse.json({ error: 'Strava authorization expired' }, { status: 401 });
    } else if (error.response?.status === 429) {
      return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
    } else {
      return NextResponse.json({ 
        error: 'Failed to fetch activities',
        debug: {
          errorType: error.name,
          message: error.message
        }
      }, { status: 500 });
    }
  }
}
