// src/lib/marketing/queue.ts
//
// The send pipeline.
//
// HXMailer sent campaigns inside a single server action: a sequential loop with
// a 150 ms sleep per recipient, hard-truncated at 500 recipients, with no
// resumability and no retry. If the request timed out halfway, the campaign was
// left in an unknown state and re-running it would email the first half twice.
//
// Here a send is enqueued as one document per recipient and drained by a cron
// that can run as many times as it needs to. The properties that follow:
//
//   - No recipient cap. A large campaign simply takes more invocations.
//   - Crash-safe. A drain that dies mid-batch leaves the remaining rows
//     `pending`; the next run picks them up.
//   - Idempotent. Send documents are keyed `${campaignId}_${subscriberId}`, so
//     re-enqueueing cannot create a second send for the same person.
//   - Inspectable. A half-sent campaign shows exact progress rather than being
//     an opaque in-flight state.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { renderForSubscriber } from './personalise';
import { resolveSegment, type SegmentDefinition } from './segments';
import { SUBSCRIBERS } from './subscribers';
import { sendBulkMessage } from './transport';
import {
  DEFAULT_MARKETING_SETTINGS,
  type Campaign,
  type MarketingSettings,
  type Send,
  type Subscriber,
} from './types';

export const CAMPAIGNS = 'marketingCampaigns';
export const SETTINGS_DOC = 'marketingSettings/config';

/** Retry a temporarily-failed send this many times before giving up. */
const MAX_ATTEMPTS = 3;

/** Deterministic send id — the property the whole queue's safety rests on. */
export function sendDocId(campaignId: string, subscriberId: string): string {
  return `${campaignId}_${subscriberId}`;
}

export async function getSettings(): Promise<MarketingSettings> {
  const snap = await getAdminDb().doc(SETTINGS_DOC).get();
  return { ...DEFAULT_MARKETING_SETTINGS, ...(snap.data() as Partial<MarketingSettings> | undefined) };
}

export interface EnqueueResult {
  campaignId: string;
  queued: number;
  /** Already had a send row from a previous enqueue — not queued again. */
  alreadyQueued: number;
  excluded: { suppressed: number; noConsent: number; failedPredicates: number };
}

/**
 * Resolve a campaign's audience and write one pending send row per recipient.
 *
 * Enqueueing is separated from sending so the expensive, failure-prone part
 * (SMTP) never blocks the part that decides who is included. It also means the
 * audience is frozen at enqueue time: a subscriber who unsubscribes mid-send is
 * still skipped, because the drain re-checks status per message, but someone
 * who joins mid-send is not silently added to a campaign already in flight.
 */
export async function enqueueCampaign(
  campaignId: string,
  segment: SegmentDefinition,
): Promise<EnqueueResult> {
  const db = getAdminDb();
  const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) throw new Error(`Campaign ${campaignId} not found.`);

  const campaign = campaignSnap.data() as Campaign;
  if (campaign.status === 'sending' || campaign.status === 'sent') {
    throw new Error(`Campaign ${campaignId} is already ${campaign.status}.`);
  }

  const audience = await resolveSegment(segment);
  const sendsRef = campaignRef.collection('sends');

  let queued = 0;
  let alreadyQueued = 0;

  const writer = db.bulkWriter();
  const BATCH = 300;

  for (let i = 0; i < audience.subscribers.length; i += BATCH) {
    const slice = audience.subscribers.slice(i, i + BATCH);
    const refs = slice.map((s) => sendsRef.doc(sendDocId(campaignId, s.id)));
    const existing = await db.getAll(...refs);

    slice.forEach((sub, idx) => {
      if (existing[idx]?.exists) {
        alreadyQueued++;
        return;
      }
      const row: Omit<Send, 'id'> = {
        campaignId,
        subscriberId: sub.id,
        email: sub.email,
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
      writer.set(refs[idx], row);
      queued++;
    });
  }

  await writer.close();

  await campaignRef.update({
    status: 'sending',
    recipientCount: queued + alreadyQueued,
    sendState: {
      total: queued + alreadyQueued,
      sent: 0,
      failed: 0,
      startedAt: FieldValue.serverTimestamp(),
      finishedAt: null,
    },
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.log(`[marketing] enqueued campaign ${campaignId}: ${queued} queued, ${alreadyQueued} already present`);
  return { campaignId, queued, alreadyQueued, excluded: audience.excluded };
}

export interface DrainResult {
  campaignId: string;
  attempted: number;
  sent: number;
  failed: number;
  /** True when no pending rows remain and the campaign has been finalised. */
  complete: boolean;
}

/**
 * Send up to `limit` pending messages for one campaign.
 *
 * Each row is claimed with a transaction that moves it out of `pending` before
 * any SMTP call happens. Two overlapping drains therefore cannot both claim the
 * same recipient — which matters because the cron may fire again while a slow
 * batch is still running.
 */
export async function drainCampaign(campaignId: string, limit: number): Promise<DrainResult> {
  const db = getAdminDb();
  const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
  const campaignSnap = await campaignRef.get();
  if (!campaignSnap.exists) throw new Error(`Campaign ${campaignId} not found.`);

  const campaign = { id: campaignSnap.id, ...campaignSnap.data() } as Campaign;
  const settings = await getSettings();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  const pending = await campaignRef
    .collection('sends')
    .where('status', '==', 'pending')
    .limit(limit)
    .get();

  const result: DrainResult = { campaignId, attempted: 0, sent: 0, failed: 0, complete: false };

  for (const doc of pending.docs) {
    const send = { id: doc.id, ...doc.data() } as Send;

    // Claim the row. If another drain got there first the transaction returns
    // false and we move on without sending.
    const claimed = await db.runTransaction(async (tx) => {
      const fresh = await tx.get(doc.ref);
      if (fresh.data()?.status !== 'pending') return false;
      tx.update(doc.ref, { status: 'sending', attempts: FieldValue.increment(1) });
      return true;
    });
    if (!claimed) continue;

    result.attempted++;

    // Re-read the subscriber rather than trusting the snapshot taken at enqueue
    // time: someone who unsubscribed while the campaign was in flight must not
    // receive it, and on a long send that gap can be hours.
    const subSnap = await db.collection(SUBSCRIBERS).doc(send.subscriberId).get();
    const sub = subSnap.exists ? ({ id: subSnap.id, ...subSnap.data() } as Subscriber) : null;

    if (!sub || sub.status !== 'active' || sub.consent?.marketing !== true) {
      await doc.ref.update({
        status: 'failed',
        lastError: 'Recipient became unmailable after enqueue',
      });
      result.failed++;
      continue;
    }

    const rendered = renderForSubscriber({
      campaignId,
      subject: campaign.subject,
      htmlBody: campaign.htmlBody,
      subscriber: sub,
      appUrl,
    });

    const outcome = await sendBulkMessage({
      to: sub.email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      unsubscribeUrl: rendered.unsubscribeUrl,
      campaignId,
      senderName: settings.senderName,
      replyTo: settings.replyTo || undefined,
    });

    if (outcome.ok) {
      await doc.ref.update({ status: 'sent', sentAt: FieldValue.serverTimestamp(), lastError: FieldValue.delete() });
      await campaignRef.update({ 'sendState.sent': FieldValue.increment(1) });
      await db.collection(SUBSCRIBERS).doc(sub.id).update({
        totalSent: FieldValue.increment(1),
        lastSentAt: FieldValue.serverTimestamp(),
      });
      result.sent++;
      continue;
    }

    // A hard bounce takes the subscriber off the list; a soft failure goes back
    // to pending for the next drain, until MAX_ATTEMPTS.
    if (outcome.permanent) {
      await doc.ref.update({ status: 'failed', lastError: outcome.error ?? 'Permanent failure' });
      await db.collection(SUBSCRIBERS).doc(sub.id).update({
        status: 'bounced',
        statusReason: outcome.error ?? 'Hard bounce',
        updatedAt: FieldValue.serverTimestamp(),
      });
      await campaignRef.update({ 'sendState.failed': FieldValue.increment(1) });
      result.failed++;
    } else if (send.attempts + 1 >= MAX_ATTEMPTS) {
      await doc.ref.update({ status: 'failed', lastError: outcome.error ?? 'Retries exhausted' });
      await campaignRef.update({ 'sendState.failed': FieldValue.increment(1) });
      result.failed++;
    } else {
      await doc.ref.update({ status: 'pending', lastError: outcome.error ?? 'Temporary failure' });
    }
  }

  result.complete = await finaliseIfDone(campaignId);
  return result;
}

/**
 * Mark a campaign sent once nothing is left to do.
 *
 * Checks for both `pending` and `sending` rows: a row stuck in `sending`
 * because a drain was killed mid-flight must not be mistaken for a finished
 * campaign.
 */
export async function finaliseIfDone(campaignId: string): Promise<boolean> {
  const campaignRef = getAdminDb().collection(CAMPAIGNS).doc(campaignId);

  const [pending, inFlight] = await Promise.all([
    campaignRef.collection('sends').where('status', '==', 'pending').limit(1).get(),
    campaignRef.collection('sends').where('status', '==', 'sending').limit(1).get(),
  ]);
  if (!pending.empty || !inFlight.empty) return false;

  const snap = await campaignRef.get();
  const campaign = snap.data() as Campaign | undefined;
  if (!campaign || campaign.status === 'sent') return true;

  await campaignRef.update({
    status: 'sent',
    sentAt: FieldValue.serverTimestamp(),
    failedCount: campaign.sendState?.failed ?? 0,
    'sendState.finishedAt': FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  logger.log(`[marketing] campaign ${campaignId} complete`);
  return true;
}

/**
 * Requeue rows left in `sending` by a drain that was killed mid-batch.
 *
 * Safe because a claimed-but-unsent row has, by definition, not been handed to
 * SMTP — the claim happens first precisely so this recovery is possible. The
 * age threshold avoids stealing rows from a drain that is still running.
 */
export async function recoverStalledSends(campaignId: string, olderThanMs = 10 * 60_000): Promise<number> {
  const campaignRef = getAdminDb().collection(CAMPAIGNS).doc(campaignId);
  const stalled = await campaignRef.collection('sends').where('status', '==', 'sending').get();

  const cutoff = Date.now() - olderThanMs;
  let recovered = 0;
  const writer = getAdminDb().bulkWriter();

  for (const doc of stalled.docs) {
    const data = doc.data() as Send;
    const queuedMs = (data.queuedAt as { toMillis?: () => number })?.toMillis?.() ?? 0;
    if (queuedMs && queuedMs > cutoff) continue;

    if ((data.attempts ?? 0) >= MAX_ATTEMPTS) {
      writer.update(doc.ref, { status: 'failed', lastError: 'Stalled and out of attempts' });
    } else {
      writer.update(doc.ref, { status: 'pending', lastError: 'Recovered from stalled send' });
    }
    recovered++;
  }

  await writer.close();
  if (recovered) logger.log(`[marketing] recovered ${recovered} stalled sends for ${campaignId}`);
  return recovered;
}

/** Campaigns the drain should work on: actively sending, or scheduled and now due. */
export async function findDueCampaigns(): Promise<string[]> {
  const db = getAdminDb();
  const now = new Date();

  const [sending, scheduled] = await Promise.all([
    db.collection(CAMPAIGNS).where('status', '==', 'sending').get(),
    db
      .collection(CAMPAIGNS)
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .get(),
  ]);

  return [...sending.docs, ...scheduled.docs].map((d) => d.id);
}
