// src/app/api/strava/activities/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateUserAdmin } from '@/services/user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
  console.log('=== ENHANCED DEBUG STRAVA ACTIVITIES API START ===');
  console.log('Request URL:', req.url);
  console.log('Request method:', req.method);
  
  try {
    // Debug ALL headers
    console.log('🔍 ALL REQUEST HEADERS:');
    req.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'authorization') {
        console.log(`  ${key}: Bearer ${value.substring(7, 27)}...`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    });

    // Check for Authorization header specifically
    const authHeader = req.headers.get('authorization');
    console.log('🎫 Authorization header details:', {
      exists: !!authHeader,
      format: authHeader ? (authHeader.startsWith('Bearer ') ? 'correct' : 'invalid format') : 'missing',
      length: authHeader?.length || 0
    });
    
    if (!authHeader) {
      console.error('❌ No Authorization header found');
      console.log('🔍 Available headers:', Array.from(req.headers.keys()));
      return NextResponse.json({ 
        error: 'Authentication required: No Authorization header found.',
        debug: {
          availableHeaders: Array.from(req.headers.keys()),
          authHeaderExists: false,
          requestMethod: req.method,
          requestUrl: req.url,
          timestamp: new Date().toISOString()
        }
      }, { status: 401 });
    }

    if (!authHeader.startsWith('Bearer ')) {
      console.error('❌ Authorization header has wrong format:', authHeader.substring(0, 20));
      return NextResponse.json({ 
        error: 'Authentication required: Invalid Authorization header format.',
        debug: {
          authHeaderFormat: authHeader.substring(0, 20) + '...',
          expectedFormat: 'Bearer {token}'
        }
      }, { status: 401 });
    }

    // Extract ID token from Authorization header
    const idToken = authHeader.replace('Bearer ', '');
    console.log('🎫 ID token extracted:', {
      length: idToken.length,
      preview: idToken.substring(0, 20) + '...'
    });

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
        message: verifyError.message,
        tokenLength: idToken.length
      });
      return NextResponse.json({ 
        error: 'Invalid authentication token. Please log in again.',
        debug: {
          verificationError: verifyError.code,
          message: verifyError.message,
          tokenLength: idToken.length
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
