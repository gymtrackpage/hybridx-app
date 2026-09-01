// src/app/api/garmin/sync-plan/route.ts
// Pushes the user's planned workouts for the next ~14 days to Garmin and
// schedules each one to its calendar date.
//
// The push is a reconcile, not a re-push: sessions that already match what the
// watch is holding are left untouched, and anything replaced is unscheduled and
// deleted first. See src/lib/garmin/plan-sync.ts for why that matters.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { getValidGarminToken } from '@/lib/garmin/token';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  createWorkout,
  deleteWorkout,
  scheduleWorkout,
  unscheduleWorkout,
} from '@/lib/garmin/training-api';
import { reconcileGarminPlan, type PlanSyncState } from '@/lib/garmin/plan-sync';
import { acquireGarminSyncLock } from '@/lib/garmin/sync-lock';
import { getUser } from '@/services/user-service';
import { getProgram } from '@/services/program-service';
import { logger } from '@/lib/logger';
import { stripUndefined } from '@/lib/firestore-values';

// A 14-day push is a long chain of Garmin calls. Without this the request can
// be cut off mid-push; state is written incrementally so that is recoverable,
// but there is no reason to make it likely.
export const maxDuration = 300;

const DEFAULT_HORIZON_DAYS = 14;

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
    const horizonDays: number = Number(body?.horizonDays) || DEFAULT_HORIZON_DAYS;

    let accessToken: string;
    try {
      accessToken = await getValidGarminToken(userId);
    } catch (e) {
      const error = e as { code?: string };
      if (error.code === 'GARMIN_NOT_CONNECTED') {
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

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(userId);

    // One sync per athlete at a time — concurrent runs would each push their
    // own copy of the plan.
    const lock = await acquireGarminSyncLock(userRef);
    if (!lock) {
      return NextResponse.json(
        { error: 'A sync is already running for this account. Please try again shortly.' },
        { status: 409 },
      );
    }

    try {
      // Compute today's day-number in the program (1-indexed).
      const startMs = Math.round(user.startDate.getTime() / 86400000) * 86400000;
      const today = new Date();
      const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
      const todayDayNum = Math.floor((todayMs - startMs) / 86400000) + 1;

      const outcome = await reconcileGarminPlan({
        api: {
          createWorkout: (w) => createWorkout(accessToken, w),
          scheduleWorkout: (id, date) => scheduleWorkout(accessToken, id, date),
          deleteWorkout: (id) => deleteWorkout(accessToken, id),
          unscheduleWorkout: (id) => unscheduleWorkout(accessToken, id),
        },
        programId: user.programId,
        startMs,
        workouts: program.workouts,
        todayDayNum,
        horizonDays,
        prevSync: user.garminPlanSync as Partial<PlanSyncState> | undefined,
        persist: (state) =>
          userRef.update({ garminPlanSync: stripUndefined(state) }).then(() => undefined),
        onWarn: (message, error) =>
          logger.error(message, error instanceof Error ? error.message : String(error ?? '')),
      });

      return NextResponse.json({
        success: true,
        pushed: outcome.created,
        unchanged: outcome.unchanged,
        removed: outcome.removed,
        skipped: outcome.skipped,
        failed: outcome.failed,
        pendingDeletes: outcome.pendingDeletes,
        results: outcome.results,
      });
    } finally {
      await lock.release();
    }
  } catch (err) {
    const error = err as Error;
    logger.error('Garmin sync-plan error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync plan to Garmin.' },
      { status: 500 },
    );
  }
}
