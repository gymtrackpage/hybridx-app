/**
 * Reconciles a user's training plan onto Garmin Connect.
 *
 * This is the single implementation shared by the on-demand route
 * (`/api/garmin/sync-plan`) and the nightly cron (`/api/cron/garmin-sync`).
 *
 * The previous per-route implementations deleted and re-created every workout
 * in the horizon on every sync, and only wrote the resulting bookkeeping record
 * once, at the very end. That combination duplicated workouts on the watch:
 *
 *  1. If the request died before that final write (route timeout, or the
 *     fire-and-forget sync being cut off when the page navigated), the newly
 *     created workouts were never recorded — so the *next* sync had no idea
 *     they existed, deleted nothing, and pushed another copy.
 *  2. Two program rows sharing a `day` (the CSV importer buckets by
 *     `day::title`, so this is a supported shape) both produced the key
 *     `"94"`. The second overwrote the first in the record, permanently
 *     orphaning one workout per sync.
 *  3. A failed delete was logged and swallowed, then the entry was dropped
 *     from the new record — the stale workout stayed on the watch forever and
 *     nothing ever tried to remove it again.
 *  4. Nothing ever deleted the *schedule* (calendar entry); only the workout
 *     was deleted.
 *
 * The reconciler below fixes all four:
 *
 *  - Every session carries a content hash. An unchanged session is left
 *    completely alone — no delete, no create, no calendar churn. A repeat
 *    sync of an unchanged plan makes zero Garmin write calls.
 *  - Keys are `${day}_${index}` over *all* sessions of that day, gathered
 *    across every program row for the day, so two rows can never collide.
 *  - State is persisted after each mutation, so an interrupted run leaves an
 *    accurate record and the next run resumes instead of duplicating.
 *  - Retiring a workout unschedules it first, then deletes it. Anything that
 *    fails goes onto `pendingDeletes` and is retried on every later sync.
 */
import crypto from 'node:crypto';
import type { Workout, RunningWorkout } from '@/models/types';
import { workoutToDays } from './program-adapter';
import { mapWorkoutDay, type GarminWorkout } from './workout-mapper';

export interface GarminSyncEntry {
  workoutId: string;
  scheduleId?: string;
  scheduledDate?: string;
  /** Content fingerprint — lets a re-sync skip a session that hasn't changed. */
  hash?: string;
}

export interface PendingDelete {
  workoutId: string;
  scheduleId?: string;
}

export interface PlanSyncState {
  programId: string;
  workouts: Record<string, GarminSyncEntry>;
  /** Workouts we failed to remove; retried on every subsequent sync. */
  pendingDeletes: PendingDelete[];
  lastSyncedAt: Date;
}

/** The Garmin calls the reconciler needs, injected so it can be tested. */
export interface GarminPlanApi {
  createWorkout(workout: GarminWorkout): Promise<{ workoutId: string }>;
  scheduleWorkout(workoutId: string, isoDate: string): Promise<{ scheduleId?: string }>;
  deleteWorkout(workoutId: string): Promise<void>;
  unscheduleWorkout(scheduleId: string): Promise<void>;
}

export interface ReconcileOptions {
  api: GarminPlanApi;
  programId: string;
  /** UTC-midnight epoch ms of program day 1. */
  startMs: number;
  workouts: Array<Workout | RunningWorkout>;
  /** Day number of "today" in the program (1-indexed, may be <= 0 or > length). */
  todayDayNum: number;
  horizonDays: number;
  prevSync?: Partial<PlanSyncState> | null;
  /** Persist intermediate state. Called after every mutation. */
  persist: (state: PlanSyncState) => Promise<void>;
  onWarn?: (message: string, error?: unknown) => void;
}

export interface ReconcileResult {
  state: PlanSyncState;
  created: number;
  unchanged: number;
  removed: number;
  failed: number;
  skipped: number;
  /** Removals that did not succeed and were queued for a later retry. */
  pendingDeletes: number;
  results: Array<{ day: number; key: string; status: string; workoutId?: string }>;
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hashWorkout(workout: GarminWorkout, scheduledDate: string): string {
  return crypto
    .createHash('sha256')
    .update(`${scheduledDate}|${JSON.stringify(workout)}`)
    .digest('hex')
    .slice(0, 16);
}

/** `"94"` (legacy) and `"94_0"` both describe day 94, session 0. */
export function planKey(day: number, index: number): string {
  return `${day}_${index}`;
}

/**
 * Queue a workout for removal.
 *
 * The Admin SDK runs without `ignoreUndefinedProperties`, so an absent
 * `scheduleId` has to be an absent key rather than `undefined` — one undefined
 * value anywhere in the record makes the whole write throw.
 */
function queueDelete(
  state: PlanSyncState,
  entry: { workoutId: string; scheduleId?: string },
): void {
  state.pendingDeletes.push({
    workoutId: entry.workoutId,
    ...(entry.scheduleId ? { scheduleId: entry.scheduleId } : {}),
  });
}

export function dayOfKey(key: string): number {
  const day = parseInt(key.split('_')[0], 10);
  return Number.isNaN(day) ? -1 : day;
}

/**
 * Bring a stored record up to the current shape: legacy `"94"` keys become
 * `"94_0"`, and missing collections are filled in. Legacy entries have no
 * hash, so they are re-pushed once and tracked properly from then on.
 */
export function normalizePlanSync(
  programId: string,
  prev?: Partial<PlanSyncState> | null,
): PlanSyncState {
  const state: PlanSyncState = {
    programId,
    workouts: {},
    pendingDeletes: Array.isArray(prev?.pendingDeletes) ? [...prev!.pendingDeletes!] : [],
    lastSyncedAt: prev?.lastSyncedAt instanceof Date ? prev.lastSyncedAt : new Date(0),
  };

  for (const [key, entry] of Object.entries(prev?.workouts ?? {})) {
    if (!entry?.workoutId) continue;
    const normalized = key.includes('_') ? key : planKey(dayOfKey(key), 0);
    if (state.workouts[normalized]) {
      // Two legacy keys collapsing onto one slot: the loser is still a real
      // workout on the watch, so retire it rather than forgetting it.
      queueDelete(state, entry);
      continue;
    }
    state.workouts[normalized] = { ...entry };
  }

  return state;
}

export interface DesiredSession {
  key: string;
  day: number;
  scheduledDate: string;
  workout: GarminWorkout;
  hash: string;
}

/**
 * Every session the watch should be holding for the horizon window.
 *
 * Sessions are gathered per calendar day across *all* program rows for that
 * day, then indexed — so two rows on day 94 produce `94_0` and `94_1` instead
 * of both claiming `94`. Byte-identical sessions on the same day are collapsed;
 * that shape only arises from duplicated program data and would otherwise show
 * up as visible duplicates on the watch.
 */
export function buildDesiredSessions(
  workouts: Array<Workout | RunningWorkout>,
  todayDayNum: number,
  horizonDays: number,
  startMs: number,
): DesiredSession[] {
  const fromDay = Math.max(1, todayDayNum);
  const toDay = todayDayNum + horizonDays;

  const byDay = new Map<number, Array<Workout | RunningWorkout>>();
  for (const w of workouts) {
    if (w.day < fromDay || w.day >= toDay) continue;
    const list = byDay.get(w.day);
    if (list) list.push(w);
    else byDay.set(w.day, [w]);
  }

  const desired: DesiredSession[] = [];

  for (const day of [...byDay.keys()].sort((a, b) => a - b)) {
    const scheduledDate = isoDate(new Date(startMs + (day - 1) * 86400000));
    const seen = new Set<string>();
    let index = 0;

    for (const w of byDay.get(day)!) {
      for (const session of workoutToDays(w)) {
        const workout = mapWorkoutDay(session);
        if (!workout) continue; // rest day / unmappable
        const hash = hashWorkout(workout, scheduledDate);
        if (seen.has(hash)) continue; // duplicated program data
        seen.add(hash);
        desired.push({ key: planKey(day, index), day, scheduledDate, workout, hash });
        index++;
      }
    }
  }

  return desired;
}

/**
 * Push the plan to Garmin, making only the changes that are actually needed.
 */
export async function reconcileGarminPlan(opts: ReconcileOptions): Promise<ReconcileResult> {
  const { api, programId, startMs, workouts, todayDayNum, horizonDays, persist } = opts;
  const warn = opts.onWarn ?? (() => {});

  const previous = normalizePlanSync(programId, opts.prevSync);
  const programChanged = !!opts.prevSync?.programId && opts.prevSync.programId !== programId;

  const state: PlanSyncState = {
    programId,
    workouts: programChanged ? {} : previous.workouts,
    pendingDeletes: [...previous.pendingDeletes],
    lastSyncedAt: new Date(),
  };

  // A different program means everything previously pushed is stale.
  if (programChanged) {
    for (const entry of Object.values(previous.workouts)) {
      queueDelete(state, entry);
    }
  }

  const desired = buildDesiredSessions(workouts, todayDayNum, horizonDays, startMs);
  const desiredByKey = new Map(desired.map((d) => [d.key, d]));

  const fromDay = Math.max(1, todayDayNum);
  const toDay = todayDayNum + horizonDays;

  const result: ReconcileResult = {
    state,
    created: 0,
    unchanged: 0,
    removed: 0,
    failed: 0,
    skipped: 0,
    pendingDeletes: 0,
    results: [],
  };

  let dirty = false;
  const flush = async () => {
    if (!dirty) return;
    await persist(state);
    dirty = false;
  };

  // ── 1. Retire entries inside the window that are no longer wanted ─────────
  // Entries outside the window are left alone: past days are the athlete's
  // history, and days beyond the horizon are still valid future workouts.
  for (const key of Object.keys(state.workouts)) {
    const day = dayOfKey(key);
    if (day < fromDay || day >= toDay) continue;

    const want = desiredByKey.get(key);
    const entry = state.workouts[key];
    if (want && entry.hash === want.hash && entry.scheduledDate === want.scheduledDate) {
      continue; // unchanged — handled in step 2
    }

    queueDelete(state, entry);
    delete state.workouts[key];
    dirty = true;
    if (!want) result.results.push({ day, key, status: 'removed' });
  }
  await flush();

  // ── 2. Drain the retirement queue (including failures from earlier runs) ──
  const stillPending: PendingDelete[] = [];
  for (const pending of state.pendingDeletes) {
    try {
      if (pending.scheduleId) await api.unscheduleWorkout(pending.scheduleId);
      await api.deleteWorkout(pending.workoutId);
      result.removed++;
      dirty = true;
    } catch (e) {
      // Keep it queued rather than forgetting it — an untracked workout is
      // exactly what shows up on the watch as a duplicate.
      warn(`Garmin: removing workout ${pending.workoutId} failed; will retry next sync`, e);
      stillPending.push(pending);
    }
  }
  state.pendingDeletes = stillPending;
  result.pendingDeletes = stillPending.length;
  if (dirty) await flush();

  // ── 3. Create what's missing ─────────────────────────────────────────────
  for (const want of desired) {
    const entry = state.workouts[want.key];
    if (entry && entry.hash === want.hash && entry.scheduledDate === want.scheduledDate) {
      result.unchanged++;
      result.results.push({ day: want.day, key: want.key, status: 'unchanged', workoutId: entry.workoutId });
      continue;
    }

    try {
      const { workoutId } = await api.createWorkout(want.workout);
      let scheduleId: string | undefined;
      try {
        ({ scheduleId } = await api.scheduleWorkout(workoutId, want.scheduledDate));
      } catch (e) {
        // The workout exists but isn't on the calendar. Record it so it can be
        // cleaned up, then surface the failure.
        queueDelete(state, { workoutId });
        await persist(state);
        throw e;
      }
      state.workouts[want.key] = {
        workoutId,
        scheduledDate: want.scheduledDate,
        hash: want.hash,
        ...(scheduleId ? { scheduleId } : {}),
      };
      dirty = true;
      // Persist immediately: if the run is cut short here, the next sync must
      // know this workout exists so it replaces it instead of adding another.
      await flush();
      result.created++;
      result.results.push({ day: want.day, key: want.key, status: 'pushed', workoutId });
    } catch (e) {
      result.failed++;
      result.results.push({
        day: want.day,
        key: want.key,
        status: `failed: ${e instanceof Error ? e.message : String(e)}`,
      });
      warn(`Garmin: pushing day ${want.day} (${want.key}) failed`, e);
    }
  }

  result.skipped = Math.max(
    0,
    workouts.filter((w) => w.day >= fromDay && w.day < toDay).length -
      new Set(desired.map((d) => d.day)).size,
  );

  state.lastSyncedAt = new Date();
  await persist(state);

  return result;
}
