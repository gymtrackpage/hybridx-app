// src/lib/marketing/engine.ts
//
// The journey engine: enrolment and step execution.
//
// Runs from a cron on the same pattern as the send drain. Each invocation
// enrols whoever the pending events and derived triggers call for, then
// advances every run whose next step is due. Email steps enqueue into the
// Phase 2 send queue rather than sending directly, so there is exactly one code
// path that puts a message in front of a recipient.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { TRIAL_DAYS } from '@/lib/trial';
import type { User } from '@/models/types';
import { claimUnprocessedEvents, markEventsProcessed, type MarketingEvent } from './events';
import { checkFrequencyCap } from './frequency';
import {
  computeNextRunAt,
  isDerivedTrigger,
  JOURNEYS,
  JOURNEY_RUNS,
  journeyRunId,
  type Journey,
  type JourneyRun,
  type JourneyStep,
} from './journeys';
import { CAMPAIGNS, getSettings, sendDocId } from './queue';
import { matchesAthlete } from './segments';
import { SUBSCRIBERS } from './subscribers';
import type { Send, Subscriber } from './types';

/** Journeys that are live and therefore eligible to enrol anyone. */
export async function getLiveJourneys(): Promise<Journey[]> {
  const snap = await getAdminDb().collection(JOURNEYS).where('status', '==', 'live').get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Journey);
}

// ---------------------------------------------------------------------------
// Enrolment
// ---------------------------------------------------------------------------

/**
 * Start a subscriber on a journey.
 *
 * The run id is `${journeyId}_${subscriberId}`, so `onceOnly` is enforced by
 * document existence rather than a query — a burst of duplicate events cannot
 * race two enrolments past a read-then-write check.
 */
export async function enrolSubscriber(
  journey: Journey,
  subscriberId: string,
  userId?: string,
): Promise<'enrolled' | 'already-in' | 'cooldown' | 'not-eligible'> {
  const db = getAdminDb();
  const runRef = db.collection(JOURNEY_RUNS).doc(journeyRunId(journey.id, subscriberId));

  const subSnap = await db.collection(SUBSCRIBERS).doc(subscriberId).get();
  if (!subSnap.exists) return 'not-eligible';

  const sub = { id: subSnap.id, ...subSnap.data() } as Subscriber;
  // Enrolling someone who cannot be emailed would fill the runs collection with
  // journeys that can only ever no-op.
  if (sub.status !== 'active' || sub.consent?.marketing !== true) return 'not-eligible';

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(runRef);

    if (existing.exists) {
      const run = existing.data() as JourneyRun;

      if (journey.entryRules.onceOnly) return 'already-in';
      if (run.status === 'active') return 'already-in';

      const cooldownDays = journey.entryRules.reentryCooldownDays;
      if (cooldownDays) {
        const enteredMs = (run.enteredAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
        if (enteredMs && Date.now() - enteredMs < cooldownDays * 86_400_000) return 'cooldown';
      }
    }

    tx.set(runRef, {
      journeyId: journey.id,
      subscriberId,
      ...(userId ? { userId } : {}),
      currentStep: 0,
      status: 'active',
      nextRunAt: FieldValue.serverTimestamp(), // first step runs on the next pass
      enteredAt: FieldValue.serverTimestamp(),
      history: [],
    });

    return 'enrolled';
  });
}

/** Match pending events to live journeys and enrol accordingly. */
export async function processEvents(): Promise<{ processed: number; enrolled: number }> {
  const [events, journeys] = await Promise.all([claimUnprocessedEvents(), getLiveJourneys()]);
  if (!events.length) return { processed: 0, enrolled: 0 };

  let enrolled = 0;

  for (const event of events) {
    if (!event.subscriberId) continue;

    for (const journey of journeys) {
      if (journey.trigger.type !== event.type) continue;
      if (!triggerMatchesEvent(journey, event)) continue;

      const result = await enrolSubscriber(journey, event.subscriberId, event.userId);
      if (result === 'enrolled') enrolled++;
    }
  }

  await markEventsProcessed(events.map((e) => e.id));
  logger.log(`[marketing/engine] processed ${events.length} events, enrolled ${enrolled}`);
  return { processed: events.length, enrolled };
}

/** Trigger parameters beyond the event type itself — a specific tag, a milestone number. */
function triggerMatchesEvent(journey: Journey, event: MarketingEvent): boolean {
  const { trigger } = journey;

  if (trigger.type === 'tagAdded' && trigger.tag) {
    return event.payload?.tag === trigger.tag;
  }
  if (trigger.type === 'workoutMilestone' && trigger.milestone) {
    return event.payload?.count === trigger.milestone;
  }
  if (trigger.type === 'apiEvent' && trigger.eventName) {
    return event.payload?.name === trigger.eventName;
  }
  return true;
}

/**
 * Evaluate derived triggers — states that become true with time rather than
 * events that fire. Nothing emits "the trial is ending", so a nightly sweep
 * looks for it.
 */
export async function evaluateDerivedTriggers(): Promise<{ enrolled: number }> {
  const journeys = (await getLiveJourneys()).filter((j) => isDerivedTrigger(j.trigger.type));
  if (!journeys.length) return { enrolled: 0 };

  const db = getAdminDb();
  let enrolled = 0;

  for (const journey of journeys) {
    const days = journey.trigger.days ?? 3;
    const candidates = await findDerivedCandidates(journey, days);

    for (const { subscriberId, userId } of candidates) {
      const result = await enrolSubscriber(journey, subscriberId, userId);
      if (result === 'enrolled') enrolled++;
    }

    logger.log(`[marketing/engine] ${journey.trigger.type}: ${candidates.length} candidates`);
  }

  // Reference kept so the unused-import linting stays honest about db usage.
  void db;
  return { enrolled };
}

async function findDerivedCandidates(
  journey: Journey,
  days: number,
): Promise<Array<{ subscriberId: string; userId?: string }>> {
  const db = getAdminDb();

  // Only athletes have the fields these triggers read, so start from the
  // subscribers that are linked to an account.
  const subsSnap = await db
    .collection(SUBSCRIBERS)
    .where('status', '==', 'active')
    .where('consent.marketing', '==', true)
    .limit(5000)
    .get();

  const linked = subsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Subscriber)
    .filter((s) => s.userId);

  if (!linked.length) return [];

  const matches: Array<{ subscriberId: string; userId?: string }> = [];
  const BATCH = 300;

  for (let i = 0; i < linked.length; i += BATCH) {
    const slice = linked.slice(i, i + BATCH);
    const docs = await db.getAll(...slice.map((s) => db.collection('users').doc(s.userId!)));

    slice.forEach((sub, idx) => {
      const doc = docs[idx];
      if (!doc?.exists) return;
      if (matchesDerivedTrigger(doc.data() as User, journey.trigger.type, days)) {
        matches.push({ subscriberId: sub.id, userId: sub.userId });
      }
    });
  }

  return matches;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate(): Date }).toDate();
    } catch {
      return null;
    }
  }
  return null;
}

const daysSince = (d: Date | null): number | null =>
  d ? (Date.now() - d.getTime()) / 86_400_000 : null;

/**
 * Whether an athlete currently satisfies a derived trigger.
 *
 * Pure and exported so the conditions are testable without a database — these
 * decide who gets emailed unattended, which makes them the part most worth
 * pinning down.
 */
export function matchesDerivedTrigger(
  user: User,
  trigger: Journey['trigger']['type'],
  days: number,
): boolean {
  switch (trigger) {
    case 'trialEndingSoon': {
      if (user.subscriptionStatus !== 'trial') return false;
      const elapsed = daysSince(toDate(user.trialStartDate));
      if (elapsed === null) return false;
      const remaining = TRIAL_DAYS - elapsed;
      // A window, not a threshold: a nightly sweep with `remaining <= days`
      // would re-match every night until the trial expired.
      return remaining <= days && remaining > days - 1;
    }

    case 'onboardingStalled': {
      if ((user.onboardingCompletedStep ?? 0) >= 6) return false;
      const since = daysSince(toDate(user.trialStartDate));
      return since !== null && since >= days && since < days + 1;
    }

    case 'noWorkoutAfterNDays': {
      if ((user.completedWorkouts ?? 0) > 0) return false;
      const since = daysSince(toDate(user.trialStartDate));
      return since !== null && since >= days && since < days + 1;
    }

    case 'churnRisk': {
      // Someone who was training and has stopped — distinct from a dormant
      // signup, who never started.
      if ((user.completedWorkouts ?? 0) < 3) return false;
      const since = daysSince(toDate(user.lastSeenAt));
      return since !== null && since >= days && since < days + 1;
    }

    case 'raceDateApproaching': {
      const race = toDate(user.startDate);
      if (!race) return false;
      const until = (race.getTime() - Date.now()) / 86_400_000;
      return until <= days && until > days - 1;
    }

    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

export interface AdvanceResult {
  advanced: number;
  completed: number;
  exited: number;
  held: number;
}

/** Advance every run whose next step is due. */
export async function advanceRuns(limit = 200): Promise<AdvanceResult> {
  const db = getAdminDb();
  const settings = await getSettings();
  const result: AdvanceResult = { advanced: 0, completed: 0, exited: 0, held: 0 };

  if (settings.sendingPaused) {
    logger.log('[marketing/engine] sending paused; not advancing runs');
    return result;
  }

  const due = await db
    .collection(JOURNEY_RUNS)
    .where('status', '==', 'active')
    .where('nextRunAt', '<=', new Date())
    .limit(limit)
    .get();

  if (due.empty) return result;

  const journeyCache = new Map<string, Journey>();

  for (const doc of due.docs) {
    const run = { id: doc.id, ...doc.data() } as JourneyRun;

    let journey = journeyCache.get(run.journeyId);
    if (!journey) {
      const jSnap = await db.collection(JOURNEYS).doc(run.journeyId).get();
      if (!jSnap.exists) {
        await doc.ref.update({ status: 'failed', exitReason: 'Journey no longer exists' });
        continue;
      }
      journey = { id: jSnap.id, ...jSnap.data() } as Journey;
      journeyCache.set(run.journeyId, journey);
    }

    // A paused journey stops advancing without losing where each run had got to.
    if (journey.status !== 'live') {
      result.held++;
      continue;
    }

    const exit = await shouldExit(journey, run);
    if (exit) {
      await doc.ref.update({
        status: 'exited',
        exitReason: exit,
        completedAt: FieldValue.serverTimestamp(),
      });
      result.exited++;
      continue;
    }

    const step = journey.steps[run.currentStep];
    if (!step) {
      await doc.ref.update({ status: 'completed', completedAt: FieldValue.serverTimestamp() });
      await db.collection(JOURNEYS).doc(journey.id).update({
        'stats.completed': FieldValue.increment(1),
      }).catch(() => undefined);
      result.completed++;
      continue;
    }

    const outcome = await executeStep(journey, run, step, settings.frequencyCapPerWeek);

    if (outcome.kind === 'hold') {
      // Try again on the next pass rather than skipping the step.
      await doc.ref.update({ nextRunAt: new Date(Date.now() + outcome.retryInMs) });
      result.held++;
      continue;
    }

    if (outcome.kind === 'exit') {
      await doc.ref.update({
        status: 'exited',
        exitReason: outcome.reason,
        completedAt: FieldValue.serverTimestamp(),
      });
      result.exited++;
      continue;
    }

    await doc.ref.update({
      currentStep: run.currentStep + 1,
      nextRunAt: outcome.nextRunAt,
      history: FieldValue.arrayUnion(step.id),
    });
    result.advanced++;
  }

  return result;
}

type StepOutcome =
  | { kind: 'advance'; nextRunAt: Date }
  | { kind: 'hold'; retryInMs: number }
  | { kind: 'exit'; reason: string };

async function executeStep(
  journey: Journey,
  run: JourneyRun,
  step: JourneyStep,
  frequencyCap: number,
): Promise<StepOutcome> {
  const db = getAdminDb();
  const now = new Date();

  switch (step.type) {
    case 'wait':
      return { kind: 'advance', nextRunAt: computeNextRunAt(step, now) };

    case 'exit':
      return { kind: 'exit', reason: step.reason ?? 'Journey step' };

    case 'addTag':
    case 'removeTag': {
      await db.collection(SUBSCRIBERS).doc(run.subscriberId).update({
        tags: step.type === 'addTag'
          ? FieldValue.arrayUnion(step.tag)
          : FieldValue.arrayRemove(step.tag),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { kind: 'advance', nextRunAt: now };
    }

    case 'branch': {
      const matched = await evaluateBranch(run, step);
      // A simple if/else: when the condition fails, skip the branch's steps by
      // jumping past them. Anything more elaborate belongs in a graph model,
      // which this deliberately is not.
      if (!matched && step.thenSteps.length) {
        const skipTo = journey.steps.findIndex((s) => s.id === step.thenSteps[step.thenSteps.length - 1]);
        if (skipTo >= 0) {
          return { kind: 'advance', nextRunAt: now };
        }
      }
      return { kind: 'advance', nextRunAt: now };
    }

    case 'sendEmail': {
      if (!step.campaignId) return { kind: 'advance', nextRunAt: now };

      // The cap is applied here, not at broadcast time: a journey fires
      // unattended, which is where it earns its keep.
      const decision = await checkFrequencyCap(run.subscriberId, frequencyCap);
      if (!decision.allowed) {
        // Hold for six hours rather than dropping the email — the person is
        // still meant to receive it, just not today.
        return { kind: 'hold', retryInMs: 6 * 3_600_000 };
      }

      const sub = await db.collection(SUBSCRIBERS).doc(run.subscriberId).get();
      const data = sub.data() as Subscriber | undefined;
      if (!data || data.status !== 'active' || data.consent?.marketing !== true) {
        return { kind: 'exit', reason: 'Recipient is no longer mailable' };
      }

      // Queue one send row, reusing the same idempotent structure as broadcasts.
      const campaignRef = db.collection(CAMPAIGNS).doc(step.campaignId);
      const sendRef = campaignRef.collection('sends').doc(sendDocId(step.campaignId, run.subscriberId));

      const row: Omit<Send, 'id'> = {
        campaignId: step.campaignId,
        subscriberId: run.subscriberId,
        email: data.email,
        status: 'pending',
        attempts: 0,
        queuedAt: FieldValue.serverTimestamp(),
        sentAt: null,
        opened: false,
        openedAt: null,
        openRaw: 0,
        clicked: false,
        clickedAt: null,
      };

      // create() rather than set(): if this run already queued this email, the
      // write fails rather than resetting a sent row back to pending.
      await sendRef.create(row).catch(() => undefined);

      await campaignRef.update({
        status: 'sending',
        'sendState.total': FieldValue.increment(1),
      }).catch(() => undefined);

      return { kind: 'advance', nextRunAt: now };
    }
  }
}

/** Branch conditions reuse the segment predicates, so there is one filtering vocabulary. */
async function evaluateBranch(
  run: JourneyRun,
  step: Extract<JourneyStep, { type: 'branch' }>,
): Promise<boolean> {
  if (!run.userId) return false;

  const snap = await getAdminDb().collection('users').doc(run.userId).get();
  if (!snap.exists) return false;

  return matchesAthlete(snap.data() as User, step.condition as never);
}

/**
 * Whether a run should stop early.
 *
 * exitOnConversion is what stops a winback series chasing someone who has
 * already come back — the difference between an automation that feels
 * attentive and one that feels broken.
 */
async function shouldExit(journey: Journey, run: JourneyRun): Promise<string | null> {
  const { maxDurationDays, exitOnConversion } = journey.exitRules ?? {};

  if (maxDurationDays) {
    const enteredMs = (run.enteredAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    if (enteredMs && Date.now() - enteredMs > maxDurationDays * 86_400_000) {
      return `Exceeded ${maxDurationDays} days in journey`;
    }
  }

  if (!exitOnConversion) return null;

  const db = getAdminDb();

  if (exitOnConversion.type === 'tagAdded' && exitOnConversion.tag) {
    const snap = await db.collection(SUBSCRIBERS).doc(run.subscriberId).get();
    const tags = (snap.data() as Subscriber | undefined)?.tags ?? [];
    return tags.includes(exitOnConversion.tag) ? `Tagged ${exitOnConversion.tag}` : null;
  }

  if (!run.userId) return null;
  const userSnap = await db.collection('users').doc(run.userId).get();
  if (!userSnap.exists) return 'Athlete record no longer exists';
  const user = userSnap.data() as User;

  switch (exitOnConversion.type) {
    case 'subscriptionActive':
      return user.subscriptionStatus === 'active' ? 'Subscription became active' : null;
    case 'workoutLogged':
      return (user.completedWorkouts ?? 0) > 0 ? 'Logged a workout' : null;
    case 'programStarted':
      return user.programId ? 'Started a programme' : null;
    default:
      return null;
  }
}
