// src/lib/marketing/journeys.ts
//
// The automation model.
//
// A journey is a trigger plus an ordered list of steps. A one-off broadcast is
// simply a journey with a `manual` trigger and a single email step, so
// "send this now" and "send this whenever someone's trial is ending" are the
// same machinery rather than two systems that drift apart.
//
// Modelled on MailChimp's Customer Journeys — trigger, wait, branch, send,
// tag — with the trigger vocabulary specialised to this business. That
// specialisation is the point: `trialEndingSoon` and `noWorkoutAfterNDays` are
// the automations a training app actually needs, and a generic tool can only
// offer them if you build the plumbing to feed it events.

import { z } from 'zod';
import type { SegmentDefinition } from './segments';

// ---------------------------------------------------------------------------
// Triggers
// ---------------------------------------------------------------------------

/**
 * Triggers split into two kinds:
 *
 *   - *Event* triggers fire from something that happened, emitted by app code
 *     at the moment it happens (signup, subscription cancelled, workout logged).
 *   - *Derived* triggers describe a state that becomes true with the passage of
 *     time (a trial ending, dormancy). Nothing "happens" to emit them, so a
 *     nightly sweep evaluates them instead.
 */
export const EVENT_TRIGGERS = [
  'subscriberCreated',
  'signup',
  'tagAdded',
  'firstWorkoutCompleted',
  'workoutMilestone',
  'streakMilestone',
  'programStarted',
  'programCompleted',
  'subscriptionCanceled',
  'paymentFailed',
  'stravaConnected',
  'garminConnected',
  'apiEvent',
] as const;

export const DERIVED_TRIGGERS = [
  'trialEndingSoon',
  'onboardingStalled',
  'noWorkoutAfterNDays',
  'churnRisk',
  'raceDateApproaching',
  'segmentEntered',
] as const;

export const MANUAL_TRIGGERS = ['manual', 'scheduled'] as const;

export const ALL_TRIGGERS = [...MANUAL_TRIGGERS, ...EVENT_TRIGGERS, ...DERIVED_TRIGGERS] as const;

export type TriggerType = (typeof ALL_TRIGGERS)[number];
export type EventTriggerType = (typeof EVENT_TRIGGERS)[number];
export type DerivedTriggerType = (typeof DERIVED_TRIGGERS)[number];

export function isEventTrigger(t: TriggerType): t is EventTriggerType {
  return (EVENT_TRIGGERS as readonly string[]).includes(t);
}

export function isDerivedTrigger(t: TriggerType): t is DerivedTriggerType {
  return (DERIVED_TRIGGERS as readonly string[]).includes(t);
}

/** Human-readable descriptions, shown in the studio and given to the composer flow. */
export const TRIGGER_DESCRIPTIONS: Record<TriggerType, string> = {
  manual: 'Sent by hand from the campaigns screen.',
  scheduled: 'Sent once at a chosen date and time.',
  subscriberCreated: 'Someone joins the mailing list from any source.',
  signup: 'An athlete creates a HYBRIDX account.',
  tagAdded: 'A specific tag is applied to a subscriber.',
  firstWorkoutCompleted: 'An athlete logs their first workout.',
  workoutMilestone: 'An athlete reaches a workout count milestone (10th, 50th, 100th).',
  streakMilestone: 'An athlete reaches a training-streak milestone.',
  programStarted: 'An athlete starts a training programme.',
  programCompleted: 'An athlete finishes a training programme.',
  subscriptionCanceled: 'An athlete cancels their subscription.',
  paymentFailed: 'A subscription payment fails.',
  stravaConnected: 'An athlete connects Strava.',
  garminConnected: 'An athlete connects Garmin.',
  apiEvent: 'A custom event raised by application code.',
  trialEndingSoon: 'An athlete’s free trial ends within N days.',
  onboardingStalled: 'An athlete did not finish onboarding within N days.',
  noWorkoutAfterNDays: 'An athlete has logged no workout for N days.',
  churnRisk: 'An athlete’s engagement has dropped sharply.',
  raceDateApproaching: 'An athlete’s target race is N days away.',
  segmentEntered: 'A subscriber starts matching a saved segment.',
};

const triggerSchema = z.object({
  type: z.enum(ALL_TRIGGERS),
  /** Parameter for triggers that take one, e.g. days for trialEndingSoon. */
  days: z.number().int().positive().optional(),
  tag: z.string().optional(),
  milestone: z.number().int().positive().optional(),
  eventName: z.string().optional(),
});

export type JourneyTrigger = z.infer<typeof triggerSchema>;

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

const sendEmailStep = z.object({
  id: z.string(),
  type: z.literal('sendEmail'),
  /** Campaign holding this step's content. Created alongside the journey. */
  campaignId: z.string().optional(),
  /** Brief the draft-email flow works from, kept so the email can be regenerated. */
  brief: z.string().optional(),
});

const waitStep = z.object({
  id: z.string(),
  type: z.literal('wait'),
  hours: z.number().min(0).max(24 * 90),
  /**
   * Hold until a civil hour, so a wait that lands at 03:00 does not send then.
   * Local to the send timezone, not the recipient's — per-recipient send-time
   * optimisation is deliberately out of scope for now.
   */
  untilHour: z.number().int().min(0).max(23).optional(),
});

const branchStep = z.object({
  id: z.string(),
  type: z.literal('branch'),
  /** Evaluated against the subscriber and their athlete record. */
  condition: z.record(z.string(), z.unknown()),
  description: z.string(),
  /** Step ids to run when the condition holds; otherwise the journey continues. */
  thenSteps: z.array(z.string()).default([]),
});

const tagStep = z.object({
  id: z.string(),
  type: z.enum(['addTag', 'removeTag']),
  tag: z.string(),
});

const exitStep = z.object({
  id: z.string(),
  type: z.literal('exit'),
  reason: z.string().optional(),
});

export const journeyStepSchema = z.discriminatedUnion('type', [
  sendEmailStep,
  waitStep,
  branchStep,
  tagStep,
  exitStep,
]);

export type JourneyStep = z.infer<typeof journeyStepSchema>;

// ---------------------------------------------------------------------------
// Journey
// ---------------------------------------------------------------------------

export type JourneyStatus = 'draft' | 'live' | 'paused' | 'archived';

export interface JourneyEntryRules {
  /**
   * Enter at most once, ever. Enforced by the run document's deterministic id
   * rather than a query, so a burst of duplicate events cannot race past it.
   */
  onceOnly: boolean;
  /** When re-entry is allowed, the minimum gap between entries. */
  reentryCooldownDays?: number;
  /** Extra conditions beyond the trigger itself. */
  segment?: SegmentDefinition;
}

export interface JourneyExitRules {
  /**
   * Stop the journey when the reason for it goes away — a winback should end
   * the moment someone resubscribes, not keep chasing them for another week.
   */
  exitOnConversion?: {
    type: 'subscriptionActive' | 'workoutLogged' | 'programStarted' | 'tagAdded';
    tag?: string;
  };
  /** Hard cap on how long anyone stays in the journey. */
  maxDurationDays?: number;
}

export interface Journey {
  id: string;
  name: string;
  goal: string;
  trigger: JourneyTrigger;
  entryRules: JourneyEntryRules;
  exitRules: JourneyExitRules;
  steps: JourneyStep[];
  status: JourneyStatus;
  stats?: {
    entered: number;
    completed: number;
    exitedEarly: number;
  };
  createdAt?: unknown;
  updatedAt?: unknown;
  activatedAt?: unknown;
}

export type RunStatus = 'active' | 'completed' | 'exited' | 'failed';

export interface JourneyRun {
  id: string;
  journeyId: string;
  subscriberId: string;
  userId?: string;
  /** Index into `steps`. */
  currentStep: number;
  status: RunStatus;
  /** When the engine should next look at this run. */
  nextRunAt: unknown;
  enteredAt: unknown;
  completedAt?: unknown;
  exitReason?: string;
  /** Step ids already executed, so a replay cannot repeat a send. */
  history: string[];
}

/** Deterministic run id — this is what makes `onceOnly` structural. */
export function journeyRunId(journeyId: string, subscriberId: string): string {
  return `${journeyId}_${subscriberId}`;
}

export const JOURNEYS = 'marketingJourneys';
export const JOURNEY_RUNS = 'marketingJourneyRuns';

/**
 * Compute when a wait step should resume.
 *
 * Exported and pure so the scheduling rules are testable without a clock or a
 * database — the part of an automation engine most likely to be subtly wrong.
 */
export function computeNextRunAt(step: Extract<JourneyStep, { type: 'wait' }>, from: Date): Date {
  const target = new Date(from.getTime() + step.hours * 3_600_000);

  if (step.untilHour === undefined) return target;

  // Move forward to the next occurrence of the requested hour. Never backwards:
  // that would send earlier than the author asked for.
  const adjusted = new Date(target);
  adjusted.setMinutes(0, 0, 0);

  if (adjusted.getHours() < step.untilHour) {
    adjusted.setHours(step.untilHour);
  } else if (adjusted.getHours() > step.untilHour) {
    adjusted.setDate(adjusted.getDate() + 1);
    adjusted.setHours(step.untilHour);
  } else {
    adjusted.setHours(step.untilHour);
  }

  return adjusted;
}

/** Validate a journey before it may go live. */
export function validateJourney(journey: Pick<Journey, 'steps' | 'trigger' | 'name'>): string[] {
  const problems: string[] = [];

  if (!journey.name?.trim()) problems.push('The journey needs a name.');
  if (!journey.steps?.length) problems.push('The journey has no steps.');

  const emailSteps = journey.steps.filter((s) => s.type === 'sendEmail');
  if (!emailSteps.length) problems.push('The journey never sends an email.');

  for (const step of emailSteps) {
    if (!('campaignId' in step) || !step.campaignId) {
      problems.push('An email step has no content attached.');
      break;
    }
  }

  const ids = journey.steps.map((s) => s.id);
  if (new Set(ids).size !== ids.length) problems.push('Step ids must be unique.');

  // Branch semantics are "if/else over the next N steps": a run that matches
  // falls into the thenSteps, a run that does not jumps past the last of them.
  // That only works when thenSteps are exactly the contiguous steps following
  // the branch — so enforce it here rather than trusting every author (human
  // or AI) to arrange them correctly.
  const idSet = new Set(ids);
  journey.steps.forEach((step, index) => {
    if (step.type !== 'branch') return;

    if (!step.thenSteps.length) {
      problems.push(`Branch "${step.description}" has no steps to run when it matches.`);
      return;
    }
    for (const target of step.thenSteps) {
      if (!idSet.has(target)) {
        problems.push(`Branch "${step.description}" points at a missing step.`);
        return;
      }
    }

    const following = journey.steps.slice(index + 1, index + 1 + step.thenSteps.length).map((s) => s.id);
    const contiguous =
      following.length === step.thenSteps.length &&
      following.every((id, i) => id === step.thenSteps[i]);
    if (!contiguous) {
      problems.push(
        `Branch "${step.description}" must be immediately followed by its own steps, in order.`,
      );
    }
  });

  if (journey.trigger.type === 'tagAdded' && !journey.trigger.tag) {
    problems.push('A tagAdded trigger needs a tag.');
  }
  if (isDerivedTrigger(journey.trigger.type) && journey.trigger.type !== 'segmentEntered'
      && !journey.trigger.days) {
    problems.push(`A ${journey.trigger.type} trigger needs a number of days.`);
  }

  return problems;
}
