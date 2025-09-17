// src/app/api/strava/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { getUser, updateUserAdmin } from '@/services/user-service';
import { getAdminDb } from '@/lib/firebase-admin';
import axios from 'axios';
import type { StravaTokens, WorkoutSession, ProgramType } from '@/models/types';

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
function mapActivityTypeToStrava(programType: ProgramType): string {
    if (programType === 'running') {
        return 'Run';
    }
    return 'WeightTraining';
}

async function getValidAccessToken(userId: string): Promise<string> {
    const user = await getUser(userId);
    const stravaTokens = user?.strava;

    if (!stravaTokens?.accessToken) {
        throw new Error('Strava not connected');
    }

    const now = new Date();
    const expiresAt = toDate(stravaTokens.expiresAt);
    
    if (expiresAt.getTime() - now.getTime() < 300000) { // 5 min buffer
        console.log('Token expiring soon, refreshing...');
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
        return newTokens.accessToken;
    }
    return stravaTokens.accessToken;
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

    const accessToken = await getValidAccessToken(userId).catch(err => {
        console.error('Token validation failed:', err.message);
        throw err;
    });

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

    // Create the activity on Strava
    const estimatedDuration = 3600; // Strava requires a time, default to 1 hour
    const stravaActivityPayload = {
      name: session.workoutTitle,
      type: mapActivityTypeToStrava(session.programType),
      start_date_local: toDate(session.startedAt).toISOString(),
      elapsed_time: estimatedDuration,
      description: `Workout from HYBRIDX.CLUB.\n\nNotes:\n${session.notes || 'No notes.'}`,
      trainer: true,
      commute: false
    };

    console.log('Uploading activity to Strava:', stravaActivityPayload);
    const stravaResponse = await axios.post(
      'https://www.strava.com/api/v3/activities',
      stravaActivityPayload,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    const stravaActivityId = stravaResponse.data.id;
    console.log('Successfully created Strava activity:', stravaActivityId);
    
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
    } else {
      return NextResponse.json({ 
        error: 'Failed to upload to Strava',
        details: error.response?.data?.message || error.message
      }, { status: 500 });
    }
  }
}
