// src/app/api/strava/upload/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';
import { getValidStravaToken } from '@/lib/strava-token';
import { checkRateLimit } from '@/lib/rate-limit';
import { getAdminDb } from '@/lib/firebase-admin';
import axios from 'axios';
import type { WorkoutSession, ProgramType, Workout, RunningWorkout } from '@/models/types';
import { generateStravaDescription } from '@/ai/flows/strava-description';


// Helper function to safely convert Firestore timestamp to Date.
// Returns null (and logs a warning) for missing or unrecognisable values so
// callers can surface a proper error rather than silently using the wrong date.
function toDate(timestamp: any): Date | null {
  if (!timestamp) return null;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate() as Date;
  if (typeof timestamp === 'string') {
    const d = new Date(timestamp);
    if (!isNaN(d.getTime())) return d;
    console.warn('toDate: invalid timestamp string', timestamp);
    return null;
  }
  if (typeof timestamp === 'number') return new Date(timestamp);
  console.warn('toDate: unrecognised timestamp format', typeof timestamp, timestamp);
  return null;
}

// Map your app's activity types to Strava activity types
function mapActivityTypeToStrava(programType: ProgramType): string {
    if (programType === 'running') {
        return 'Run';
    }
    return 'WeightTraining';
}


export async function POST(req: NextRequest) {
  try {
    console.log('=== STRAVA UPLOAD API START ===');
    
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    // Authenticate user
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
    const userId = decodedToken.uid;
    console.log('Authenticated user:', userId);

    // 5 uploads per minute per user
    const rl = checkRateLimit(`strava-upload:${userId}`, 60_000, 5);
    if (!rl.allowed) {
        return NextResponse.json({ error: 'Too many upload requests. Please wait before trying again.' }, {
            status: 429,
            headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
        });
    }

    let accessToken: string;
    try {
      accessToken = await getValidStravaToken(userId);
    } catch (tokenErr: any) {
      if (tokenErr.code === 'STRAVA_NOT_CONNECTED') {
        return NextResponse.json({ error: 'Strava account not connected.' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Strava connection expired. Please reconnect your account.' }, { status: 401 });
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

    // Generate AI Description for Strava
    let aiDescription = `Workout from HYBRIDX.CLUB.\n\nNotes:\n${session.notes || 'No notes.'}`;
    if (session.workoutDetails) {
        try {
            const exercises = session.programType === 'running' 
                ? (session.workoutDetails as RunningWorkout).runs 
                : (session.workoutDetails as Workout).exercises;
            
            const descriptionResult = await generateStravaDescription({
                workoutTitle: session.workoutTitle,
                workoutType: session.programType,
                exercises: JSON.stringify(exercises),
                userNotes: session.notes,
            });
            aiDescription = descriptionResult.description;
            console.log('Generated AI description for Strava:', aiDescription);
        } catch (aiError) {
            console.error('Failed to generate AI description, using fallback:', aiError);
            // Fallback to the original description if AI fails
        }
    }


    const startDate = toDate(session.startedAt);
    if (!startDate) {
      console.error('Invalid or missing startedAt timestamp for session:', sessionId);
      return NextResponse.json({ error: 'Workout session has an invalid start time and cannot be uploaded.' }, { status: 400 });
    }

    // Create the activity on Strava
    const estimatedDuration = 3600; // Strava requires a time, default to 1 hour
    const stravaActivityPayload = {
      name: session.workoutTitle,
      type: mapActivityTypeToStrava(session.programType),
      start_date_local: startDate.toISOString(),
      elapsed_time: estimatedDuration,
      description: aiDescription,
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
