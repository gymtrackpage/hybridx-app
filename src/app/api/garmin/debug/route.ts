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
  const seg = (workoutSteps: any[]) => ({
    workoutSegments: [{ segmentOrder: 1, workoutSteps }],
  });

  const step = {
    stepOrder: 1,
    stepType: { stepTypeId: 4, stepTypeKey: 'interval' },
    durationType: { durationTypeId: 1, durationTypeKey: 'time' },
    durationValue: 1800,
    targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
  };

  const payloadVariants = [
    {
      // No type discriminant at all — let Garmin infer from other fields
      label: 'no-type-discriminant',
      payload: {
        workoutName: 'HybridX A', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{ ...step, stepOrder: 1 }]),
      },
    },
    {
      // @type (with @ sign) — some Jackson configs use this property name
      label: '@type-discriminant',
      payload: {
        workoutName: 'HybridX B', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{ '@type': 'ExecutableStepDTO', ...step }]),
      },
    },
    {
      // workoutSteps at top level (not inside workoutSegments) — some API versions flatten this
      label: 'top-level-workoutSteps-no-segments',
      payload: {
        workoutName: 'HybridX C', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        workoutSteps: [{ type: 'ExecutableStepDTO', ...step }],
      },
    },
    {
      // stepId: 1 (not 0) — Garmin may require non-zero stepId for deserialization
      label: 'ExecutableStepDTO+stepId-1',
      payload: {
        workoutName: 'HybridX D', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{ type: 'ExecutableStepDTO', stepId: 1, ...step }]),
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
