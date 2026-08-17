// src/lib/marketing/subscribers.ts
//
// Core subscriber operations. Every write to `marketingSubscribers` should go
// through here rather than touching the collection directly, so that the two
// invariants the whole system depends on are enforced in one place:
//
//   1. One document per email address, always.
//   2. An unmailable subscriber is never silently made mailable again.
//
// The second matters most. Sync, import and capture all run repeatedly over
// overlapping sets of people; without a single guarded upsert, any one of them
// would eventually resurrect someone who had unsubscribed.

import { createHash } from 'crypto';
import { FieldValue, type UpdateData } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import {
  UNMAILABLE_STATUSES,
  type Subscriber,
  type SubscriberConsent,
  type SubscriberSource,
  type SubscriberStatus,
} from './types';

export const SUBSCRIBERS = 'marketingSubscribers';

/** Normalise an address for comparison: trimmed and lowercased. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Document id for an address. Hashing rather than using the raw email keeps
 * the id safe for a Firestore path (emails may contain `/` and `.`) and makes
 * dedupe structural — two writes for the same address collide on the same
 * document instead of racing to create two.
 */
export function subscriberId(email: string): string {
  return createHash('sha256').update(normaliseEmail(email)).digest('hex');
}

/**
 * Minimal shape-check. Deliberately permissive: this guards against obvious
 * junk reaching the list, not against every address RFC 5322 permits. Real
 * validation is delivery — a bounce marks the subscriber `bounced`.
 */
export function isPlausibleEmail(email: string): boolean {
  const e = normaliseEmail(email);
  return e.length >= 3 && e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

/**
 * Truncate an IP for consent evidence: IPv4 to /24, IPv6 to /48. Enough to
 * corroborate where consent came from without retaining a full identifier for
 * someone who has only given us an email address.
 */
export function truncateIp(ip: string | null | undefined): string | undefined {
  if (!ip) return undefined;
  const clean = ip.split(',')[0]?.trim();
  if (!clean) return undefined;

  if (clean.includes(':')) {
    const groups = clean.split(':').filter(Boolean).slice(0, 3);
    return groups.length ? `${groups.join(':')}::` : undefined;
  }
  const octets = clean.split('.');
  return octets.length === 4 ? `${octets[0]}.${octets[1]}.${octets[2]}.0` : undefined;
}

/** Split a full name into first and last. Everything after the first word is the surname. */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

export interface UpsertInput {
  email: string;
  firstName?: string;
  lastName?: string;
  /** Merged with any tags already on the record — never replaces them. */
  tags?: string[];
  source: SubscriberSource;
  userId?: string;
  consent?: Partial<SubscriberConsent> & { marketing: boolean };
}

export interface UpsertResult {
  id: string;
  created: boolean;
  /** True when the record exists but is unsubscribed/bounced/complained. */
  suppressed: boolean;
}

/**
 * Create or update a subscriber.
 *
 * Existing records are merged, never overwritten: tags union, names fill in
 * only where blank, and `status` is left strictly alone. Consent can be
 * *granted* on an existing active record (someone re-opting in through a form),
 * but an unmailable record is never reactivated here — that requires the
 * explicit `resubscribe()` below, which is only reachable from a deliberate
 * admin action or the athlete's own preference toggle.
 */
export async function upsertSubscriber(input: UpsertInput): Promise<UpsertResult> {
  const email = normaliseEmail(input.email);
  if (!isPlausibleEmail(email)) throw new Error(`Invalid email address: ${input.email}`);

  const id = subscriberId(email);
  const ref = getAdminDb().collection(SUBSCRIBERS).doc(id);

  return getAdminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const now = FieldValue.serverTimestamp();

    if (!snap.exists) {
      const doc: Omit<Subscriber, 'id'> = {
        email,
        firstName: input.firstName ?? '',
        lastName: input.lastName ?? '',
        tags: Array.from(new Set(input.tags ?? [])),
        status: 'active',
        source: input.source,
        consent: {
          marketing: input.consent?.marketing ?? false,
          at: now,
          method: input.consent?.method ?? input.source,
          ...(input.consent?.ip ? { ip: input.consent.ip } : {}),
        },
        ...(input.userId ? { userId: input.userId } : {}),
        totalSent: 0,
        openCount: 0,
        clickCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(ref, doc);
      return { id, created: true, suppressed: false };
    }

    const existing = snap.data() as Subscriber;
    const suppressed = UNMAILABLE_STATUSES.includes(existing.status);

    // Typed as UpdateData so Firestore's own field-path rules apply — a typo
    // in a key here would otherwise silently add a new field.
    const update: UpdateData<Subscriber> = { updatedAt: now };

    if (input.tags?.length) {
      update.tags = Array.from(new Set([...(existing.tags ?? []), ...input.tags]));
    }
    // Fill in blanks only — a name typed by the person themselves should not be
    // clobbered by a later sync carrying an empty string.
    if (input.firstName && !existing.firstName) update.firstName = input.firstName;
    if (input.lastName && !existing.lastName) update.lastName = input.lastName;
    if (input.userId && !existing.userId) update.userId = input.userId;

    // Consent may be granted on a mailable record, and may always be withdrawn.
    // Granting it on a suppressed record would quietly undo an unsubscribe.
    if (input.consent && (!suppressed || input.consent.marketing === false)) {
      update.consent = {
        marketing: input.consent.marketing,
        at: now,
        method: input.consent.method ?? input.source,
        ...(input.consent.ip ? { ip: input.consent.ip } : {}),
      };
    }

    tx.update(ref, update);
    return { id, created: false, suppressed };
  });
}

/**
 * Mark a subscriber unmailable. Idempotent, and safe to call for an address
 * that was never on the list — an unsubscribe link should never 500 because
 * the record has since been deleted.
 */
export async function suppressSubscriber(
  id: string,
  status: Exclude<SubscriberStatus, 'active'>,
  reason?: string,
): Promise<boolean> {
  const ref = getAdminDb().collection(SUBSCRIBERS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    logger.log(`[marketing] suppress: no subscriber ${id}`);
    return false;
  }

  await ref.update({
    status,
    ...(reason ? { statusReason: reason } : {}),
    'consent.marketing': false,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

/**
 * Return a suppressed subscriber to active. Only ever called from a deliberate
 * opt-in — the athlete's own preference toggle or an admin acting on a direct
 * request.
 *
 * A spam complaint is not reversible this way: once someone has reported us,
 * mailing them again risks the sending domain's reputation for everyone else,
 * and no UI affordance should make that a one-click mistake.
 */
export async function resubscribe(id: string, method: string, ip?: string): Promise<boolean> {
  const ref = getAdminDb().collection(SUBSCRIBERS).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return false;

  const existing = snap.data() as Subscriber;
  if (existing.status === 'complained') {
    logger.error(`[marketing] refusing to resubscribe ${id}: prior spam complaint`);
    return false;
  }

  await ref.update({
    status: 'active',
    statusReason: FieldValue.delete(),
    consent: {
      marketing: true,
      at: FieldValue.serverTimestamp(),
      method,
      ...(ip ? { ip } : {}),
    },
    updatedAt: FieldValue.serverTimestamp(),
  });
  return true;
}

/** Look up a subscriber by address. Returns null when absent. */
export async function getSubscriberByEmail(email: string): Promise<Subscriber | null> {
  const snap = await getAdminDb().collection(SUBSCRIBERS).doc(subscriberId(email)).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as Subscriber) : null;
}
