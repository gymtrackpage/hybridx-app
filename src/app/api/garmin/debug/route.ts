// src/app/api/garmin/debug/route.ts
// Temporary diagnostic endpoint — sends a minimal test workout to Garmin
// and returns the raw response/error so we can see exactly what Garmin expects.
// DELETE THIS FILE once the payload format is confirmed working.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getValidGarminToken } from '@/lib/garmin/token';
import axios from 'axios';
import { GARMIN_API_BASE } from '@/lib/garmin/oauth';

export async function GET(_req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
  const accessToken = await getValidGarminToken(decoded.uid);

  // sport:"RUNNING" works. Now test with type discriminant restored (Jackson polymorphism).
// Research shows the Connect/Partner API uses a flat "steps" array (no workoutSegments),
  // type="WorkoutStep", intensity field, and lowercase sportType string.
  const payloadVariants = [
    {
      // PRIMARY TEST: flat steps array, WorkoutStep type, intensity, lowercase sportType
      label: 'flat-steps+WorkoutStep+intensity+sportType-lc',
      payload: {
        workoutName: 'HybridX A',
        sportType: 'running',
        estimatedDurationInSecs: 1800,
        steps: [{
          type: 'WorkoutStep',
          stepId: 1, stepOrder: 1,
          intensity: 'INTERVAL',
          durationType: 'TIME',
          durationValue: 1800,
          targetType: 'OPEN',
        }],
      },
    },
    {
      // Variant: sport:"RUNNING" (uppercase) + flat steps + WorkoutStep
      label: 'flat-steps+WorkoutStep+sport-UC',
      payload: {
        workoutName: 'HybridX B',
        sport: 'RUNNING',
        estimatedDurationInSecs: 1800,
        steps: [{
          type: 'WorkoutStep',
          stepId: 1, stepOrder: 1,
          intensity: 'INTERVAL',
          durationType: 'TIME',
          durationValue: 1800,
          targetType: 'OPEN',
        }],
      },
    },
    {
      // Variant: workoutSegments with "steps" key (not workoutSteps) + WorkoutStep
      label: 'segments+steps-key+WorkoutStep',
      payload: {
        workoutName: 'HybridX C',
        sportType: 'running',
        estimatedDurationInSecs: 1800,
        workoutSegments: [{
          segmentOrder: 1,
          steps: [{
            type: 'WorkoutStep',
            stepId: 1, stepOrder: 1,
            intensity: 'INTERVAL',
            durationType: 'TIME',
            durationValue: 1800,
            targetType: 'OPEN',
          }],
        }],
      },
    },
  ];

  const results: any[] = [];

  for (const { label, payload } of payloadVariants) {
    try {
      const res = await axios.post(
        `${GARMIN_API_BASE}/training-api/workout`,
        payload,
        { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } },
      );
      results.push({ label, status: res.status, data: res.data });
      // Clean up the test workout immediately
      const workoutId = res.data?.workoutId ?? res.data?.id;
      if (workoutId) {
        try {
          await axios.delete(`${GARMIN_API_BASE}/training-api/workout/${workoutId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
        } catch { /* ignore cleanup failure */ }
      }
    } catch (e: any) {
      results.push({
        label,
        status: e.response?.status,
        error: e.response?.data,
        message: e.message,
        sentPayload: payload,
      });
    }
  }

  return NextResponse.json({ results });
}
