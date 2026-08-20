import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  ALL_TRIGGERS,
  TRIGGER_DESCRIPTIONS,
  computeNextRunAt,
  isDerivedTrigger,
  isEventTrigger,
  journeyRunId,
  validateJourney,
  type Journey,
  type JourneyStep,
} from '../journeys';
import { matchesDerivedTrigger, triggerMatchesEvent } from '../engine';
import type { MarketingEvent } from '../events';
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

  describe('branch contiguity — what makes skip-past-thenSteps sound', () => {
    const wait: JourneyStep = { id: 'w1', type: 'wait', hours: 24 };

    it('accepts a branch immediately followed by its own steps, in order', () => {
      const problems = validateJourney({
        name: 'Good branch',
        trigger: { type: 'signup' },
        steps: [
          { id: 'b', type: 'branch', condition: {}, description: 'trialists', thenSteps: ['s1', 'w1'] },
          emailStep,
          wait,
          { id: 's2', type: 'sendEmail', campaignId: 'c2' },
        ],
      });
      expect(problems).toEqual([]);
    });

    it('rejects thenSteps that are not the steps immediately following', () => {
      // The engine skips a failed branch by jumping past the last thenStep;
      // if the thenSteps live elsewhere in the list that jump would skip the
      // wrong steps entirely.
      const problems = validateJourney({
        name: 'Scattered branch',
        trigger: { type: 'signup' },
        steps: [
          { id: 'b', type: 'branch', condition: {}, description: 'trialists', thenSteps: ['s2'] },
          emailStep, // s1 sits between the branch and its target
          { id: 's2', type: 'sendEmail', campaignId: 'c2' },
        ],
      });
      expect(problems.some((p) => p.includes('immediately followed'))).toBe(true);
    });

    it('rejects thenSteps listed out of order', () => {
      const problems = validateJourney({
        name: 'Reordered branch',
        trigger: { type: 'signup' },
        steps: [
          { id: 'b', type: 'branch', condition: {}, description: 'trialists', thenSteps: ['w1', 's1'] },
          emailStep,
          wait,
        ],
      });
      expect(problems.some((p) => p.includes('immediately followed'))).toBe(true);
    });

    it('rejects a branch with nothing to run when it matches', () => {
      const problems = validateJourney({
        name: 'Empty branch',
        trigger: { type: 'signup' },
        steps: [
          { id: 'b', type: 'branch', condition: {}, description: 'trialists', thenSteps: [] },
          emailStep,
        ],
      });
      expect(problems.some((p) => p.includes('no steps to run'))).toBe(true);
    });
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

describe('triggerMatchesEvent — narrowing a trigger to one intake route', () => {
  const journey = (trigger: Journey['trigger']): Journey =>
    ({ id: 'j1', trigger, steps: [] }) as unknown as Journey;

  const event = (payload?: Record<string, unknown>): MarketingEvent =>
    ({ id: 'e1', type: 'consentGranted', processed: false, at: null, payload }) as MarketingEvent;

  it('matches any route when the trigger does not name one', () => {
    const j = journey({ type: 'consentGranted' });
    expect(triggerMatchesEvent(j, event({ route: 'magnet-vo2max' }))).toBe(true);
    expect(triggerMatchesEvent(j, event())).toBe(true);
  });

  it('matches when the event carries the named route', () => {
    const j = journey({ type: 'consentGranted', route: 'magnet-vo2max' });
    expect(triggerMatchesEvent(j, event({ route: 'magnet-vo2max' }))).toBe(true);
  });

  it('does NOT enrol someone who arrived by a different route', () => {
    // The whole point of route narrowing: a VO2max welcome sequence must not
    // greet someone who came in through the race card.
    const j = journey({ type: 'consentGranted', route: 'magnet-vo2max' });
    expect(triggerMatchesEvent(j, event({ route: 'magnet-race-card' }))).toBe(false);
  });

  it('does not match an event with no route at all when one is required', () => {
    const j = journey({ type: 'consentGranted', route: 'magnet-vo2max' });
    expect(triggerMatchesEvent(j, event())).toBe(false);
    expect(triggerMatchesEvent(j, event({}))).toBe(false);
  });

  it('applies the route filter alongside a tag filter, not instead of it', () => {
    const j = journey({ type: 'tagAdded', tag: 'vip', route: 'app-homepage' });
    expect(triggerMatchesEvent(j, { ...event({ route: 'app-homepage', tag: 'vip' }), type: 'tagAdded' })).toBe(true);
    // Right route, wrong tag.
    expect(triggerMatchesEvent(j, { ...event({ route: 'app-homepage', tag: 'other' }), type: 'tagAdded' })).toBe(false);
    // Right tag, wrong route.
    expect(triggerMatchesEvent(j, { ...event({ route: 'beta-android', tag: 'vip' }), type: 'tagAdded' })).toBe(false);
  });
});

describe('validateJourney — segmentEntered needs something to watch', () => {
  const emailStep: JourneyStep = { id: 's1', type: 'sendEmail', campaignId: 'c1' };

  it('rejects a segmentEntered trigger with no segment', () => {
    // This is the case that used to pass validation and then silently enrol
    // nobody: the days check exempts segmentEntered, and the engine had no
    // case for it, so the journey looked live and did nothing for ever.
    const problems = validateJourney({
      name: 'Churn risk',
      trigger: { type: 'segmentEntered' },
      steps: [emailStep],
    });
    expect(problems.some((p) => p.includes('saved segment'))).toBe(true);
  });

  it('accepts one that names a segment', () => {
    expect(
      validateJourney({
        name: 'Churn risk',
        trigger: { type: 'segmentEntered', segmentId: 'seg-1' },
        steps: [emailStep],
      }),
    ).toEqual([]);
  });

  it('still does not demand a day count from it', () => {
    const problems = validateJourney({
      name: 'Churn risk',
      trigger: { type: 'segmentEntered', segmentId: 'seg-1' },
      steps: [emailStep],
    });
    expect(problems.some((p) => p.includes('number of days'))).toBe(false);
  });
});

describe('the trigger vocabulary only offers triggers something can raise', () => {
  it('no longer offers streakMilestone or programCompleted', () => {
    // Streaks are computed in the browser and never stored; a cleared
    // programId cannot be told apart from switching plans or giving up. Both
    // were removed rather than left as options that fail quietly.
    expect(ALL_TRIGGERS).not.toContain('streakMilestone');
    expect(ALL_TRIGGERS).not.toContain('programCompleted');
  });

  it('describes every trigger it offers', () => {
    for (const trigger of ALL_TRIGGERS) {
      expect(TRIGGER_DESCRIPTIONS[trigger], trigger).toBeTruthy();
    }
  });

  it('offers the intake triggers the capture path raises', () => {
    expect(ALL_TRIGGERS).toContain('subscriberCreated');
    expect(ALL_TRIGGERS).toContain('consentGranted');
  });
});
