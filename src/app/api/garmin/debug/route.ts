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

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('__session')?.value;
  if (!sessionCookie) return NextResponse.json({ error: 'Not logged in' }, { status: 401 });

  const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
  const accessToken = await getValidGarminToken(decoded.uid);

  // sport:"RUNNING" works. Now test with type discriminant restored (Jackson polymorphism).
  const seg = (workoutSteps: any[]) => ({
    workoutSegments: [{ segmentOrder: 1, workoutSteps }],
  });

  const payloadVariants = [
    {
      // THE KEY TEST: sport=RUNNING (fixed) + type discriminant + object enums
      label: 'RUNNING+ExecutableStepDTO+object-enums',
      payload: {
        workoutName: 'HybridX A', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{
          type: 'ExecutableStepDTO',
          stepId: 0, stepOrder: 1,
          stepType: { stepTypeId: 4, stepTypeKey: 'interval' },
          durationType: { durationTypeId: 1, durationTypeKey: 'time' },
          durationValue: 1800,
          targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
        }]),
      },
    },
    {
      // type discriminant + string enums
      label: 'RUNNING+ExecutableStepDTO+string-enums',
      payload: {
        workoutName: 'HybridX B', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{
          type: 'ExecutableStepDTO',
          stepId: 0, stepOrder: 1,
          stepType: 'INTERVAL',
          durationType: 'TIME', durationValue: 1800,
          targetType: 'NO_TARGET',
        }]),
      },
    },
    {
      // RepeatGroupDTO wrapping a step — test group format at same time
      label: 'RUNNING+RepeatGroupDTO',
      payload: {
        workoutName: 'HybridX C', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{
          type: 'RepeatGroupDTO',
          stepId: 0, stepOrder: 1,
          numberOfIterations: 3,
          workoutSteps: [{
            type: 'ExecutableStepDTO',
            stepId: 0, stepOrder: 2,
            stepType: { stepTypeId: 4, stepTypeKey: 'interval' },
            durationType: { durationTypeId: 2, durationTypeKey: 'distance' },
            durationValue: 1000,
            targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
          }],
        }]),
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
