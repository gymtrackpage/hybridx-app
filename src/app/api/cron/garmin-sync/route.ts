// src/app/api/cron/garmin-sync/route.ts
// Nightly job: for every user with Garmin connected, push the next 14 days
// of their training plan to the watch so it's always current.
//
// Cloud Scheduler target:
//   GET https://app.hybridx.club/api/cron/garmin-sync
//   Authorization: Bearer <CRON_SECRET>
//   Schedule: 0 3 */10 * *  (03:00 UTC every 10 days — safety net only)
//   Immediate re-sync is triggered automatically when a user changes program.
//
// The actual push is the shared reconciler in src/lib/garmin/plan-sync.ts, so
// this run and an on-demand sync behave identically: unchanged sessions are
// left alone and replaced ones are unscheduled and deleted before the new copy
// goes out.
import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { getValidGarminToken } from '@/lib/garmin/token';
import {
  createWorkout,
  deleteWorkout,
  scheduleWorkout,
  unscheduleWorkout,
} from '@/lib/garmin/training-api';
import { reconcileGarminPlan, type PlanSyncState } from '@/lib/garmin/plan-sync';
import { acquireGarminSyncLock } from '@/lib/garmin/sync-lock';
import { getProgram } from '@/services/program-service';
import { logger } from '@/lib/logger';
import { stripUndefined } from '@/lib/firestore-values';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const HORIZON_DAYS = 14;

/**
 * Stop starting new athletes past this point.
 *
 * Every athlete here means a series of calls to Garmin's API, so a large roster
 * can outlive the container. Without a budget the run is killed mid-athlete and
 * reports nothing at all; with one it returns a truthful partial result and the
 * rest are picked up next run. Must stay under maxDuration and under the Cloud
 * Scheduler attemptDeadline.
 */
const TIME_BUDGET_MS = 150_000;

function toDate(value: unknown): Date | undefined {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return undefined;
}

export async function GET(request: Request) {
  const denied = requireCronAuth(request, 'garmin-sync');
  if (denied) return denied;

  const db = getAdminDb();
  const startedAt = Date.now();
  const results = { processed: 0, synced: 0, skipped: 0, errors: 0, deferred: 0, locked: 0 };

  // Query users who have connected Garmin (garminConnectedAt is set).
  const usersSnap = await db
    .collection('users')
    .where('garminConnectedAt', '!=', null)
    .get();

  const today = new Date();

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;

    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      results.deferred = usersSnap.docs.length - results.processed;
      logger.error(
        `[cron/garmin-sync] time budget reached; ${results.deferred} athletes deferred to the next run`,
      );
      break;
    }

    results.processed++;

    try {
      const data = userDoc.data();
      if (!data.garmin?.accessToken) { results.skipped++; continue; }
      if (!data.programId || !data.startDate) { results.skipped++; continue; }

      // Skip if synced within the last 8 days — program-change events handle fresher syncs.
      const lastSynced = toDate(data.garminPlanSync?.lastSyncedAt);
      if (lastSynced && (today.getTime() - lastSynced.getTime()) < 8 * 86400000) {
        results.skipped++;
        continue;
      }

      const startDateRaw = toDate(data.startDate);
      if (!startDateRaw) { results.skipped++; continue; }
      // Snap to UTC midnight of intended calendar day (browser stores local midnight).
      const startMs = Math.round(startDateRaw.getTime() / 86400000) * 86400000;

      const program = await getProgram(data.programId);
      if (!program) { results.skipped++; continue; }

      let accessToken: string;
      try {
        accessToken = await getValidGarminToken(userId);
      } catch (e) {
        const error = e as { code?: string };
        // logger.error, not warn: warn is compiled out in production, and a
        // token that will not refresh is the single most likely reason an
        // athlete silently stops receiving workouts.
        logger.error(`[cron/garmin-sync] token refresh failed for ${userId}:`, error.code);
        results.skipped++;
        continue;
      }

      const userRef = db.collection('users').doc(userId);

      // If an on-demand sync is mid-flight for this athlete, leave them to it —
      // two syncs racing is how duplicate workouts get onto the watch.
      const lock = await acquireGarminSyncLock(userRef);
      if (!lock) {
        logger.log(`[cron/garmin-sync] user ${userId} already syncing; skipping`);
        results.locked++;
        continue;
      }

      try {
        const todayMs = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
        const todayDayNum = Math.floor((todayMs - startMs) / 86400000) + 1;

        const outcome = await reconcileGarminPlan({
          api: {
            createWorkout: (w) => createWorkout(accessToken, w),
            scheduleWorkout: (id, date) => scheduleWorkout(accessToken, id, date),
            deleteWorkout: (id) => deleteWorkout(accessToken, id),
            unscheduleWorkout: (id) => unscheduleWorkout(accessToken, id),
          },
          programId: data.programId,
          startMs,
          workouts: program.workouts,
          todayDayNum,
          horizonDays: HORIZON_DAYS,
          prevSync: data.garminPlanSync
            ? ({ ...data.garminPlanSync, lastSyncedAt: lastSynced } as Partial<PlanSyncState>)
            : undefined,
          persist: (state) =>
          userRef.update({ garminPlanSync: stripUndefined(state) }).then(() => undefined),
          onWarn: (message, error) =>
            logger.error(
              `[cron/garmin-sync] ${message} (user ${userId}):`,
              error instanceof Error ? error.message : String(error ?? ''),
            ),
        });

        results.synced++;
        logger.log(
          `[cron/garmin-sync] user ${userId}: ${outcome.created} pushed, ${outcome.unchanged} unchanged, ${outcome.removed} removed, ${outcome.failed} failed`,
        );
      } finally {
        await lock.release();
      }
    } catch (err) {
      const error = err as Error;
      logger.error(`[cron/garmin-sync] error for user ${userId}:`, error instanceof Error ? error.message : String(error));
      results.errors++;
    }
  }

  return NextResponse.json({ success: true, results });
}
