// src/app/api/garmin/sync-plan/route.ts
// Pushes the user's planned workouts for the next ~14 days to Garmin and
// schedules each one to its calendar date. Mapper output is deterministic
// so this is safe to call repeatedly — existing days are recreated.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { getValidGarminToken } from '@/lib/garmin/token';
import { checkRateLimit } from '@/lib/rate-limit';
import { workoutToDay } from '@/lib/garmin/program-adapter';
import { mapWorkoutDay } from '@/lib/garmin/workout-mapper';
import {
  createWorkout,
  deleteWorkout,
  scheduleWorkout,
} from '@/lib/garmin/training-api';
import { getUser } from '@/services/user-service';
import { getProgram } from '@/services/program-service';
import { logger } from '@/lib/logger';
import type { GarminPlanSync } from '@/models/types';

const DEFAULT_HORIZON_DAYS = 14;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;

    const rl = checkRateLimit(`garmin-sync:${userId}`, 60_000, 3);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many sync requests. Please wait.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
        },
      );
    }

    const body = await req.json().catch(() => ({}));
    const horizon: number = Number(body?.horizonDays) || DEFAULT_HORIZON_DAYS;

    let accessToken: string;
    try {
      accessToken = await getValidGarminToken(userId);
    } catch (e: any) {
      if (e.code === 'GARMIN_NOT_CONNECTED') {
        return NextResponse.json(
          { error: 'Garmin account not connected.' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: 'Garmin connection expired. Please reconnect.' },
        { status: 401 },
      );
    }

    const user = await getUser(userId);
    if (!user?.programId || !user?.startDate) {
      return NextResponse.json(
        { error: 'No active program with a start date — cannot map calendar dates.' },
        { status: 400 },
      );
    }
    const program = await getProgram(user.programId);
    if (!program) {
      return NextResponse.json({ error: 'Program not found.' }, { status: 404 });
    }

    // Compute today's day-number in the program (1-indexed).
    // Snap startDate to UTC midnight of the intended calendar day — the browser
    // stores local midnight (e.g. April 19 00:00 AEST = April 18 14:00 UTC) so
    // the raw timestamp is off by the user's UTC offset. Math.round to the
    // nearest day boundary recovers the correct date for any ±14h timezone.
    const startMs = Math.round(user.startDate.getTime() / 86400000) * 86400000;
    const today = new Date();
    const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
    const todayDayNum = Math.floor((todayMs - startMs) / 86400000) + 1;

    const fromDay = Math.max(1, todayDayNum);
    const toDay = todayDayNum + horizon;
    const targetWorkouts = program.workouts.filter(
      (w) => w.day >= fromDay && w.day < toDay,
    );

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(userId);
    const prevSync: GarminPlanSync | undefined = user.garminPlanSync;

    // If the program has changed, drop all previously-pushed workouts so
    // we don't leave stale entries on the watch.
    if (prevSync && prevSync.programId !== user.programId) {
      for (const entry of Object.values(prevSync.workouts)) {
        try {
          await deleteWorkout(accessToken, entry.workoutId);
        } catch (e: any) {
          logger.warn('Cleanup of old Garmin workout failed:', e.message);
        }
      }
    }

    const newSync: GarminPlanSync = {
      programId: user.programId,
      workouts: {},
      lastSyncedAt: new Date(),
    };

    const results: Array<{ day: number; status: string; workoutId?: string }> = [];

    for (const w of targetWorkouts) {
      const dayKey = String(w.day);
      const day = workoutToDay(w);
      const garminWorkout = mapWorkoutDay(day);

      // Skip rest / welcome / race-day. Also remove any prior push for
      // this day in case it was previously a workout that's now rest.
      if (!garminWorkout) {
        const stale = prevSync?.workouts[dayKey];
        if (stale) {
          try {
            await deleteWorkout(accessToken, stale.workoutId);
          } catch (e: any) {
            logger.warn(`Cleanup of stale workout day ${w.day} failed:`, e.message);
          }
        }
        results.push({ day: w.day, status: 'skipped' });
        continue;
      }

      // If we previously pushed this day, delete and recreate (mapper
      // is deterministic but easier than diffing the payload).
      const stale = prevSync?.workouts[dayKey];
      if (stale) {
        try {
          await deleteWorkout(accessToken, stale.workoutId);
        } catch (e: any) {
          logger.warn(`Replace: delete day ${w.day} failed:`, e.message);
        }
      }

      try {
        const { workoutId } = await createWorkout(accessToken, garminWorkout);
        const scheduledDate = isoDate(
          new Date(startMs + (w.day - 1) * 86400000),
        );
        const { scheduleId } = await scheduleWorkout(accessToken, workoutId, scheduledDate);
        newSync.workouts[dayKey] = { workoutId, scheduledDate, ...(scheduleId ? { scheduleId } : {}) };
        results.push({ day: w.day, status: 'pushed', workoutId });
      } catch (e: any) {
        logger.error(`Garmin push failed for day ${w.day}:`, {
          message: e.message,
          response: e.response?.data,
        });
        results.push({ day: w.day, status: `failed: ${e.message}` });
      }
    }

    await userRef.update({ garminPlanSync: newSync });

    return NextResponse.json({
      success: true,
      pushed: results.filter((r) => r.status === 'pushed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
      failed: results.filter((r) => r.status.startsWith('failed')).length,
      results,
    });
  } catch (err: any) {
    logger.error('Garmin sync-plan error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to sync plan to Garmin.' },
      { status: 500 },
    );
  }
}
