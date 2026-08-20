// src/lib/marketing/sync.ts
//
// Keeps `marketingSubscribers` in step with the athlete roster in `users`.
//
// This replaces HXMailer's cross-project import, which reached into a second
// Firebase project through a service-account key to copy contacts in. Now that
// both halves live in one project, the athletes *are* the audience and the
// bridge is just a query.
//
// Derived tags are recomputed on every run so segments stay truthful as
// athletes progress — someone who moves from trial to active should stop
// matching a trial campaign without anyone maintaining a list by hand.

import { FieldValue, type UpdateData } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import type { User } from '@/models/types';
import { SUBSCRIBERS, isPlausibleEmail, normaliseEmail, subscriberId } from './subscribers';
import { UNMAILABLE_STATUSES, type Subscriber } from './types';

export interface SyncResult {
  scanned: number;
  created: number;
  updated: number;
  skippedSuppressed: number;
  skippedInvalid: number;
}

/**
 * Tags derived from the athlete record. Prefixed by dimension so a segment can
 * ask for `sub:trial` without colliding with a hand-written tag called `trial`,
 * and so the admin UI can group them.
 */
export function deriveTags(user: User): string[] {
  const tags = ['athlete'];

  if (user.experience) tags.push(`experience:${user.experience}`);
  if (user.goal) tags.push(`goal:${user.goal}`);
  if (user.frequency) tags.push(`frequency:${user.frequency}`);
  if (user.subscriptionStatus) tags.push(`sub:${user.subscriptionStatus}`);
  if (user.programId) tags.push(`program:${user.programId}`);
  if (user.platform) tags.push(`platform:${user.platform}`);

  // Engagement bands rather than raw counts — a segment wants "has never
  // trained", not "has completed exactly 7 workouts".
  const completed = user.completedWorkouts ?? 0;
  if (completed === 0) tags.push('engagement:none');
  else if (completed < 5) tags.push('engagement:starting');
  else if (completed < 25) tags.push('engagement:regular');
  else tags.push('engagement:committed');

  if (user.strava) tags.push('integration:strava');
  if (user.garmin) tags.push('integration:garmin');

  return tags;
}

/** Tag prefixes this sync owns. Anything else on a record is left untouched. */
const DERIVED_PREFIXES = [
  'experience:',
  'goal:',
  'frequency:',
  'sub:',
  'program:',
  'platform:',
  'engagement:',
  'integration:',
];

/**
 * Merge derived tags into whatever is already on the record, replacing only the
 * dimensions this sync owns.
 *
 * Recomputing means dropping the athlete's *previous* derived tags — otherwise
 * someone who upgraded would keep `sub:trial` alongside `sub:active` forever
 * and match both campaigns. Hand-applied tags (`vip`, `beta-tester`) carry no
 * owned prefix and survive untouched.
 */
export function mergeTags(existing: string[], derived: string[]): string[] {
  const manual = (existing ?? []).filter(
    (t) => t !== 'athlete' && !DERIVED_PREFIXES.some((p) => t.startsWith(p)),
  );
  return Array.from(new Set([...manual, ...derived]));
}

/**
 * Sync every athlete into the subscriber list.
 *
 * Athletes are added *without* marketing consent unless they have granted it —
 * having an account is not agreement to receive marketing, and `consent` is
 * what the send path checks. This is the difference between a list you can
 * lawfully mail and one you merely possess.
 *
 * Deliberately does NOT go through captureLead, and so raises no events. This
 * is reconciliation, not intake: the athletes it writes have been on the roster
 * for weeks or months, and emitting `subscriberCreated` for each of them would
 * enrol the entire back catalogue into whatever welcome journey is live. Real
 * signups raise their own `signup` event at the moment they happen.
 *
 * @param batchLimit Cap on athletes processed per invocation, so a cron run
 *                   stays inside its timeout on a large roster.
 */
export async function syncAthletesToSubscribers(batchLimit = 5000): Promise<SyncResult> {
  const db = getAdminDb();
  const result: SyncResult = {
    scanned: 0,
    created: 0,
    updated: 0,
    skippedSuppressed: 0,
    skippedInvalid: 0,
  };

  const usersSnap = await db.collection('users').limit(batchLimit).get();
  if (usersSnap.empty) return result;

  // Read the existing subscriber docs for these athletes up front, so the
  // suppression check does not cost a round trip per athlete.
  const users = usersSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as User)
    .filter((u) => {
      result.scanned++;
      if (!u.email || !isPlausibleEmail(u.email)) {
        result.skippedInvalid++;
        return false;
      }
      return true;
    });

  const writer = db.bulkWriter();
  const BATCH = 300;

  for (let i = 0; i < users.length; i += BATCH) {
    const slice = users.slice(i, i + BATCH);
    const refs = slice.map((u) => db.collection(SUBSCRIBERS).doc(subscriberId(u.email)));
    const existingDocs = await db.getAll(...refs);

    slice.forEach((user, idx) => {
      const ref = refs[idx];
      const snap = existingDocs[idx];
      const derived = deriveTags(user);
      const now = FieldValue.serverTimestamp();

      if (!snap?.exists) {
        writer.set(ref, {
          email: normaliseEmail(user.email),
          firstName: user.firstName ?? '',
          lastName: user.lastName ?? '',
          tags: mergeTags([], derived),
          status: 'active',
          source: 'sync',
          route: 'account-sync',
          userId: user.id,
          consent: {
            marketing: user.marketingConsent === true,
            at: now,
            method: 'account-sync',
          },
          totalSent: 0,
          openCount: 0,
          clickCount: 0,
          createdAt: now,
          updatedAt: now,
        });
        result.created++;
        return;
      }

      const existing = snap.data() as Subscriber;

      // Never resurrect. A suppressed record still gets its tags refreshed so
      // reporting stays accurate, but status and consent are left alone.
      if (UNMAILABLE_STATUSES.includes(existing.status)) {
        writer.update(ref, {
          tags: mergeTags(existing.tags ?? [], derived),
          userId: existing.userId ?? user.id,
          updatedAt: now,
        });
        result.skippedSuppressed++;
        return;
      }

      const update: UpdateData<Subscriber> = {
        tags: mergeTags(existing.tags ?? [], derived),
        userId: existing.userId ?? user.id,
        updatedAt: now,
      };
      if (user.firstName && !existing.firstName) update.firstName = user.firstName;
      if (user.lastName && !existing.lastName) update.lastName = user.lastName;

      // The athlete's own preference is authoritative for their record — this
      // is how a profile-page toggle reaches the subscriber list even if the
      // preferences route failed to write both halves at the time.
      if (user.marketingConsent !== undefined
          && user.marketingConsent !== existing.consent?.marketing) {
        update.consent = {
          marketing: user.marketingConsent,
          at: now,
          method: 'account-sync',
        };
      }

      writer.update(ref, update);
      result.updated++;
    });
  }

  await writer.close();
  logger.log(
    `[marketing] sync: ${result.created} created, ${result.updated} updated, ` +
      `${result.skippedSuppressed} suppressed, ${result.skippedInvalid} invalid`,
  );
  return result;
}
