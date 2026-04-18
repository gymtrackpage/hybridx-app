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

  // sport:"RUNNING" works. Step objects are parsed as null — test step field formats.
  const seg = (workoutSteps: any[]) => ({
    workoutSegments: [{ segmentOrder: 1, workoutSteps }],
  });

  const payloadVariants = [
    {
      // All string-enum step fields + stepId
      label: 'string-enums+stepId',
      payload: {
        workoutName: 'HybridX A', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{
          stepId: 0, stepOrder: 1,
          stepType: 'INTERVAL',
          durationType: 'TIME', durationValue: 1800,
          targetType: 'NO_TARGET',
        }]),
      },
    },
    {
      // Object enums + stepId (Garmin Connect web-app format)
      label: 'object-enums+stepId',
      payload: {
        workoutName: 'HybridX B', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{
          stepId: 0, stepOrder: 1,
          stepType: { stepTypeId: 4, stepTypeKey: 'interval' },
          durationType: { durationTypeId: 1, durationTypeKey: 'time' },
          durationValue: 1800,
          targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
        }]),
      },
    },
    {
      // String enums, no stepId
      label: 'string-enums-no-stepId',
      payload: {
        workoutName: 'HybridX C', sport: 'RUNNING', estimatedDurationInSecs: 1800,
        ...seg([{
          stepOrder: 1,
          stepType: 'INTERVAL',
          durationType: 'TIME', durationValue: 1800,
          targetType: 'NO_TARGET',
        }]),
      },
    },
    {
      // Minimal: only required-looking fields
      label: 'minimal-step',
      payload: {
        workoutName: 'HybridX D', sport: 'RUNNING',
        ...seg([{
          stepId: 0, stepOrder: 1,
          stepType: 'INTERVAL',
          durationType: 'OPEN',
          targetType: 'NO_TARGET',
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
