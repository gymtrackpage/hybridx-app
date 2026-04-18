// src/app/api/garmin/debug/route.ts
// Temporary diagnostic endpoint — sends test workouts to Garmin to confirm format.
// DELETE THIS FILE once repeat groups and STRENGTH_TRAINING sport are confirmed.
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

  // Confirmed working: sport="RUNNING", flat steps[], type="WorkoutStep", intensity field.
  // This round validates repeat groups and STRENGTH_TRAINING sport type.
  const payloadVariants = [
    {
      label: 'repeat-group+RUNNING',
      payload: {
        workoutName: 'HybridX Intervals',
        sport: 'RUNNING',
        estimatedDurationInSecs: 2700,
        steps: [
          { type: 'WorkoutStep', stepOrder: 1, intensity: 'WARMUP', durationType: 'TIME', durationValue: 600, targetType: 'OPEN' },
          {
            type: 'WorkoutRepeatStep', stepOrder: 2,
            repeatType: 'REPEAT_UNTIL_STEPS_CMPLT', repeatValue: 4,
            steps: [
              { type: 'WorkoutStep', stepOrder: 1, intensity: 'INTERVAL', durationType: 'DISTANCE', durationValue: 1000, targetType: 'OPEN' },
              { type: 'WorkoutStep', stepOrder: 2, intensity: 'RECOVERY', durationType: 'TIME', durationValue: 90, targetType: 'OPEN' },
            ],
          },
          { type: 'WorkoutStep', stepOrder: 3, intensity: 'COOLDOWN', durationType: 'TIME', durationValue: 300, targetType: 'OPEN' },
        ],
      },
    },
    {
      label: 'strength-workout+STRENGTH_TRAINING',
      payload: {
        workoutName: 'HybridX Strength',
        sport: 'STRENGTH_TRAINING',
        steps: [
          {
            type: 'WorkoutRepeatStep', stepOrder: 1,
            repeatType: 'REPEAT_UNTIL_STEPS_CMPLT', repeatValue: 3,
            steps: [
              { type: 'WorkoutStep', stepOrder: 1, intensity: 'ACTIVE', description: 'Squats — 8 reps', durationType: 'REPS', durationValue: 8, targetType: 'OPEN' },
              { type: 'WorkoutStep', stepOrder: 2, intensity: 'REST', durationType: 'OPEN', targetType: 'OPEN' },
            ],
          },
        ],
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
