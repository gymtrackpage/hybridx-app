{// src/app/api/strava/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { getUser, updateUserAdmin } from '@/services/user-service';
import { getAdminDb } from '@/lib/firebase-admin';
import axios from 'axios';
import type { StravaTokens, WorkoutSession } from '@/models/types';
import { differenceInSeconds } from 'date-fns';
import FormData from 'form-data';

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

    // 1. Create the activity on Strava
    const duration = differenceInSeconds(toDate(session.finishedAt), toDate(session.startedAt));
    const stravaActivityPayload = {
      name: session.workoutTitle,
      type: mapActivityTypeToStrava(session.workoutTitle),
      start_date_local: toDate(session.startedAt).toISOString(),
      elapsed_time: duration,
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

    // 2. Generate the branded image
    console.log('Generating workout image...');
    const imageResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/generate-workout-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: session.workoutTitle,
            type: mapActivityTypeToStrava(session.workoutTitle),
            duration: duration,
            date: toDate(session.startedAt).toISOString(),
        }),
    });

    if (!imageResponse.ok) {
        console.error('Failed to generate workout image, but activity was created.');
    } else {
        const imageBuffer = await imageResponse.arrayBuffer();
        console.log(`Generated image, size: ${imageBuffer.byteLength} bytes.`);
        
        // 3. Upload the image as a photo to the new activity
        const formData = new FormData();
        formData.append('file', Buffer.from(imageBuffer), {
            contentType: 'image/png',
            filename: `hybridx_workout_${sessionId}.png`,
        });

        console.log('Uploading photo to Strava activity:', stravaActivityId);
        await axios.post(
            `https://www.strava.com/api/v3/uploads`,
            formData,
            { 
                headers: { 
                    ...formData.getHeaders(),
                    'Authorization': `Bearer ${accessToken}` 
                },
                params: {
                    activity_id: stravaActivityId,
                    data_type: 'png'
                }
            }
        );
        console.log('Photo upload process initiated for activity:', stravaActivityId);
    }
    
    // 4. Update session doc with Strava ID
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
