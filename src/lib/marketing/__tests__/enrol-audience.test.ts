import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Journey } from '../journeys';
import type { Subscriber } from '../types';

/**
 * A journey's entry audience must narrow every enrolment, not only the manual
 * ones.
 *
 * `entryRules.segment` is documented on JourneyEntryRules as "extra conditions
 * beyond the trigger itself", the studio plans one, displays it to whoever is
 * composing, and saveJourney writes it. But only runManualJourney ever read it:
 * processEvents went straight to enrolSubscriber, which checked status, consent
 * and onceOnly and nothing else.
 *
 * So a welcome sequence narrowed to one funnel looked right in the console and
 * enrolled everybody who granted consent, from any funnel. Nothing failed —
 * the wrong people simply received it. This file pins the two halves together.
 */

const subscribers: Record<string, Record<string, unknown>> = {};
const users: Record<string, Record<string, unknown>> = {};
const created: Array<{ runId: string }> = [];

vi.mock('@/lib/firebase-admin', () => {
  const collection = (name: string) => ({
    doc: (id: string) => ({
      id,
      get: async () => {
        const bag = name === 'users' ? users : subscribers;
        return { exists: id in bag, id, data: () => bag[id] };
      },
      update: async () => {},
    }),
  });

  return {
    getAdminDb: () => ({
      collection,
      runTransaction: async (
        fn: (tx: {
          get: (ref: { id: string }) => Promise<{ exists: boolean; data: () => unknown }>;
          set: (ref: { id: string }, data: unknown) => void;
          update: () => void;
        }) => Promise<unknown>,
      ) =>
        fn({
          get: async () => ({ exists: false, data: () => undefined }),
          set: (ref) => created.push({ runId: ref.id }),
          update: () => {},
        }),
    }),
  };
});

const { enrolSubscriber } = await import('../engine');

/** A journey that is nothing but its entry audience. */
function journeyWith(segment: Journey['entryRules']['segment']): Journey {
  return {
    id: 'welcome',
    name: 'Welcome',
    goal: 'greet',
    trigger: { type: 'consentGranted' },
    entryRules: { onceOnly: true, segment },
    exitRules: {},
    steps: [],
    status: 'live',
  } as unknown as Journey;
}

function addSubscriber(id: string, patch: Partial<Subscriber> = {}) {
  subscribers[id] = {
    email: `${id}@hybridx.club`,
    status: 'active',
    consent: { marketing: true },
    tags: [],
    ...patch,
  };
}

beforeEach(() => {
  for (const key of Object.keys(subscribers)) delete subscribers[key];
  for (const key of Object.keys(users)) delete users[key];
  created.length = 0;
});

describe('enrolSubscriber honours the journey audience', () => {
  it('enrols somebody carrying the route the journey asks for', async () => {
    addSubscriber('athlete', { tags: ['route:magnet-athx-guide', 'source:website'] });

    const result = await enrolSubscriber(
      journeyWith({ allTags: ['route:magnet-athx-guide'] }),
      'athlete',
    );

    expect(result).toBe('enrolled');
    expect(created).toHaveLength(1);
  });

  it('refuses somebody who arrived by a different funnel', async () => {
    // The regression. Before the fix this returned 'enrolled': the trigger
    // matched, the audience was never consulted, and a launch email for one
    // book reached the whole list.
    addSubscriber('other', { tags: ['route:magnet-race-card'] });

    const result = await enrolSubscriber(
      journeyWith({ allTags: ['route:magnet-athx-guide'] }),
      'other',
    );

    expect(result).toBe('not-eligible');
    expect(created).toHaveLength(0);
  });

  it('respects anyTags, which is the shape the studio composes', async () => {
    addSubscriber('a', { tags: ['route:magnet-vo2max'] });
    addSubscriber('b', { tags: ['route:magnet-free-plan'] });
    addSubscriber('c', { tags: ['source:app'] });

    const journey = journeyWith({ anyTags: ['route:magnet-vo2max', 'route:magnet-free-plan'] });

    expect(await enrolSubscriber(journey, 'a')).toBe('enrolled');
    expect(await enrolSubscriber(journey, 'b')).toBe('enrolled');
    expect(await enrolSubscriber(journey, 'c')).toBe('not-eligible');
  });

  it('respects noneTags, so an exclusion actually excludes', async () => {
    addSubscriber('buyer', { tags: ['route:magnet-athx-guide', 'bought:athx-2027'] });

    const result = await enrolSubscriber(
      journeyWith({ allTags: ['route:magnet-athx-guide'], noneTags: ['bought:athx-2027'] }),
      'buyer',
    );

    expect(result).toBe('not-eligible');
  });

  it('enrols everybody when the journey names no audience', async () => {
    // The seeded journeys carry `segment: {}`, and an absent field must behave
    // the same. Either reading as "nobody" would silently stop live automations.
    addSubscriber('anyone', { tags: [] });

    expect(await enrolSubscriber(journeyWith({}), 'anyone')).toBe('enrolled');
    expect(await enrolSubscriber(journeyWith(undefined), 'anyone')).toBe('enrolled');
  });

  it('still refuses the unmailable before it looks at the audience', async () => {
    addSubscriber('gone', { status: 'unsubscribed', tags: ['route:magnet-athx-guide'] });
    addSubscriber('noconsent', { consent: { marketing: false }, tags: ['route:magnet-athx-guide'] });

    const journey = journeyWith({ allTags: ['route:magnet-athx-guide'] });
    expect(await enrolSubscriber(journey, 'gone')).toBe('not-eligible');
    expect(await enrolSubscriber(journey, 'noconsent')).toBe('not-eligible');
  });
});

describe('athlete predicates in an entry audience', () => {
  it('reads the linked athlete and applies the predicate', async () => {
    addSubscriber('athlete', { userId: 'u1', tags: [] });
    users.u1 = { subscriptionStatus: 'trialing', completedWorkouts: 0 };

    expect(
      await enrolSubscriber(journeyWith({ athlete: { subscriptionStatus: ['trialing'] } }), 'athlete'),
    ).toBe('enrolled');

    expect(
      await enrolSubscriber(journeyWith({ athlete: { subscriptionStatus: ['active'] } }), 'athlete'),
    ).toBe('not-eligible');
  });

  it('fails an athlete predicate for somebody with no account', async () => {
    addSubscriber('lead', { tags: [] });

    expect(
      await enrolSubscriber(journeyWith({ athlete: { subscriptionStatus: ['trialing'] } }), 'lead'),
    ).toBe('not-eligible');
  });

  it('honours hasAccount: false without needing an athlete record', async () => {
    addSubscriber('lead', { tags: [] });
    addSubscriber('athlete', { userId: 'u1', tags: [] });
    users.u1 = { subscriptionStatus: 'active' };

    const journey = journeyWith({ athlete: { hasAccount: false } });
    expect(await enrolSubscriber(journey, 'lead')).toBe('enrolled');
    expect(await enrolSubscriber(journey, 'athlete')).toBe('not-eligible');
  });

  it('refuses a subscriber pointing at a deleted athlete', async () => {
    // Mailing on the strength of a record that is gone is the wrong direction
    // to fail in — the same call applyAthletePredicates makes for the batch.
    addSubscriber('stale', { userId: 'deleted', tags: [] });

    expect(
      await enrolSubscriber(journeyWith({ athlete: { subscriptionStatus: ['active'] } }), 'stale'),
    ).toBe('not-eligible');
  });
});
