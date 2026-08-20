// src/lib/marketing/activity.ts
//
// Athlete activity reconciliation: maintains the derived counters that
// segments and derived triggers read, and raises the behavioural events the
// journey engine advertises.
//
// Why a reconciler rather than an emit at the point of completion: workouts are
// finished by the *client* Firestore SDK, through at least four different paths
// (the active workout screen, a manual log, a Strava-linked activity, an
// imported session). There is no server handler to hook, and adding one would
// mean trusting the client to call it. Reading the session stream instead
// catches every path by construction.
//
// This also repairs a field that was never actually written. `completedWorkouts`
// existed on the User type and was read by segments, engagement tags and two
// derived triggers — but the only code that ever set it was getAllUsers(),
// which computes it in memory for the admin table and does not persist it. So
// every athlete document read back `undefined`, with three consequences:
//
//   - `churnRisk` requires `completedWorkouts >= 3` and could never fire.
//   - `noWorkoutAfterNDays` requires it to be 0, so it matched every athlete in
//     the window — including people training four times a week. The seeded
//     re-engagement journey uses that trigger.
//   - Every athlete was tagged `engagement:none`, making that whole dimension
//     of segmentation meaningless.

import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { emitMarketingEvent } from './events';

/** Singleton holding the scan cursor. */
export const ACTIVITY_STATE_DOC = 'marketingSettings/activity';

const SESSIONS = 'workoutSessions';

/**
 * Marker written on a session once it has been added to its athlete's counter.
 *
 * This is what makes counting idempotent, and it is not optional. The counter is
 * a read-add-write, the cursor only advances at the end of a page, and the cron
 * fires every five minutes with a five-minute budget — so an interrupted pass or
 * two overlapping invocations would otherwise count the same sessions twice and
 * inflate `completedWorkouts` without bound, firing milestone emails for totals
 * the athlete never reached.
 */
const COUNTED_FIELD = 'marketingCounted';

/**
 * How far back the daily sweep looks for sessions written with a past
 * `finishedAt`.
 *
 * Two completion paths do exactly that: a manual log records the day the athlete
 * says they trained, and a Strava import records the activity's own start time.
 * Both can be days old, so once the forward scan is caught up its watermark sits
 * ahead of them and they are never read. The sweep is daily rather than
 * continuous because re-reading a month of sessions every five minutes would
 * cost more than the counters are worth.
 */
const BACKDATE_LOOKBACK_DAYS = 45;

/**
 * Counts worth an email. Deliberately sparse — a note on someone's 10th
 * session reads as encouragement, one on every session reads as noise.
 */
export const WORKOUT_MILESTONES = [10, 25, 50, 100, 250] as const;

export interface ActivityState {
  /** Highest `finishedAt` processed so far. */
  lastFinishedAt: Timestamp | null;
  /**
   * Ids of sessions carrying exactly `lastFinishedAt`. The scan re-queries at
   * `>=` the watermark and skips these, so two sessions sharing a millisecond
   * cannot be lost across a page boundary — which a strict `>` would do.
   */
  lastIds: string[];
  /**
   * False while the scan is still walking history. Until it catches up, counts
   * are corrected silently and no events are raised: emitting milestones for
   * workouts finished months ago would mail the entire back catalogue a
   * congratulations note on their 50th session.
   */
  caughtUp: boolean;
}

const INITIAL_STATE: ActivityState = { lastFinishedAt: null, lastIds: [], caughtUp: false };

export async function getActivityState(): Promise<ActivityState> {
  const snap = await getAdminDb().doc(ACTIVITY_STATE_DOC).get();
  if (!snap.exists) return { ...INITIAL_STATE };
  const data = snap.data() as Partial<ActivityState>;
  return {
    lastFinishedAt: data.lastFinishedAt ?? null,
    lastIds: data.lastIds ?? [],
    caughtUp: data.caughtUp === true,
  };
}

/**
 * Which milestones a counter crossed moving from `before` to `after`.
 *
 * Pure and exported because it decides who gets mailed unattended. Returns
 * every milestone in the interval rather than just the highest: a session
 * import that jumps someone from 8 to 30 has genuinely passed both 10 and 25,
 * and silently dropping one would make the sequence depend on batch size.
 */
export function crossedMilestones(before: number, after: number): number[] {
  if (after <= before) return [];
  return WORKOUT_MILESTONES.filter((m) => m > before && m <= after);
}

export interface ActivitySyncResult {
  /** Finished sessions read this pass. */
  scanned: number;
  /** Distinct athletes whose counters moved. */
  athletes: number;
  firstWorkouts: number;
  milestones: number;
  /** True when the scan reached the end of the stream on this pass. */
  caughtUp: boolean;
  /** True when this pass was still back-filling and therefore emitted nothing. */
  backfilling: boolean;
}

/**
 * Advance the activity scan by one page.
 *
 * Backfill and steady state are the same loop, differing only in whether
 * events are raised. That is deliberate: a separate backfill script would be a
 * second code path to keep correct, and forgetting to run it would leave the
 * triggers silently dead — the exact failure this module exists to end.
 */
export async function syncWorkoutActivity(pageSize = 500): Promise<ActivitySyncResult> {
  const db = getAdminDb();
  const state = await getActivityState();

  // An inequality against the epoch rather than `!= null`: it matches every
  // session that has a real timestamp, excludes unfinished ones (Firestore
  // inequalities skip null and missing fields), and needs only the automatic
  // single-field index.
  const floor = state.lastFinishedAt ?? Timestamp.fromMillis(0);

  const snap = await db
    .collection(SESSIONS)
    .where('finishedAt', '>=', floor)
    .orderBy('finishedAt', 'asc')
    .limit(pageSize)
    .get();

  // Sessions already accounted for on the previous pass, re-read because the
  // query is inclusive of the watermark — plus anything already counted, and
  // anything skipped.
  //
  // `skipped` matters more than it looks. A skipped workout is written with a
  // real `finishedAt` *and* `skipped: true` (see the active workout screen), so
  // counting on `finishedAt` alone treats abandoning a session as completing
  // one. An athlete who skipped ten would be congratulated on their tenth
  // workout, tagged `engagement:regular`, and excluded from the re-engagement
  // journey they should be in. The rest of the codebase defines completion as
  // `finishedAt && !skipped`; so does this.
  const fresh = snap.docs.filter(
    (d) =>
      !state.lastIds.includes(d.id) &&
      d.data()?.skipped !== true &&
      d.data()?.[COUNTED_FIELD] !== true,
  );

  const result: ActivitySyncResult = {
    scanned: fresh.length,
    athletes: 0,
    firstWorkouts: 0,
    milestones: 0,
    caughtUp: state.caughtUp,
    backfilling: !state.caughtUp,
  };

  if (!fresh.length) {
    // A full page containing nothing new means every document read was already
    // accounted for — more than `pageSize` sessions share a single millisecond,
    // and the cursor cannot move past them. Declaring the scan caught up here
    // would start emitting events while history is still unread, so refuse and
    // say so instead.
    if (snap.size >= pageSize) {
      logger.error(
        `[marketing/activity] ${pageSize} sessions share one timestamp; cursor cannot advance. ` +
          'Raise pageSize to get past them.',
      );
      return result;
    }

    // Genuinely the end of the stream. The counters are now correct, so the
    // module may start raising events.
    if (!state.caughtUp) {
      await db.doc(ACTIVITY_STATE_DOC).set({ caughtUp: true }, { merge: true });
      result.caughtUp = true;
      logger.log('[marketing/activity] caught up with history; events are now live');
    }
    return result;
  }

  // Group by athlete so each one takes a single transaction regardless of how
  // many sessions they finished in this window.
  const perUser = new Map<string, string[]>();
  for (const doc of fresh) {
    const userId = doc.data().userId as string | undefined;
    if (!userId) continue;
    perUser.set(userId, [...(perUser.get(userId) ?? []), doc.id]);
  }

  for (const [userId, sessionIds] of perUser) {
    const outcome = await applyWorkoutSessions(userId, sessionIds);
    if (!outcome) continue;

    result.athletes++;

    // Only once the scan has caught up. During backfill these transitions are
    // historical fact, not news.
    if (!state.caughtUp) continue;

    if (outcome.before === 0 && outcome.after > 0) {
      await emitMarketingEvent('firstWorkoutCompleted', { userId });
      result.firstWorkouts++;
    }

    for (const milestone of crossedMilestones(outcome.before, outcome.after)) {
      await emitMarketingEvent('workoutMilestone', {
        userId,
        payload: { count: milestone },
      });
      result.milestones++;
    }
  }

  // Advance the cursor to the last session read, recording every id that shares
  // its timestamp so the inclusive re-query can skip them next pass.
  const last = fresh[fresh.length - 1];
  const lastFinishedAt = last.data().finishedAt as Timestamp;
  const lastIds = fresh
    .filter((d) => (d.data().finishedAt as Timestamp)?.isEqual?.(lastFinishedAt))
    .map((d) => d.id);

  await db.doc(ACTIVITY_STATE_DOC).set(
    {
      lastFinishedAt,
      lastIds,
      caughtUp: state.caughtUp,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  logger.log(
    `[marketing/activity] ${result.scanned} sessions, ${result.athletes} athletes` +
      (result.backfilling
        ? ' (back-filling, no events)'
        : `, ${result.firstWorkouts} first workouts, ${result.milestones} milestones`),
  );

  return result;
}

/**
 * Add an athlete's uncounted sessions to their counter and report the transition.
 *
 * Transactional because the before-and-after values are what decide whether an
 * email goes out; a bare increment would give the new total but not the old, and
 * re-reading afterwards could observe another pass's write.
 *
 * The session documents are read *inside* the transaction and marked as counted
 * in the same commit. That is what makes the whole scan idempotent: a pass that
 * dies half way, or a second cron invocation overlapping the first, re-reads
 * sessions that are already marked and adds nothing. Without it the counter
 * inflates silently and milestone emails fire on totals nobody reached.
 */
async function applyWorkoutSessions(
  userId: string,
  sessionIds: string[],
): Promise<{ before: number; after: number } | null> {
  const db = getAdminDb();
  const userRef = db.collection('users').doc(userId);

  // A transaction may read a bounded number of documents. An athlete with more
  // sessions than this in one page keeps the remainder for the next pass, which
  // the marker makes safe.
  const ids = sessionIds.slice(0, 200);
  const sessionRefs = ids.map((id) => db.collection(SESSIONS).doc(id));

  try {
    return await db.runTransaction(async (tx) => {
      // All reads before any write, as Firestore requires.
      const userSnap = await tx.get(userRef);
      // A session belonging to a deleted account. Nothing to count.
      if (!userSnap.exists) return null;

      const sessionSnaps = await tx.getAll(...sessionRefs);

      // Re-checked here rather than trusted from the outer query: between that
      // read and this transaction, another pass may have counted them.
      const uncounted = sessionSnaps.filter(
        (snap) => snap.exists && snap.data()?.[COUNTED_FIELD] !== true,
      );
      if (!uncounted.length) return null;

      const before = (userSnap.data()?.completedWorkouts as number | undefined) ?? 0;
      const after = before + uncounted.length;

      tx.update(userRef, {
        completedWorkouts: after,
        lastWorkoutAt: FieldValue.serverTimestamp(),
      });

      for (const snap of uncounted) {
        tx.update(snap.ref, { [COUNTED_FIELD]: true });
      }

      return { before, after };
    });
  } catch (err) {
    // One athlete failing must not abandon the rest of the page. Their sessions
    // stay unmarked, so the next pass picks them up — the cursor advancing past
    // them is no longer a way to lose the work.
    logger.error(
      `[marketing/activity] could not update ${userId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/**
 * Catch sessions written with a `finishedAt` in the past.
 *
 * A manual log records the day the athlete says they trained; a Strava import
 * records the activity's own start time. Both can be well below the forward
 * scan's watermark by the time they are written, so that scan will never see
 * them — the counter silently stops moving for exactly the athletes who log
 * their training after the fact.
 *
 * Runs on the daily pass. Everything it finds is already protected by the
 * counted marker, so re-reading a window costs reads and nothing else.
 */
export async function sweepBackdatedActivity(pageSize = 500): Promise<ActivitySyncResult> {
  const db = getAdminDb();
  const state = await getActivityState();

  const result: ActivitySyncResult = {
    scanned: 0,
    athletes: 0,
    firstWorkouts: 0,
    milestones: 0,
    caughtUp: state.caughtUp,
    backfilling: !state.caughtUp,
  };

  // Pointless until the forward scan has finished walking history — everything
  // would be unmarked and the sweep would duplicate its work.
  if (!state.caughtUp) return result;

  const floor = Timestamp.fromMillis(Date.now() - BACKDATE_LOOKBACK_DAYS * 86_400_000);

  const snap = await db
    .collection(SESSIONS)
    .where('finishedAt', '>=', floor)
    .orderBy('finishedAt', 'asc')
    .limit(pageSize)
    .get();

  const missed = snap.docs.filter(
    (d) => d.data()?.skipped !== true && d.data()?.[COUNTED_FIELD] !== true,
  );
  result.scanned = missed.length;
  if (!missed.length) return result;

  const perUser = new Map<string, string[]>();
  for (const doc of missed) {
    const userId = doc.data().userId as string | undefined;
    if (!userId) continue;
    perUser.set(userId, [...(perUser.get(userId) ?? []), doc.id]);
  }

  for (const [userId, sessionIds] of perUser) {
    const outcome = await applyWorkoutSessions(userId, sessionIds);
    if (!outcome) continue;

    result.athletes++;

    if (outcome.before === 0 && outcome.after > 0) {
      await emitMarketingEvent('firstWorkoutCompleted', { userId });
      result.firstWorkouts++;
    }
    for (const milestone of crossedMilestones(outcome.before, outcome.after)) {
      await emitMarketingEvent('workoutMilestone', { userId, payload: { count: milestone } });
      result.milestones++;
    }
  }

  logger.log(
    `[marketing/activity] back-dated sweep: ${result.scanned} missed sessions across ` +
      `${result.athletes} athletes`,
  );
  return result;
}
