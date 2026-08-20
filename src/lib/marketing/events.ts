// src/lib/marketing/events.ts
//
// The trigger bus.
//
// Application code calls emitMarketingEvent() when something happens; the
// journey engine turns matching events into journey enrolments. Keeping the two
// apart matters: app code should not know which journeys exist, and a marketing
// automation should never be able to break signup by throwing.
//
// Every emit is therefore fire-and-forget and swallows its own errors.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import type { EventTriggerType } from './journeys';
import { SUBSCRIBERS, subscriberId as hashEmail } from './subscribers';

export const EVENTS = 'marketingEvents';

/**
 * Custom event names the lead bridge may raise, as `apiEvent` payloads.
 *
 * An allow-list rather than a free namespace. The marketing site is a separate
 * deployment holding a shared secret; letting it invent event names would mean
 * a journey could be triggered by a string nobody in this codebase has ever
 * seen, and a compromised or simply buggy site could enrol people into
 * automations at will. Adding a name here is the deliberate act that makes a
 * new cross-property trigger possible.
 */
export const BRIDGE_EVENT_NAMES = [
  'calculatorUsed',
  'pricingViewed',
  'raceCardConfirmed',
  'programPageViewed',
  'storeVisited',
] as const;

export type BridgeEventName = (typeof BRIDGE_EVENT_NAMES)[number];

export function isBridgeEventName(name: string): name is BridgeEventName {
  return (BRIDGE_EVENT_NAMES as readonly string[]).includes(name);
}

export interface MarketingEvent {
  id: string;
  type: EventTriggerType;
  userId?: string;
  subscriberId?: string;
  email?: string;
  payload?: Record<string, unknown>;
  processed: boolean;
  at: unknown;
}

export interface EmitOptions {
  userId?: string;
  email?: string;
  payload?: Record<string, unknown>;
}

/**
 * Record that something happened.
 *
 * Never throws and never blocks meaningfully — call it without awaiting from
 * request paths. A marketing trigger failing must not fail a signup or a
 * Stripe webhook.
 */
export async function emitMarketingEvent(
  type: EventTriggerType,
  options: EmitOptions = {},
): Promise<void> {
  try {
    const db = getAdminDb();

    // Resolve the subscriber now rather than at processing time, so an event
    // still points at the right person if the address changes later.
    let subscriberId: string | undefined;
    if (options.email) {
      subscriberId = hashEmail(options.email);
    } else if (options.userId) {
      const snap = await db
        .collection(SUBSCRIBERS)
        .where('userId', '==', options.userId)
        .limit(1)
        .get();
      subscriberId = snap.empty ? undefined : snap.docs[0].id;
    }

    await db.collection(EVENTS).add({
      type,
      ...(options.userId ? { userId: options.userId } : {}),
      ...(subscriberId ? { subscriberId } : {}),
      ...(options.email ? { email: options.email.toLowerCase() } : {}),
      ...(options.payload ? { payload: options.payload } : {}),
      processed: false,
      at: FieldValue.serverTimestamp(),
    });

    logger.log(`[marketing/events] ${type} recorded${subscriberId ? '' : ' (no subscriber match)'}`);
  } catch (err) {
    // Deliberately swallowed. See the module comment.
    logger.error(
      `[marketing/events] could not record ${type}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Convenience wrapper for call sites in request handlers, making the
 * fire-and-forget intent explicit at the call site rather than relying on
 * everyone remembering not to await.
 */
export function emitMarketingEventAsync(type: EventTriggerType, options: EmitOptions = {}): void {
  void emitMarketingEvent(type, options);
}

/** Claim a batch of unprocessed events for the engine. */
export async function claimUnprocessedEvents(limit = 200): Promise<MarketingEvent[]> {
  const snap = await getAdminDb()
    .collection(EVENTS)
    .where('processed', '==', false)
    .orderBy('at', 'asc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MarketingEvent);
}

export async function markEventsProcessed(ids: string[]): Promise<void> {
  if (!ids.length) return;

  const db = getAdminDb();
  const writer = db.bulkWriter();
  for (const id of ids) {
    writer.update(db.collection(EVENTS).doc(id), {
      processed: true,
      processedAt: FieldValue.serverTimestamp(),
    });
  }
  await writer.close();
}

/**
 * Delete processed events older than the retention window.
 *
 * Events are a log, not a record: once a journey has acted on one it has no
 * further use, and an unbounded collection is a slow leak of both storage and
 * query performance.
 */
export async function pruneProcessedEvents(olderThanDays = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000);

  const snap = await getAdminDb()
    .collection(EVENTS)
    .where('processed', '==', true)
    .where('at', '<', cutoff)
    .limit(500)
    .get();

  if (snap.empty) return 0;

  const writer = getAdminDb().bulkWriter();
  snap.docs.forEach((d) => writer.delete(d.ref));
  await writer.close();

  logger.log(`[marketing/events] pruned ${snap.size} processed events`);
  return snap.size;
}
