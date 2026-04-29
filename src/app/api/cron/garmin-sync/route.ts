// src/app/api/cron/garmin-sync/route.ts
// Nightly job: for every user with Garmin connected, push the next 14 days
// of their training plan to the watch so it's always current.
//
// Cloud Scheduler target:
//   GET https://app.hybridx.club/api/cron/garmin-sync
//   Authorization: Bearer <CRON_SECRET>
//   Schedule: 0 3 */10 * *  (03:00 UTC every 10 days — safety net only)
//   Immediate re-sync is triggered automatically when a user changes program.
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { getValidGarminToken } from '@/lib/garmin/token';
import { workoutToDay } from '@/lib/garmin/program-adapter';
import { mapWorkoutDay } from '@/lib/garmin/workout-mapper';
import {
  createWorkout,
  deleteWorkout,
  scheduleWorkout,
} from '@/lib/garmin/training-api';
import { getProgram } from '@/services/program-service';
import { logger } from '@/lib/logger';
import type { GarminPlanSync } from '@/models/types';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const HORIZON_DAYS = 14;

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = getAdminDb();
  const results = { processed: 0, synced: 0, skipped: 0, errors: 0 };

  // Query users who have connected Garmin (garminConnectedAt is set).
  const usersSnap = await db
    .collection('users')
    .where('garminConnectedAt', '!=', null)
    .get();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    results.processed++;

    try {
      const data = userDoc.data();
      if (!data.garmin?.accessToken) { results.skipped++; continue; }
      if (!data.programId || !data.startDate) { results.skipped++; continue; }

      // Skip if synced within the last 8 days — program-change events handle fresher syncs.
      const lastSynced: Date | undefined = data.garminPlanSync?.lastSyncedAt instanceof Timestamp
        ? data.garminPlanSync.lastSyncedAt.toDate()
        : data.garminPlanSync?.lastSyncedAt ? new Date(data.garminPlanSync.lastSyncedAt) : undefined;
      if (lastSynced && (today.getTime() - lastSynced.getTime()) < 8 * 86400000) {
        results.skipped++;
        continue;
      }

      const startDate: Date =
        data.startDate instanceof Timestamp
          ? data.startDate.toDate()
          : new Date(data.startDate);

      const program = await getProgram(data.programId);
      if (!program) { results.skipped++; continue; }

      let accessToken: string;
      try {
        accessToken = await getValidGarminToken(userId);
      } catch (e: any) {
        logger.warn(`Garmin cron: token refresh failed for ${userId}:`, e.code);
        results.skipped++;
        continue;
      }

      const todayDayNum = Math.floor((today.getTime() - startDate.getTime()) / 86400000) + 1;
      const fromDay = Math.max(1, todayDayNum);
      const toDay = todayDayNum + HORIZON_DAYS;

      const targetWorkouts = program.workouts.filter(
        (w) => w.day >= fromDay && w.day < toDay,
      );

      const prevSync: GarminPlanSync | undefined = data.garminPlanSync;
      const programChanged = prevSync && prevSync.programId !== data.programId;

      if (programChanged && prevSync) {
        for (const entry of Object.values(prevSync.workouts)) {
          try { await deleteWorkout(accessToken, entry.workoutId); } catch { /* ignore stale */ }
        }
      }

      const newSync: GarminPlanSync = {
        programId: data.programId,
        workouts: {},
        lastSyncedAt: new Date(),
      };

      let userPushed = 0;

      for (const w of targetWorkouts) {
        const dayKey = String(w.day);
        const garminWorkout = mapWorkoutDay(workoutToDay(w));

        if (!garminWorkout) {
          // Remove stale push for this day if it was previously a workout.
          const stale = prevSync?.workouts[dayKey];
          if (stale) {
            try { await deleteWorkout(accessToken, stale.workoutId); } catch { /* ignore */ }
          }
          continue;
        }

        // Delete and recreate so the content is always fresh.
        const stale = prevSync?.workouts[dayKey];
        if (stale) {
          try { await deleteWorkout(accessToken, stale.workoutId); } catch { /* ignore */ }
        }

        try {
          const { workoutId } = await createWorkout(accessToken, garminWorkout);
          const scheduledDate = isoDate(new Date(startDate.getTime() + (w.day - 1) * 86400000));
          const { scheduleId } = await scheduleWorkout(accessToken, workoutId, scheduledDate);
          newSync.workouts[dayKey] = { workoutId, scheduledDate, ...(scheduleId ? { scheduleId } : {}) };
          userPushed++;
        } catch (e: any) {
          logger.error(`Garmin cron: push failed day ${w.day} user ${userId}:`, e.message);
        }
      }

      await db.collection('users').doc(userId).update({ garminPlanSync: newSync });
      results.synced++;
      logger.log(`Garmin cron: synced ${userPushed} workouts for user ${userId}`);

    } catch (err: any) {
      logger.error(`Garmin cron: error for user ${userId}:`, err.message);
      results.errors++;
    }
  }

  return NextResponse.json({ success: true, results });
}
