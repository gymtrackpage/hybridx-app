import { describe, it, expect } from 'vitest';
import {
  reconcileGarminPlan,
  normalizePlanSync,
  buildDesiredSessions,
  type GarminPlanApi,
  type PlanSyncState,
} from '@/lib/garmin/plan-sync';
import type { Workout } from '@/models/types';

/** Firestore's Admin SDK rejects `undefined` anywhere in a written document. */
function hasUndefined(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUndefined);
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.values(value).some((v) => v === undefined || hasUndefined(v));
  }
  return value === undefined;
}

const START_MS = Date.UTC(2026, 0, 1); // day 1 === 2026-01-01

/** A fake Garmin that records every call and hands out sequential ids. */
function fakeGarmin(overrides: Partial<GarminPlanApi> = {}) {
  let nextId = 1;
  const live = new Set<string>();
  const scheduled = new Set<string>();
  const calls = { created: 0, scheduled: 0, deleted: 0, unscheduled: 0 };

  const api: GarminPlanApi = {
    async createWorkout() {
      const workoutId = `w${nextId++}`;
      live.add(workoutId);
      calls.created++;
      return { workoutId };
    },
    async scheduleWorkout(workoutId) {
      const scheduleId = `s-${workoutId}`;
      scheduled.add(scheduleId);
      calls.scheduled++;
      return { scheduleId };
    },
    async deleteWorkout(workoutId) {
      live.delete(workoutId);
      calls.deleted++;
    },
    async unscheduleWorkout(scheduleId) {
      scheduled.delete(scheduleId);
      calls.unscheduled++;
    },
    ...overrides,
  };

  return { api, live, scheduled, calls };
}

function strengthDay(day: number, name: string): Workout {
  return {
    day,
    title: `D${day} – ${name}`,
    exercises: [{ name, details: '3 sets of 10', sessionType: 'strength' }],
  } as unknown as Workout;
}

function runDay(day: number, title = 'Threshold Run'): Workout {
  return {
    day,
    title: `D${day} – ${title}`,
    programType: 'running',
    exercises: [],
    runs: [{ distance: 5, type: 'threshold', effortLevel: 7 }],
  } as unknown as Workout;
}

async function run(
  workouts: Workout[],
  prevSync: Partial<PlanSyncState> | undefined,
  api: GarminPlanApi,
  opts: { programId?: string; todayDayNum?: number; horizonDays?: number } = {},
) {
  const persisted: PlanSyncState[] = [];
  const result = await reconcileGarminPlan({
    api,
    programId: opts.programId ?? 'prog-a',
    startMs: START_MS,
    workouts,
    todayDayNum: opts.todayDayNum ?? 1,
    horizonDays: opts.horizonDays ?? 14,
    prevSync,
    persist: async (state) => {
      // structuredClone, not a JSON round-trip: JSON silently drops `undefined`,
      // which is exactly what the persisted-shape assertions are looking for.
      persisted.push(structuredClone(state));
    },
  });
  return { result, persisted };
}

describe('buildDesiredSessions', () => {
  it('gives two program rows on the same day distinct keys', () => {
    const desired = buildDesiredSessions(
      [strengthDay(3, 'Squat'), strengthDay(3, 'Bench')],
      1,
      14,
      START_MS,
    );
    expect(desired.map((d) => d.key)).toEqual(['3_0', '3_1']);
    expect(new Set(desired.map((d) => d.scheduledDate))).toEqual(new Set(['2026-01-03']));
  });

  it('collapses byte-identical sessions on one day', () => {
    const desired = buildDesiredSessions(
      [runDay(94), runDay(94), runDay(94)],
      90,
      14,
      START_MS,
    );
    expect(desired).toHaveLength(1);
  });

  it('only covers the horizon window', () => {
    const days = [1, 5, 20, 40].map((d) => strengthDay(d, 'Squat'));
    const desired = buildDesiredSessions(days, 4, 14, START_MS);
    expect(desired.map((d) => d.day)).toEqual([5]);
  });
});

describe('normalizePlanSync', () => {
  it('migrates legacy bare-day keys to indexed keys', () => {
    const state = normalizePlanSync('prog-a', {
      programId: 'prog-a',
      workouts: { '94': { workoutId: 'w1' }, '95_1': { workoutId: 'w2' } },
    });
    expect(Object.keys(state.workouts).sort()).toEqual(['94_0', '95_1']);
  });

  it('queues the loser when two legacy keys collapse onto one slot', () => {
    const state = normalizePlanSync('prog-a', {
      programId: 'prog-a',
      workouts: { '94': { workoutId: 'w1' }, '94_0': { workoutId: 'w2' } },
    });
    expect(Object.keys(state.workouts)).toEqual(['94_0']);
    expect(state.pendingDeletes).toHaveLength(1);
  });
});

describe('reconcileGarminPlan', () => {
  it('pushes and schedules every session on a first sync', async () => {
    const { api, calls } = fakeGarmin();
    const { result } = await run([runDay(1), strengthDay(2, 'Squat')], undefined, api);

    expect(result.created).toBe(2);
    expect(calls.created).toBe(2);
    expect(calls.scheduled).toBe(2);
    expect(result.failed).toBe(0);
  });

  it('re-syncing an unchanged plan makes no Garmin write calls', async () => {
    const workouts = [runDay(1), strengthDay(2, 'Squat'), runDay(3)];
    const first = fakeGarmin();
    const { result: r1 } = await run(workouts, undefined, first.api);

    const second = fakeGarmin();
    const { result: r2 } = await run(workouts, r1.state, second.api);

    expect(r2.unchanged).toBe(3);
    expect(r2.created).toBe(0);
    expect(second.calls).toEqual({ created: 0, scheduled: 0, deleted: 0, unscheduled: 0 });
  });

  it('replaces a changed day exactly once, removing the old copy first', async () => {
    const { api, live, scheduled, calls } = fakeGarmin();
    const { result: r1 } = await run([runDay(1)], undefined, api);
    const oldId = r1.state.workouts['1_0'].workoutId;

    const { result: r2 } = await run([strengthDay(1, 'Squat')], r1.state, api);

    expect(r2.created).toBe(1);
    expect(r2.removed).toBe(1);
    expect(calls.unscheduled).toBe(1);
    expect(live.has(oldId)).toBe(false);
    expect(live.size).toBe(1);
    expect(scheduled.size).toBe(1);
  });

  it('does not duplicate when a previous run was cut off before its final write', async () => {
    // Simulate a route timeout: the first run's state is only known as far as
    // the last incremental persist.
    const { api, live } = fakeGarmin();
    const workouts = [runDay(1), strengthDay(2, 'Squat'), runDay(3)];
    const { persisted } = await run(workouts, undefined, api);

    // Interrupted right after the second workout was recorded.
    const partial = persisted.find((s) => Object.keys(s.workouts).length === 2)!;
    expect(partial).toBeDefined();

    const { result: r2 } = await run(
      workouts,
      { ...partial, lastSyncedAt: new Date(0) },
      api,
    );

    // Only the one session that never got recorded is pushed again.
    expect(r2.created).toBe(1);
    expect(r2.unchanged).toBe(2);
    expect(live.size).toBe(4); // 3 from run one + the re-push of the untracked third
  });

  it('records the untracked workout of an interrupted run so nothing is orphaned twice', async () => {
    const { api } = fakeGarmin();
    const workouts = [runDay(1), runDay(2)];
    const { persisted } = await run(workouts, undefined, api);
    const partial = persisted.find((s) => Object.keys(s.workouts).length === 1)!;

    const { result: r2 } = await run(workouts, { ...partial, lastSyncedAt: new Date(0) }, api);
    const { result: r3 } = await run(workouts, r2.state, api);

    expect(r3.created).toBe(0);
    expect(r3.unchanged).toBe(2);
  });

  it('keeps a failed delete queued instead of forgetting the workout', async () => {
    let failDelete = true;
    const { api, calls } = fakeGarmin({
      async deleteWorkout() {
        calls.deleted++;
        if (failDelete) throw new Error('garmin 500');
      },
    });
    const { result: r1 } = await run([runDay(1)], undefined, api);
    const oldId = r1.state.workouts['1_0'].workoutId;

    const { result: r2 } = await run([strengthDay(1, 'Squat')], r1.state, api);
    expect(r2.pendingDeletes).toBe(1);
    expect(r2.state.pendingDeletes[0].workoutId).toBe(oldId);
    expect(r2.created).toBe(1); // the athlete still gets the new session

    failDelete = false;
    const { result: r3 } = await run([strengthDay(1, 'Squat')], r2.state, api);
    expect(r3.removed).toBe(1);
    expect(r3.pendingDeletes).toBe(0);
    expect(r3.created).toBe(0);
  });

  it('drops everything from the old program when the program changes', async () => {
    const { api, live } = fakeGarmin();
    const { result: r1 } = await run([runDay(1), runDay(2)], undefined, api, { programId: 'prog-a' });
    expect(live.size).toBe(2);

    const { result: r2 } = await run([strengthDay(1, 'Squat')], r1.state, api, { programId: 'prog-b' });
    expect(r2.removed).toBe(2);
    expect(live.size).toBe(1);
    expect(r2.state.programId).toBe('prog-b');
  });

  it('leaves past days and days beyond the horizon alone', async () => {
    const workouts = [runDay(1), runDay(20), runDay(40)];
    const { api } = fakeGarmin();
    const { result: r1 } = await run(workouts, undefined, api, { todayDayNum: 1, horizonDays: 45 });
    expect(Object.keys(r1.state.workouts).sort()).toEqual(['1_0', '20_0', '40_0']);

    // A later, narrower sync: day 1 is in the past, day 40 is beyond the window.
    const { api: api2, calls } = fakeGarmin();
    const { result: r2 } = await run(workouts, r1.state, api2, { todayDayNum: 15, horizonDays: 14 });
    expect(calls.deleted).toBe(0);
    expect(Object.keys(r2.state.workouts).sort()).toEqual(['1_0', '20_0', '40_0']);
  });

  it('removes a day that is no longer in the program', async () => {
    const { api, live } = fakeGarmin();
    const { result: r1 } = await run([runDay(1), runDay(2)], undefined, api);
    const { result: r2 } = await run([runDay(1)], r1.state, api);

    expect(r2.removed).toBe(1);
    expect(Object.keys(r2.state.workouts)).toEqual(['1_0']);
    expect(live.size).toBe(1);
  });

  it('a push failure leaves nothing half-tracked', async () => {
    const { api } = fakeGarmin({
      async scheduleWorkout() {
        throw new Error('schedule rejected');
      },
    });
    const { result } = await run([runDay(1)], undefined, api);

    expect(result.failed).toBe(1);
    expect(result.state.workouts['1_0']).toBeUndefined();
    // The created-but-unscheduled workout is queued for removal, not leaked.
    expect(result.state.pendingDeletes).toHaveLength(1);
  });

  it('never persists an undefined value — the Admin SDK would reject the write', async () => {
    const { api } = fakeGarmin({
      // No scheduleId comes back, so pendingDeletes entries must omit the key.
      async scheduleWorkout() {
        return {};
      },
    });
    const { result: r1, persisted: p1 } = await run([runDay(1), runDay(2)], undefined, api);
    const { persisted: p2 } = await run([strengthDay(1, 'Squat')], r1.state, api);

    for (const state of [...p1, ...p2]) {
      expect(hasUndefined(state)).toBe(false);
    }
  });

  it('migrates a legacy record without re-pushing more than once', async () => {
    const { api } = fakeGarmin();
    const legacy: Partial<PlanSyncState> = {
      programId: 'prog-a',
      workouts: { '1': { workoutId: 'legacy-1', scheduleId: 'legacy-s1', scheduledDate: '2026-01-01' } },
    };
    const { result: r1 } = await run([runDay(1)], legacy, api);
    expect(r1.created).toBe(1);
    expect(r1.removed).toBe(1); // the legacy copy is cleaned up

    const { result: r2 } = await run([runDay(1)], r1.state, api);
    expect(r2.created).toBe(0);
    expect(r2.unchanged).toBe(1);
  });
});
