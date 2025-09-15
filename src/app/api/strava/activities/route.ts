// src/app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  console.log('=== COOKIELESS STRAVA ACTIVITIES API START ===');
  
  try {
    // Skip cookie authentication entirely - use Authorization header instead
    const authHeader = req.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No Authorization header found');
      return NextResponse.json({ 
        error: 'Authentication required: No Authorization header found.',
        debug: {
          hasAuthHeader: !!authHeader,
          authHeaderFormat: authHeader ? 'present but invalid format' : 'missing'
        }
      }, { status: 401 });
    }

    // Extract ID token from Authorization header
    const idToken = authHeader.replace('Bearer ', '');
    console.log('🎫 ID token received via header, length:', idToken.length);

    // Verify ID token directly with Firebase Admin
    let decodedToken;
    try {
      console.log('🔍 Verifying ID token directly...');
      const adminAuth = getAdminAuth();
      decodedToken = await adminAuth.verifyIdToken(idToken, true);
      console.log('✅ ID token verified for user:', decodedToken.uid);
    } catch (verifyError: any) {
      console.error('❌ ID token verification failed:', {
        code: verifyError.code,
        message: verifyError.message
      });
      return NextResponse.json({ 
        error: 'Invalid authentication token. Please log in again.',
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

    // Check and refresh Strava token if needed
    const now = new Date();
    let accessToken = stravaTokens.accessToken;

    if (stravaTokens.expiresAt && stravaTokens.expiresAt.getTime() - now.getTime() < 300000) {
      console.log('🔄 Strava token expiring soon, refreshing...');
      
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
        console.log('✅ Strava token refreshed successfully');
        
      } catch (refreshError: any) {
        console.error('❌ Strava token refresh failed:', {
          status: refreshError.response?.status,
          data: refreshError.response?.data,
          message: refreshError.message
        });
        return NextResponse.json({ 
          error: 'Strava connection expired. Please reconnect your account in your profile.' 
        }, { status: 401 });
      }
    } else {
      console.log('✅ Strava token is still valid');
    }

    // Fetch activities from Strava API using OAuth Bearer token
    console.log('🚀 Fetching activities from Strava API...');
    
    if (!accessToken) {
      console.error('❌ No Strava access token available');
      return NextResponse.json({ error: 'No valid Strava access token' }, { status: 401 });
    }

    // This is the standard Strava API call with Bearer token authentication
    const activitiesResponse = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
      headers: { 
        Authorization: `Bearer ${accessToken}`,  // Strava's OAuth Bearer token
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
