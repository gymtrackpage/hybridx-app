// src/lib/marketing/types.ts
//
// Data model for the marketing system. Everything lives in top-level
// `marketing*` collections rather than under `users/{uid}` — `users` holds
// athlete records here, and grafting subscriber subcollections onto them would
// conflate two very different things.
//
// Every one of these collections is admin-read-only from the client and
// written exclusively through the Admin SDK (see `firestore.rules`).

import type { Timestamp, FieldValue } from 'firebase-admin/firestore';

/** A Firestore timestamp as it may appear mid-write or after a read. */
export type Stamp = Timestamp | FieldValue | Date | null;

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

/**
 * Why a subscriber is no longer mailable. Kept as distinct states rather than a
 * single boolean because they carry different obligations: `unsubscribed` is
 * the person's choice, `bounced` is a delivery fact, and `complained` (a spam
 * report) means we must never mail them again under any circumstance.
 */
export type SubscriberStatus = 'active' | 'unsubscribed' | 'bounced' | 'complained';

/** Statuses that permanently exclude someone from a send. */
export const UNMAILABLE_STATUSES: readonly SubscriberStatus[] = [
  'unsubscribed',
  'bounced',
  'complained',
];

/** How an address entered the list — used for attribution and for audit. */
export type SubscriberSource =
  | 'signup'          // created a HybridX account
  | 'landing'         // marketing site capture form
  | 'beta-request'    // Android beta tester form
  | 'admin'           // added by hand in the admin UI
  | 'import'          // CSV or source-project import
  | 'sync'            // back-filled from the users collection
  | 'migration';      // carried over from HXMailer

/**
 * Consent record. Stored as a nested object rather than a bare boolean so the
 * *evidence* travels with the flag — under GDPR you need to show when and how
 * consent was given, not merely that it was.
 */
export interface SubscriberConsent {
  marketing: boolean;
  at: Stamp;
  /** How consent was captured, e.g. 'signup-checkbox', 'landing-form', 'import'. */
  method: string;
  /** Truncated to /24 (IPv4) or /48 (IPv6) — enough to evidence consent, not to track. */
  ip?: string;
}

export interface Subscriber {
  /** Document id is sha256(lowercased email) — dedupe is structural, not a query. */
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tags: string[];
  status: SubscriberStatus;
  source: SubscriberSource;
  consent: SubscriberConsent;
  /** Set when this address belongs to a HybridX athlete, enabling rich segmentation. */
  userId?: string;
  // Denormalised lifetime engagement counters, incremented by the tracking routes.
  totalSent?: number;
  openCount?: number;
  clickCount?: number;
  lastSentAt?: Stamp;
  createdAt: Stamp;
  updatedAt?: Stamp;
  /** Why the subscriber became unmailable, when the status is not 'active'. */
  statusReason?: string;
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'   // queued; the cron drain is working through it
  | 'sent'
  | 'paused'
  | 'failed';

/**
 * Progress of a queued send. `total` is fixed at enqueue time; the rest advance
 * as the drain runs, so a partially-sent campaign is always inspectable rather
 * than being an opaque in-flight state.
 */
export interface CampaignSendState {
  total: number;
  sent: number;
  failed: number;
  startedAt: Stamp;
  finishedAt: Stamp;
}

export interface Campaign {
  id: string;
  subject: string;
  previewText: string;
  /** Rendered HTML. Derived from `blocks` when present — see lib/marketing/render.ts. */
  htmlBody: string;
  /** Structured content. Absent on campaigns migrated from HXMailer, which are HTML-only. */
  blocks?: unknown[];
  status: CampaignStatus;
  campaignGoal?: string;
  targetAudience?: string;
  targetTags?: string[];
  /** Saved segment this campaign targets, if any. */
  segmentId?: string;
  scheduledAt: Stamp;
  sentAt: Stamp;
  recipientCount: number;
  openCount: number;
  clickCount: number;
  unsubscribeCount?: number;
  failedCount?: number;
  sendState?: CampaignSendState;
  /** Set when this campaign is a step inside a journey rather than a one-off broadcast. */
  journeyId?: string;
  journeyStepId?: string;
  folder?: string;
  archived?: boolean;
  ctaUrl?: string;
  ctaLabel?: string;
  createdAt?: Stamp;
  updatedAt?: Stamp;
}

// ---------------------------------------------------------------------------
// Sends
// ---------------------------------------------------------------------------

/**
 * `sending` is the claimed-but-not-yet-delivered state. A drain moves a row
 * into it transactionally *before* touching SMTP, which is what stops two
 * overlapping cron invocations from both mailing the same person. It also means
 * a row found in `sending` long after the fact was definitely never handed to
 * the mail server, so it is safe to requeue — see recoverStalledSends().
 */
export type SendStatus = 'pending' | 'sending' | 'sent' | 'failed';

/**
 * One row per recipient per campaign. The document id is
 * `${campaignId}_${subscriberId}`, which is what makes the queue idempotent:
 * a retried or double-fired drain cannot create a second send for the same
 * person.
 */
export interface Send {
  id: string;
  campaignId: string;
  subscriberId: string;
  email: string;
  status: SendStatus;
  attempts: number;
  lastError?: string;
  queuedAt: Stamp;
  sentAt: Stamp;
  /** First genuine open. Bot and prefetch opens are counted in `openRaw` only. */
  opened: boolean;
  openedAt: Stamp;
  /** Every recorded open including scanners and Apple Mail Privacy Protection prefetch. */
  openRaw?: number;
  clicked: boolean;
  clickedAt: Stamp;
  unsubscribed?: boolean;
  unsubscribedAt?: Stamp;
}

export interface LinkClick {
  id: string;
  url: string;
  clickCount: number;
  lastClickedAt: Stamp;
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/**
 * Singleton at `marketingSettings/config`. Note there is no OAuth refresh
 * token: sending goes through Brevo, whose credentials are environment
 * secrets, not user-granted per-mailbox grants.
 */
export interface MarketingSettings {
  senderName: string;
  senderEmail: string;
  replyTo: string;
  /** Messages per drain invocation. Tune against the Brevo plan's rate limit. */
  batchSize: number;
  /** Global cap: max marketing emails one person may receive per rolling week. */
  frequencyCapPerWeek: number;
  /** Master switch — pauses every journey and queued send without losing state. */
  sendingPaused: boolean;
  updatedAt?: Stamp;
}

export const DEFAULT_MARKETING_SETTINGS: MarketingSettings = {
  senderName: 'HYBRIDX',
  senderEmail: '',
  replyTo: '',
  batchSize: 100,
  frequencyCapPerWeek: 3,
  sendingPaused: false,
};
