// src/app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
  console.log('=== STRAVA ACTIVITIES API START ===');
  console.log('Request URL:', req.url);
  console.log('User-Agent:', req.headers.get('user-agent'));
  
  try {
    // Debug all headers and cookies
    console.log('Request headers (selected):', {
      'content-type': req.headers.get('content-type'),
      'cookie': req.headers.get('cookie')?.substring(0, 100) + '...',
      'origin': req.headers.get('origin'),
      'referer': req.headers.get('referer')
    });
    
    const cookieStore = cookies();
    const allCookies = cookieStore.getAll();
    console.log('All cookies received:', allCookies.map(c => ({
      name: c.name,
      valueLength: c.value.length,
      preview: c.value.substring(0, 20) + '...'
    })));
    
    // Try both cookie names (primary and fallback)
    let sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      sessionCookie = cookieStore.get('__session_fallback')?.value;
      console.log('Primary session cookie not found, trying fallback...');
    }
    
    console.log('Session cookie details:', {
      exists: !!sessionCookie,
      length: sessionCookie?.length || 0,
      source: sessionCookie ? (cookieStore.get('__session') ? 'primary' : 'fallback') : 'none'
    });
    
    if (!sessionCookie) {
      console.error('❌ NO SESSION COOKIE in API route');
      console.log('Available cookie names:', allCookies.map(c => c.name));
      
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

    // Verify session cookie
    let decodedToken;
    try {
      console.log('🔍 Verifying session cookie...');
      const adminAuth = getAdminAuth();
      decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
      console.log('✅ Session verified for user:', decodedToken.uid);
    } catch (verifyError: any) {
      console.error('❌ Session verification failed:', {
        code: verifyError.code,
        message: verifyError.message,
        cookieLength: sessionCookie.length
      });
      return NextResponse.json({ 
        error: 'Invalid session. Please log in again.',
        debug: {
          verificationError: verifyError.code,
          message: verifyError.message
        }
      }, { status: 401 });
    }

    const userId = decodedToken.uid;
    console.log('🔐 Authenticated user:', userId);

    // Get user and Strava tokens
    console.log('📚 Fetching user from database...');
    const user = await getUser(userId);
    const stravaTokens = user?.strava;

    console.log('User strava data:', {
      hasStravaObject: !!user?.strava,
      hasAccessToken: !!stravaTokens?.accessToken,
      athleteId: stravaTokens?.athleteId,
      expiresAt: stravaTokens?.expiresAt?.toISOString()
    });

    if (!stravaTokens?.accessToken) {
      console.error('❌ No Strava tokens found for user:', userId);
      return NextResponse.json({ 
        error: 'Strava account not connected. Please connect your Strava account in your profile.',
        debug: {
          userId,
          hasUser: !!user,
          hasStravaObject: !!user?.strava
        }
      }, { status: 400 });
    }

    // Check and refresh token if needed
    const now = new Date();
    let accessToken = stravaTokens.accessToken;

    if (stravaTokens.expiresAt && stravaTokens.expiresAt.getTime() - now.getTime() < 300000) {
      console.log('🔄 Token expiring soon, refreshing...');
      
      if (!process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID || !process.env.STRAVA_CLIENT_SECRET) {
        console.error('❌ Missing Strava environment variables');
        return NextResponse.json({ 
          error: 'Server configuration error: Missing Strava credentials' 
        }, { status: 500 });
      }

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
        console.error('❌ Token refresh failed:', {
          status: refreshError.response?.status,
          data: refreshError.response?.data,
          message: refreshError.message
        });
        return NextResponse.json({ 
          error: 'Strava connection expired. Please reconnect your account in your profile.' 
        }, { status: 401 });
      }
    } else {
      console.log('✅ Token is still valid');
    }

    // Fetch activities from Strava
    console.log('🚀 Fetching activities from Strava API...');
    
    if (!accessToken) {
      console.error('❌ No access token available');
      return NextResponse.json({ error: 'No valid Strava access token' }, { status: 401 });
    }

    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'HybridX/1.0'
      },
      params: { per_page: 30, page: 1 },
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
      status: error.response?.status,
      code: error.code
    });

    // Return appropriate error response
    if (error.response?.status === 401) {
      return NextResponse.json({ 
        error: 'Strava authorization expired. Please reconnect your account.' 
      }, { status: 401 });
    } else if (error.response?.status === 429) {
      return NextResponse.json({ 
        error: 'Rate limit exceeded. Please try again later.' 
      }, { status: 429 });
    } else if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND') {
      return NextResponse.json({ 
        error: 'Network error connecting to Strava. Please try again.' 
      }, { status: 503 });
    } else {
      return NextResponse.json({ 
        error: 'Failed to fetch activities from Strava.',
        debug: {
          errorType: error.name,
          message: error.message
        }
      }, { status: 500 });
    }
  }
}
