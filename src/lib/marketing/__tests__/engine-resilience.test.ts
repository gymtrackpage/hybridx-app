import { describe, it, expect, vi, beforeEach } from 'vitest';

// A stateful Firestore stand-in, enough to drive advanceRuns. The subject here
// is the loop's failure handling, not Google's client library — but the runs
// have to actually persist, because the point of the fix is what the *next*
// pass sees.
interface Doc {
  id: string;
  data: Record<string, unknown>;
}

let runs: Doc[] = [];
let journeys: Record<string, Record<string, unknown>> = {};
let subscribers: Record<string, Record<string, unknown>> = {};

/** Subscriber ids whose tag write should throw, simulating a deleted doc. */
let throwingSubscribers = new Set<string>();

vi.mock('@/lib/firebase-admin', () => {
  const runRef = (id: string) => ({
    id,
    update: async (patch: Record<string, unknown>) => {
      const run = runs.find((r) => r.id === id);
      if (run) Object.assign(run.data, patch);
    },
  });

  const collection = (name: string) => ({
    doc: (id: string) => ({
      id,
      get: async () => {
        const bag = name === 'marketingJourneys' ? journeys : subscribers;
        return { exists: id in bag, id, data: () => bag[id] };
      },
      update: async (patch: Record<string, unknown>) => {
        if (name === 'marketingSubscribers') {
          // Firestore's update() rejects on a missing document. This is the
          // throw the engine previously let escape the whole pass.
          if (throwingSubscribers.has(id)) {
            throw new Error('NOT_FOUND: no entity to update');
          }
          Object.assign(subscribers[id] ?? {}, patch);
          return;
        }
        Object.assign((journeys[id] ??= {}), patch);
      },
      collection: () => collection('sends'),
    }),
    where: function () {
      return this;
    },
    limit: function () {
      return this;
    },
    count: () => ({ get: async () => ({ data: () => ({ count: 0 }) }) }),
    get: async () => ({
      empty: runs.length === 0,
      docs: runs.map((r) => ({ id: r.id, data: () => r.data, ref: runRef(r.id) })),
    }),
  });

  return {
    getAdminDb: () => ({
      collection,
      doc: () => ({ get: async () => ({ exists: false, data: () => undefined }) }),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({}),
      getAll: async () => [],
    }),
  };
});

vi.mock('@/lib/marketing/queue', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getSettings: async () => ({ sendingPaused: false, frequencyCapPerWeek: 5, batchSize: 50 }),
}));

const { advanceRuns } = await import('../engine');
const { MAX_RUN_FAILURES } = await import('../journeys');

const LIVE_JOURNEY = {
  id: 'j1',
  name: 'Tagging journey',
  status: 'live',
  trigger: { type: 'subscriberCreated' },
  entryRules: { onceOnly: true },
  steps: [{ id: 's1', type: 'addTag', tag: 'welcomed' }],
  stats: { entered: 0, completed: 0, exitedEarly: 0 },
};

function makeRun(id: string, subscriberId: string): Doc {
  return {
    id,
    data: {
      journeyId: 'j1',
      subscriberId,
      currentStep: 0,
      status: 'active',
      nextRunAt: new Date(0),
      enteredAt: new Date(0),
      history: [],
    },
  };
}

beforeEach(() => {
  journeys = { j1: { ...LIVE_JOURNEY } };
  subscribers = { good1: { tags: [] }, good2: { tags: [] }, bad: { tags: [] } };
  throwingSubscribers = new Set(['bad']);
  runs = [];
});

describe('advanceRuns error isolation', () => {
  it('advances the healthy runs either side of one that throws', async () => {
    // Ordered so the poisoned run sits in the middle: before the fix it
    // aborted the pass, and `good2` was never reached on this or any later
    // pass, because the query re-selects the same failing run every time.
    runs = [makeRun('r1', 'good1'), makeRun('rBad', 'bad'), makeRun('r2', 'good2')];

    const result = await advanceRuns();

    expect(result.advanced).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('does not throw out of the pass', async () => {
    runs = [makeRun('rBad', 'bad')];
    await expect(advanceRuns()).resolves.toBeDefined();
  });

  it('records the error and backs the run off rather than retrying immediately', async () => {
    runs = [makeRun('rBad', 'bad')];
    await advanceRuns();

    const run = runs.find((r) => r.id === 'rBad')!;
    expect(run.data.failureCount).toBe(1);
    expect(run.data.lastError).toContain('NOT_FOUND');
    expect(run.data.status).toBe('active'); // still retryable
    expect((run.data.nextRunAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('sets a run aside after repeated failures instead of retrying forever', async () => {
    runs = [makeRun('rBad', 'bad')];

    for (let pass = 0; pass < MAX_RUN_FAILURES; pass++) {
      runs[0].data.nextRunAt = new Date(0); // the run comes due again
      await advanceRuns();
    }

    const run = runs[0];
    expect(run.data.status).toBe('failed');
    expect(run.data.failureCount).toBe(MAX_RUN_FAILURES);
    expect(run.data.lastError).toContain('NOT_FOUND');
  });

  it('clears the failure count once a run advances again', async () => {
    // A run that stumbled twice and then recovered must not be set aside by
    // its next single transient error months later.
    runs = [makeRun('rFlaky', 'bad')];
    await advanceRuns();
    runs[0].data.nextRunAt = new Date(0);
    await advanceRuns();
    expect(runs[0].data.failureCount).toBe(2);

    // The subscriber comes back — the tag write now succeeds.
    throwingSubscribers.delete('bad');
    runs[0].data.nextRunAt = new Date(0);
    await advanceRuns();

    expect(runs[0].data.failureCount).toBe(0);
  });
});
