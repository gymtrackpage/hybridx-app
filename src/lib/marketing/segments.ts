// src/lib/marketing/segments.ts
//
// Resolves a campaign's audience.
//
// The important property here is that *every* path out of this module has
// already applied the mailability filter. Callers get a list of people it is
// lawful and safe to email, or they get nothing — there is no "raw audience"
// export that a future caller could reach for by mistake.
//
// Segments combine two sources: tags on the subscriber record, and predicates
// over the linked athlete's `users` document. The latter is the reason this
// system is worth merging into hybridx-app at all — "athletes on a trial that
// ends this week who have never logged a workout" is not expressible with tags.

import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import type { User } from '@/models/types';
import { SUBSCRIBERS } from './subscribers';
import type { Subscriber } from './types';

/** Predicates evaluated against the linked athlete record. */
export interface AthletePredicates {
  subscriptionStatus?: User['subscriptionStatus'][];
  experience?: User['experience'][];
  goal?: User['goal'][];
  /** Athletes with at most this many completed workouts (0 finds the never-started). */
  maxCompletedWorkouts?: number;
  minCompletedWorkouts?: number;
  /** Last seen strictly more than N days ago — the dormancy filter. */
  inactiveForDays?: number;
  /** Only athletes currently on this program. */
  programId?: string;
  /** Restrict to people who do (or do not) have a HybridX account. */
  hasAccount?: boolean;
}

export interface SegmentDefinition {
  /** Subscriber must carry at least one of these tags. Empty means "any". */
  anyTags?: string[];
  /** Subscriber must carry every one of these tags. */
  allTags?: string[];
  /** Subscriber must carry none of these tags. */
  noneTags?: string[];
  athlete?: AthletePredicates;
}

export interface ResolvedAudience {
  subscribers: Subscriber[];
  /** How many were dropped, and why — surfaced in the pre-send checklist. */
  excluded: {
    suppressed: number;
    noConsent: number;
    failedPredicates: number;
  };
}

/**
 * A subscriber may be mailed a campaign only if they are active *and* have
 * given marketing consent. Both are required: status covers unsubscribes,
 * bounces and complaints; consent covers people who are on the list for
 * transactional reasons but never opted into marketing.
 */
export function isMailable(sub: Subscriber): boolean {
  return sub.status === 'active' && sub.consent?.marketing === true;
}

/**
 * Resolve a segment to the people who may be emailed.
 *
 * Tag filtering runs in Firestore where it can (`array-contains-any` on
 * `anyTags`); `allTags`, `noneTags` and every athlete predicate are applied in
 * memory. That split is deliberate — Firestore permits only one
 * array-contains-any per query, and composing the rest server-side would need a
 * composite index per predicate combination for a query that runs a handful of
 * times a day over a list measured in thousands.
 */
export async function resolveSegment(def: SegmentDefinition): Promise<ResolvedAudience> {
  const db = getAdminDb();

  let query = db.collection(SUBSCRIBERS).where('status', '==', 'active');
  if (def.anyTags?.length) {
    // Firestore caps array-contains-any at 30 values.
    query = query.where('tags', 'array-contains-any', def.anyTags.slice(0, 30));
  }

  const snap = await query.get();
  const candidates = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Subscriber);

  const excluded = { suppressed: 0, noConsent: 0, failedPredicates: 0 };
  const afterTags: Subscriber[] = [];

  for (const sub of candidates) {
    // The status filter is in the query, but consent is not — a subscriber can
    // be active without having opted into marketing.
    if (!isMailable(sub)) {
      excluded.noConsent++;
      continue;
    }

    if (!matchesSegmentTags(sub, def)) {
      excluded.failedPredicates++;
      continue;
    }
    afterTags.push(sub);
  }

  if (!def.athlete) {
    return { subscribers: afterTags, excluded };
  }

  const subscribers = await applyAthletePredicates(afterTags, def.athlete, excluded);
  return { subscribers, excluded };
}

/**
 * Filter by the linked athlete record. Athlete documents are fetched in
 * batches with getAll rather than one lookup per subscriber, which keeps a
 * few-thousand-person segment to a few dozen round trips.
 */
async function applyAthletePredicates(
  subs: Subscriber[],
  pred: AthletePredicates,
  excluded: ResolvedAudience['excluded'],
): Promise<Subscriber[]> {
  const db = getAdminDb();

  // Subscribers with no account can be decided without a lookup.
  const withAccount = subs.filter((s) => s.userId);
  const withoutAccount = subs.filter((s) => !s.userId);

  const kept: Subscriber[] = [];

  if (pred.hasAccount === false) {
    // Only non-athletes wanted; no athlete predicate can apply to them.
    excluded.failedPredicates += withAccount.length;
    return withoutAccount;
  }
  if (withoutAccount.length) {
    excluded.failedPredicates += withoutAccount.length;
  }

  const BATCH = 300; // getAll is variadic; keep each call comfortably bounded.
  for (let i = 0; i < withAccount.length; i += BATCH) {
    const slice = withAccount.slice(i, i + BATCH);
    const refs = slice.map((s) => db.collection('users').doc(s.userId as string));
    const docs = await db.getAll(...refs);

    slice.forEach((sub, idx) => {
      const doc = docs[idx];
      if (!doc?.exists) {
        // Subscriber points at a deleted athlete — treat as failing any
        // athlete predicate rather than mailing on stale data.
        excluded.failedPredicates++;
        return;
      }
      if (matchesAthlete(doc.data() as User, pred)) kept.push(sub);
      else excluded.failedPredicates++;
    });
  }

  logger.log(`[marketing] segment resolved: ${kept.length} of ${subs.length} candidates`);
  return kept;
}

/** Evaluate the athlete predicates against one user document. */
export function matchesAthlete(user: User, pred: AthletePredicates): boolean {
  if (pred.subscriptionStatus?.length) {
    if (!user.subscriptionStatus || !pred.subscriptionStatus.includes(user.subscriptionStatus)) {
      return false;
    }
  }
  if (pred.experience?.length && !pred.experience.includes(user.experience)) return false;
  if (pred.goal?.length && !pred.goal.includes(user.goal)) return false;
  if (pred.programId && user.programId !== pred.programId) return false;

  const completed = user.completedWorkouts ?? 0;
  if (pred.maxCompletedWorkouts !== undefined && completed > pred.maxCompletedWorkouts) return false;
  if (pred.minCompletedWorkouts !== undefined && completed < pred.minCompletedWorkouts) return false;

  if (pred.inactiveForDays !== undefined) {
    const lastSeen = toDate(user.lastSeenAt);
    // Never-seen counts as inactive: they signed up and never came back, which
    // is exactly who a dormancy campaign is for.
    if (lastSeen) {
      const daysSince = (Date.now() - lastSeen.getTime()) / 86_400_000;
      if (daysSince < pred.inactiveForDays) return false;
    }
  }

  return true;
}

/**
 * Does one subscriber's tags satisfy a segment?
 *
 * Factored out of resolveSegment rather than written twice. The batch path
 * narrows `anyTags` in the Firestore query and the rest in memory; the
 * single-subscriber path below has no query to lean on and must check all
 * three. Two copies of this rule would be two chances for a journey's audience
 * to mean one thing when it is previewed and another when it sends.
 *
 * Re-checking `anyTags` on the batch path is a deliberate no-op: the query has
 * already guaranteed it, and asking again costs nothing and keeps one answer.
 */
export function matchesSegmentTags(sub: Subscriber, def: SegmentDefinition): boolean {
  const tags = sub.tags ?? [];
  if (def.anyTags?.length && !def.anyTags.some((t) => tags.includes(t))) return false;
  if (def.allTags?.length && !def.allTags.every((t) => tags.includes(t))) return false;
  if (def.noneTags?.length && def.noneTags.some((t) => tags.includes(t))) return false;
  return true;
}

/**
 * Does one subscriber match a segment, tags and athlete predicates alike?
 *
 * The per-person counterpart to resolveSegment, for the paths that already have
 * somebody in hand and only need a yes or no — enrolment, above all. Answering
 * that by resolving the whole segment and searching it would mean reading the
 * entire list to decide one person.
 *
 * Costs a single athlete read, and only when the segment actually constrains
 * the athlete record. A tag-only segment — which is what a funnel's audience
 * is — is answered in memory.
 *
 * Mailability is deliberately NOT checked here, unlike resolveSegment: callers
 * that need it check it themselves and distinguish *why* somebody was dropped.
 * Folding it in would make "not in the audience" and "unsubscribed" the same
 * answer, and they call for very different follow-up.
 */
export async function subscriberMatchesSegment(
  sub: Subscriber,
  def: SegmentDefinition | undefined,
): Promise<boolean> {
  if (!def) return true;
  if (!matchesSegmentTags(sub, def)) return false;

  const pred = def.athlete;
  if (!pred) return true;

  // Mirrors applyAthletePredicates, which decides both of these without a
  // lookup: an explicit "no account" wants exactly the people with none, and
  // every other athlete predicate is unanswerable without one.
  if (pred.hasAccount === false) return !sub.userId;
  if (!sub.userId) return false;

  const snap = await getAdminDb().collection('users').doc(sub.userId).get();
  // A subscriber pointing at a deleted athlete fails any athlete predicate,
  // rather than being mailed on the strength of a record that is gone.
  if (!snap.exists) return false;

  return matchesAthlete(snap.data() as User, pred);
}

/** Firestore hands back Timestamps or Dates depending on the path. Normalise. */
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
