import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  computeNextRunAt,
  isDerivedTrigger,
  isEventTrigger,
  journeyRunId,
  validateJourney,
  type JourneyStep,
} from '../journeys';
import { matchesDerivedTrigger } from '../engine';
import type { User } from '@/models/types';

afterEach(() => vi.useRealTimers());

describe('journeyRunId', () => {
  it('is deterministic, which is what makes onceOnly structural', () => {
    // Enforcing "enter at most once" by document id means a burst of duplicate
    // events collides on one write instead of racing past a read-then-check.
    expect(journeyRunId('j1', 's1')).toBe('j1_s1');
    expect(journeyRunId('j1', 's1')).toBe(journeyRunId('j1', 's1'));
  });
});

describe('trigger classification', () => {
  it('separates event triggers from derived ones', () => {
    expect(isEventTrigger('signup')).toBe(true);
    expect(isDerivedTrigger('signup')).toBe(false);
    expect(isDerivedTrigger('trialEndingSoon')).toBe(true);
    expect(isEventTrigger('trialEndingSoon')).toBe(false);
  });

  it('treats manual as neither', () => {
    expect(isEventTrigger('manual')).toBe(false);
    expect(isDerivedTrigger('manual')).toBe(false);
  });
});

describe('computeNextRunAt', () => {
  const wait = (over: Partial<Extract<JourneyStep, { type: 'wait' }>> = {}) =>
    ({ id: 'w', type: 'wait' as const, hours: 24, ...over });

  it('adds the wait duration', () => {
    const from = new Date('2026-03-01T10:00:00Z');
    expect(computeNextRunAt(wait({ hours: 48 }), from).getTime()).toBe(
      from.getTime() + 48 * 3_600_000,
    );
  });

  it('supports a zero wait, so consecutive steps run on one pass', () => {
    const from = new Date('2026-03-01T10:00:00Z');
    expect(computeNextRunAt(wait({ hours: 0 }), from).getTime()).toBe(from.getTime());
  });

  it('holds until a civil hour rather than sending in the middle of the night', () => {
    // A 24-hour wait started at 03:00 would otherwise resume at 03:00.
    const from = new Date('2026-03-01T03:00:00');
    const next = computeNextRunAt(wait({ hours: 24, untilHour: 9 }), from);
    expect(next.getHours()).toBe(9);
  });

  it('never schedules earlier than the wait asked for', () => {
    // Landing at 14:00 with untilHour 9 must roll to the next day, not back.
    const from = new Date('2026-03-01T14:00:00');
    const next = computeNextRunAt(wait({ hours: 24, untilHour: 9 }), from);
    expect(next.getTime()).toBeGreaterThan(from.getTime() + 24 * 3_600_000 - 1);
    expect(next.getHours()).toBe(9);
  });

  it('keeps the same day when the wait already lands on the target hour', () => {
    const from = new Date('2026-03-01T09:00:00');
    const next = computeNextRunAt(wait({ hours: 24, untilHour: 9 }), from);
    expect(next.getDate()).toBe(2);
    expect(next.getHours()).toBe(9);
  });
});

describe('validateJourney', () => {
  const emailStep: JourneyStep = { id: 's1', type: 'sendEmail', campaignId: 'c1' };

  it('accepts a well-formed journey', () => {
    expect(
      validateJourney({ name: 'Welcome', trigger: { type: 'signup' }, steps: [emailStep] }),
    ).toEqual([]);
  });

  it('rejects a journey that never sends anything', () => {
    const problems = validateJourney({
      name: 'Pointless',
      trigger: { type: 'signup' },
      steps: [{ id: 'w', type: 'wait', hours: 24 }],
    });
    expect(problems.some((p) => p.includes('never sends'))).toBe(true);
  });

  it('rejects an email step with no content attached', () => {
    const problems = validateJourney({
      name: 'Empty',
      trigger: { type: 'signup' },
      steps: [{ id: 's1', type: 'sendEmail' }],
    });
    expect(problems.some((p) => p.includes('no content'))).toBe(true);
  });

  it('rejects duplicate step ids', () => {
    const problems = validateJourney({
      name: 'Dupes',
      trigger: { type: 'signup' },
      steps: [emailStep, { ...emailStep }],
    });
    expect(problems.some((p) => p.includes('unique'))).toBe(true);
  });

  it('rejects a branch pointing at a step that does not exist', () => {
    // Otherwise every run taking that branch is stranded.
    const problems = validateJourney({
      name: 'Broken branch',
      trigger: { type: 'signup' },
      steps: [
        { id: 'b', type: 'branch', condition: {}, description: 'test', thenSteps: ['missing'] },
        emailStep,
      ],
    });
    expect(problems.some((p) => p.includes('missing step'))).toBe(true);
  });

  it('requires a tag for a tagAdded trigger and days for a derived one', () => {
    expect(
      validateJourney({ name: 'X', trigger: { type: 'tagAdded' }, steps: [emailStep] }),
    ).toContainEqual(expect.stringContaining('needs a tag'));

    expect(
      validateJourney({ name: 'X', trigger: { type: 'trialEndingSoon' }, steps: [emailStep] }),
    ).toContainEqual(expect.stringContaining('needs a number of days'));
  });

  it('rejects an unnamed or empty journey', () => {
    const problems = validateJourney({ name: '', trigger: { type: 'signup' }, steps: [] });
    expect(problems.some((p) => p.includes('name'))).toBe(true);
    expect(problems.some((p) => p.includes('no steps'))).toBe(true);
  });
});

describe('matchesDerivedTrigger', () => {
  const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

  const athlete = (over: Partial<User> = {}): User => ({
    id: 'u1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    experience: 'intermediate',
    frequency: '4',
    goal: 'hybrid',
    ...over,
  });

  describe('trialEndingSoon', () => {
    // TRIAL_DAYS is 14, so a trial started 11 days ago has 3 days left.
    it('matches inside the one-day window', () => {
      const user = athlete({ subscriptionStatus: 'trial', trialStartDate: daysAgo(11) });
      expect(matchesDerivedTrigger(user, 'trialEndingSoon', 3)).toBe(true);
    });

    it('does not re-match every night — the window is a day wide, not a threshold', () => {
      // With `remaining <= days` this athlete (5 days left) would match a
      // 3-day trigger every night until expiry, mailing them repeatedly.
      const user = athlete({ subscriptionStatus: 'trial', trialStartDate: daysAgo(9) });
      expect(matchesDerivedTrigger(user, 'trialEndingSoon', 3)).toBe(false);
    });

    it('ignores athletes who are not on a trial', () => {
      const user = athlete({ subscriptionStatus: 'active', trialStartDate: daysAgo(11) });
      expect(matchesDerivedTrigger(user, 'trialEndingSoon', 3)).toBe(false);
    });

    it('ignores an athlete with no trial start date', () => {
      expect(matchesDerivedTrigger(athlete({ subscriptionStatus: 'trial' }), 'trialEndingSoon', 3)).toBe(false);
    });
  });

  describe('noWorkoutAfterNDays', () => {
    it('matches an athlete who has never trained', () => {
      const user = athlete({ trialStartDate: daysAgo(7), completedWorkouts: 0 });
      expect(matchesDerivedTrigger(user, 'noWorkoutAfterNDays', 7)).toBe(true);
    });

    it('excludes anyone who has trained', () => {
      const user = athlete({ trialStartDate: daysAgo(7), completedWorkouts: 1 });
      expect(matchesDerivedTrigger(user, 'noWorkoutAfterNDays', 7)).toBe(false);
    });

    it('does not match again on later days', () => {
      const user = athlete({ trialStartDate: daysAgo(20), completedWorkouts: 0 });
      expect(matchesDerivedTrigger(user, 'noWorkoutAfterNDays', 7)).toBe(false);
    });
  });

  describe('churnRisk', () => {
    it('matches someone who was training and has stopped', () => {
      const user = athlete({ completedWorkouts: 12, lastSeenAt: daysAgo(14) });
      expect(matchesDerivedTrigger(user, 'churnRisk', 14)).toBe(true);
    });

    it('excludes a dormant signup who never started — that is a different journey', () => {
      const user = athlete({ completedWorkouts: 0, lastSeenAt: daysAgo(14) });
      expect(matchesDerivedTrigger(user, 'churnRisk', 14)).toBe(false);
    });
  });

  describe('onboardingStalled', () => {
    it('matches an athlete stuck partway through', () => {
      const user = athlete({ onboardingCompletedStep: 3, trialStartDate: daysAgo(2) });
      expect(matchesDerivedTrigger(user, 'onboardingStalled', 2)).toBe(true);
    });

    it('excludes anyone who finished onboarding', () => {
      const user = athlete({ onboardingCompletedStep: 6, trialStartDate: daysAgo(2) });
      expect(matchesDerivedTrigger(user, 'onboardingStalled', 2)).toBe(false);
    });
  });

  it('returns false for a trigger it does not handle', () => {
    expect(matchesDerivedTrigger(athlete(), 'signup', 3)).toBe(false);
  });
});
