import { describe, it, expect } from 'vitest';
import { isMailable, matchesAthlete } from '../segments';
import type { Subscriber } from '../types';
import type { User } from '@/models/types';

function sub(over: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 'x',
    email: 'a@b.com',
    firstName: '',
    lastName: '',
    tags: [],
    status: 'active',
    source: 'signup',
    consent: { marketing: true, at: null, method: 'test' },
    createdAt: null,
    ...over,
  };
}

function athlete(over: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    experience: 'intermediate',
    frequency: '4',
    goal: 'hybrid',
    ...over,
  };
}

describe('isMailable', () => {
  it('requires both an active status and marketing consent', () => {
    expect(isMailable(sub())).toBe(true);
  });

  it('rejects every suppressed status even when consent is still recorded', () => {
    for (const status of ['unsubscribed', 'bounced', 'complained'] as const) {
      expect(isMailable(sub({ status })), status).toBe(false);
    }
  });

  it('rejects an active subscriber who never opted into marketing', () => {
    expect(isMailable(sub({ consent: { marketing: false, at: null, method: 'test' } }))).toBe(false);
  });

  it('rejects a record with no consent object at all', () => {
    expect(isMailable(sub({ consent: undefined as never }))).toBe(false);
  });
});

describe('matchesAthlete', () => {
  it('matches when no predicates are given', () => {
    expect(matchesAthlete(athlete(), {})).toBe(true);
  });

  it('filters on subscription status', () => {
    const trialing = athlete({ subscriptionStatus: 'trial' });
    expect(matchesAthlete(trialing, { subscriptionStatus: ['trial'] })).toBe(true);
    expect(matchesAthlete(trialing, { subscriptionStatus: ['active', 'paused'] })).toBe(false);
  });

  it('treats a missing subscription status as not matching a status filter', () => {
    expect(matchesAthlete(athlete(), { subscriptionStatus: ['trial'] })).toBe(false);
  });

  it('finds athletes who have never trained', () => {
    expect(matchesAthlete(athlete({ completedWorkouts: 0 }), { maxCompletedWorkouts: 0 })).toBe(true);
    expect(matchesAthlete(athlete({ completedWorkouts: 3 }), { maxCompletedWorkouts: 0 })).toBe(false);
  });

  it('treats an absent workout count as zero', () => {
    expect(matchesAthlete(athlete(), { maxCompletedWorkouts: 0 })).toBe(true);
    expect(matchesAthlete(athlete(), { minCompletedWorkouts: 1 })).toBe(false);
  });

  it('filters on experience, goal and program', () => {
    const a = athlete({ experience: 'advanced', goal: 'endurance', programId: 'p1' });
    expect(matchesAthlete(a, { experience: ['advanced'] })).toBe(true);
    expect(matchesAthlete(a, { experience: ['beginner'] })).toBe(false);
    expect(matchesAthlete(a, { goal: ['endurance', 'hybrid'] })).toBe(true);
    expect(matchesAthlete(a, { programId: 'p1' })).toBe(true);
    expect(matchesAthlete(a, { programId: 'p2' })).toBe(false);
  });

  describe('inactivity', () => {
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

    it('matches an athlete dormant for longer than the window', () => {
      expect(matchesAthlete(athlete({ lastSeenAt: daysAgo(30) }), { inactiveForDays: 14 })).toBe(true);
    });

    it('excludes an athlete seen inside the window', () => {
      expect(matchesAthlete(athlete({ lastSeenAt: daysAgo(3) }), { inactiveForDays: 14 })).toBe(false);
    });

    it('counts a never-seen athlete as inactive — signed up and never returned', () => {
      expect(matchesAthlete(athlete(), { inactiveForDays: 14 })).toBe(true);
    });

    it('accepts a Firestore Timestamp as well as a Date', () => {
      const stamp = { toDate: () => daysAgo(30) } as unknown as Date;
      expect(matchesAthlete(athlete({ lastSeenAt: stamp }), { inactiveForDays: 14 })).toBe(true);
    });
  });

  it('requires every supplied predicate to pass, not just one', () => {
    const a = athlete({ subscriptionStatus: 'trial', completedWorkouts: 0 });
    expect(matchesAthlete(a, { subscriptionStatus: ['trial'], maxCompletedWorkouts: 0 })).toBe(true);
    expect(matchesAthlete(a, { subscriptionStatus: ['trial'], minCompletedWorkouts: 5 })).toBe(false);
  });
});
