// src/lib/marketing/webhook-events.ts
//
// Interpretation of Brevo delivery events.
//
// Split out from the route so the mapping is testable without a request or a
// database. It is the part worth pinning down: getting it wrong either leaves
// dead addresses on the list degrading the sending domain, or removes real
// subscribers who merely hit a full mailbox.

import type { SubscriberStatus } from './types';

/**
 * Event names Brevo sends. `event` on the transactional webhook, `type` on some
 * payload versions — the route normalises both onto this.
 */
export type BrevoEventName =
  | 'hard_bounce'
  | 'soft_bounce'
  | 'blocked'
  | 'spam'
  | 'complaint'
  | 'invalid_email'
  | 'unsubscribed'
  | 'deferred'
  | 'delivered'
  | 'request'
  | 'opened'
  | 'click';

export interface WebhookOutcome {
  /** New subscriber status, or null to leave the subscriber alone. */
  status: Exclude<SubscriberStatus, 'active'> | null;
  /** Whether the corresponding send row should be marked failed. */
  markSendFailed: boolean;
  reason: string;
}

/**
 * Decide what an event means for the subscriber.
 *
 * The asymmetry here is deliberate. A hard bounce or an invalid address is a
 * statement about the address itself, so the subscriber is suppressed. A soft
 * bounce or a deferral is a statement about a moment — a full mailbox, a
 * greylisting server — and suppressing on those would steadily delete real
 * subscribers for transient reasons.
 *
 * A spam complaint is the most serious: it damages the sending domain's
 * standing for every other subscriber, and `complained` is the one status the
 * admin UI offers no way to reverse.
 */
export function interpretBrevoEvent(event: string): WebhookOutcome {
  switch (event as BrevoEventName) {
    case 'hard_bounce':
      return {
        status: 'bounced',
        markSendFailed: true,
        reason: 'Hard bounce reported by Brevo',
      };

    case 'invalid_email':
      return {
        status: 'bounced',
        markSendFailed: true,
        reason: 'Address rejected as invalid',
      };

    case 'blocked':
      // The receiving server refused us for this recipient. Treated as a
      // bounce: continuing to send to an address that blocks us is exactly
      // what damages a sender's reputation.
      return {
        status: 'bounced',
        markSendFailed: true,
        reason: 'Delivery blocked by the receiving server',
      };

    case 'spam':
    case 'complaint':
      return {
        status: 'complained',
        markSendFailed: false, // it arrived; they simply did not want it
        reason: 'Recipient reported the message as spam',
      };

    case 'unsubscribed':
      // Brevo's own unsubscribe surface, distinct from our signed link. Both
      // land in the same place.
      return {
        status: 'unsubscribed',
        markSendFailed: false,
        reason: 'Unsubscribed via the mail provider',
      };

    case 'soft_bounce':
    case 'deferred':
      // Transient. The send queue's own retry handles these; suppressing here
      // would remove subscribers whose mailbox was briefly full.
      return { status: null, markSendFailed: false, reason: 'Temporary delivery failure' };

    default:
      // delivered, opened, click, request and anything Brevo adds later.
      // Opens and clicks are tracked through our own signed endpoints, which
      // filter bots; taking Brevo's counts as well would double-count.
      return { status: null, markSendFailed: false, reason: 'No action' };
  }
}

/** Whether an event needs any write at all — lets the route skip the noisy majority. */
export function isActionableEvent(event: string): boolean {
  const outcome = interpretBrevoEvent(event);
  return outcome.status !== null || outcome.markSendFailed;
}
