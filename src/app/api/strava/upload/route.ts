// src/app/api/strava/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { getUser, updateUserAdmin } from '@/services/user-service';
import { getAdminDb } from '@/lib/firebase-admin';
import axios from 'axios';
import type { StravaTokens, WorkoutSession } from '@/models/types';
import { differenceInSeconds } from 'date-fns';

// Helper function to safely convert Firestore timestamp to Date
function toDate(timestamp: any): Date {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp === 'string') return new Date(timestamp);
  if (typeof timestamp === 'number') return new Date(timestamp);
  return new Date();
}

// Map your app's activity types to Strava activity types
function mapActivityTypeToStrava(title: string): string {
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('run') || lowerTitle.includes('running')) return 'Run';
    if (lowerTitle.includes('cycle') || lowerTitle.includes('bike')) return 'Ride';
    if (lowerTitle.includes('swim')) return 'Swim';
    if (lowerTitle.includes('row')) return 'Rowing';
    if (lowerTitle.includes('strength')) return 'WeightTraining';
    if (lowerTitle.includes('crossfit')) return 'CrossFit';
    if (lowerTitle.includes('hiit')) return 'Workout';
    if (lowerTitle.includes('cardio')) return 'Workout';
    if (lowerTitle.includes('yoga')) return 'Yoga';
    if (lowerTitle.includes('pilates')) return 'Pilates';
    if (lowerTitle.includes('walk')) return 'Walk';
    if (lowerTitle.includes('hike')) return 'Hike';
    return 'Workout';
}

export async function POST(req: NextRequest) {
  try {
    console.log('=== STRAVA UPLOAD API START ===');
    
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Authenticate user
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;
    console.log('Authenticated user:', userId);

    // Get user's Strava tokens
    const user = await getUser(userId);
    const stravaTokens = user?.strava;

    if (!stravaTokens?.accessToken) {
      return NextResponse.json({ error: 'Strava not connected' }, { status: 400 });
    }

    // Check if token needs refresh
    const now = new Date();
    let accessToken = stravaTokens.accessToken;
    const expiresAt = toDate(stravaTokens.expiresAt);
    
    if (expiresAt.getTime() - now.getTime() < 300000) {
      console.log('Token expiring soon, refreshing...');
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
      } catch (refreshError: any) {
        console.error('Token refresh failed:', refreshError.response?.data);
        return NextResponse.json({ error: 'Token refresh failed' }, { status: 401 });
      }
    }

    // Fetch workout session from your database
    const adminDb = getAdminDb();
    const sessionDoc = await adminDb.collection('workoutSessions').doc(sessionId).get();

    if (!sessionDoc.exists || sessionDoc.data()?.userId !== userId) {
      return NextResponse.json({ error: 'Workout session not found or access denied' }, { status: 404 });
    }

    const session = sessionDoc.data() as WorkoutSession;
    
    if (session?.uploadedToStrava) {
      return NextResponse.json({ 
        error: 'Activity already uploaded to Strava',
        stravaId: session.stravaId 
      }, { status: 400 });
    }

    if (!session.finishedAt) {
        return NextResponse.json({ error: 'Cannot upload an incomplete workout' }, { status: 400 });
    }

    // Convert your session format to Strava format
    const duration = differenceInSeconds(toDate(session.finishedAt), toDate(session.startedAt));
    
    const stravaActivity = {
      name: session.workoutTitle,
      type: mapActivityTypeToStrava(session.workoutTitle),
      start_date_local: toDate(session.startedAt).toISOString(),
      elapsed_time: duration,
      description: `Workout from HYBRIDX.CLUB.\n\nNotes:\n${session.notes || 'No notes.'}`,
      trainer: true, // Assume indoor workout unless specified otherwise
      commute: false
    };

    console.log('Uploading activity to Strava:', stravaActivity);

    // Upload to Strava
    const stravaResponse = await axios.post(
      'https://www.strava.com/api/v3/activities',
      stravaActivity,
      {
        headers: { 
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const stravaActivityId = stravaResponse.data.id;
    console.log('Successfully uploaded to Strava:', stravaActivityId);

    // Update session doc with Strava ID
    await sessionDoc.ref.update({
        stravaId: stravaActivityId.toString(),
        uploadedToStrava: true,
        stravaUploadedAt: new Date()
    });

    return NextResponse.json({ 
      success: true, 
      stravaActivityId,
      stravaUrl: `https://www.strava.com/activities/${stravaActivityId}`
    });

  } catch (error: any) {
    console.error('Strava upload error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });

    if (error.response?.status === 401) {
      return NextResponse.json({ error: 'Strava authorization expired' }, { status: 401 });
    } else if (error.response?.status === 422) {
      return NextResponse.json({ 
        error: 'Invalid activity data', 
        details: error.response.data 
      }, { status: 422 });
    } else {
      return NextResponse.json({ 
        error: 'Failed to upload to Strava',
        details: error.response?.data?.message || error.message
      }, { status: 500 });
    }
  }
}
