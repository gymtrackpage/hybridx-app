// src/lib/marketing/transport.ts
//
// Bulk send transport.
//
// Separate from src/lib/email-service.ts, which stays as-is for transactional
// mail. The two have genuinely different requirements: transactional messages
// are one-off and latency-sensitive, while campaign sends are thousands of
// messages that need connection pooling and throughput limiting. Sharing one
// transport would mean either a pool sitting idle for verification emails or no
// pool at all for campaigns.
//
// Both send through the same authenticated hybridx.club domain, so reputation
// and DKIM alignment are shared.

import nodemailer, { type Transporter } from 'nodemailer';
import { logger } from '@/lib/logger';

let pooled: Transporter | null = null;

/** Whether bulk sending is configured. Brevo only — the Gmail fallback is not viable for bulk. */
export function isBulkTransportConfigured(): boolean {
  return !!(process.env.BREVO_SMTP_KEY && process.env.BREVO_SMTP_USER);
}

/**
 * Pooled SMTP transport.
 *
 * HXMailer sent through the Gmail API one message at a time with a 150 ms sleep
 * between each — roughly 75 seconds of deliberate sleeping for a 500-recipient
 * send, on top of a 500/day account cap. A connection pool with a declared rate
 * limit does the same job of staying inside the provider's limits without
 * blocking, and lets nodemailer manage the queue.
 */
export function getBulkTransport(): Transporter {
  if (pooled) return pooled;

  if (!isBulkTransportConfigured()) {
    throw new Error(
      'Bulk email transport is not configured. Set BREVO_SMTP_USER and BREVO_SMTP_KEY.',
    );
  }

  pooled = nodemailer.createTransport({
    pool: true,
    host: process.env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com',
    port: Number(process.env.BREVO_SMTP_PORT) || 587,
    secure: false, // STARTTLS on 587
    auth: {
      user: process.env.BREVO_SMTP_USER,
      pass: process.env.BREVO_SMTP_KEY,
    },
    maxConnections: Number(process.env.MARKETING_MAX_CONNECTIONS) || 5,
    // Recycle connections periodically; long-lived SMTP sessions are a common
    // source of silent stalls with relay providers.
    maxMessages: 100,
    rateDelta: 1000,
    rateLimit: Number(process.env.MARKETING_RATE_LIMIT) || 14, // messages per second
  });

  return pooled;
}

/** Drop the pool. Used between test runs and after a config change. */
export function resetBulkTransport(): void {
  pooled?.close();
  pooled = null;
}

/**
 * The From header for campaigns.
 *
 * Falls back to the transactional sender, but a distinct MARKETING_EMAIL_FROM is
 * strongly preferable: mixing bulk and transactional on one address means a bad
 * campaign can take account-verification email down with it.
 */
export function getMarketingFrom(senderName?: string): string {
  const name = senderName || process.env.MARKETING_EMAIL_FROM_NAME || 'HYBRIDX';
  const address =
    process.env.MARKETING_EMAIL_FROM || process.env.EMAIL_FROM || process.env.GMAIL_USER || '';
  return `"${name}" <${address}>`;
}

/**
 * Whether campaigns are sent from the same address as verification email.
 *
 * Reputation is scored per sending domain, and increasingly per address. When
 * bulk and transactional share one, a campaign that draws complaints degrades
 * delivery of the mail people are *waiting* for — password resets, email
 * verification — and the failure is invisible until someone cannot sign in.
 *
 * Exported and surfaced in the settings health panel rather than enforced. The
 * fix is DNS and a warmed subdomain, which cannot be done from code and should
 * not be discovered mid-send.
 */
export function sharesTransactionalSender(): boolean {
  // Resolved the same way getMarketingFrom() resolves it, not read raw. An
  // unset MARKETING_EMAIL_FROM does not mean "no conflict" — it means campaigns
  // fall back to EMAIL_FROM and really do send from the verification address.
  // Comparing the raw values would report a green tick for the single most
  // common form of the misconfiguration this check exists to catch.
  const marketing = extractAddress(process.env.MARKETING_EMAIL_FROM || process.env.EMAIL_FROM);
  const transactional = extractAddress(process.env.EMAIL_FROM);
  if (!marketing || !transactional) return false;
  return marketing === transactional;
}

/**
 * Pull the bare address out of a From value.
 *
 * These variables are set both ways in this codebase — a bare address in the
 * app, a display-name form like `"HYBRIDX" <news@mail.hybridx.club>` on the
 * marketing site — and comparing the two forms as strings would miss a genuine
 * conflict while the trailing `>` corrupted the reported domain.
 */
function extractAddress(value: string | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const angled = raw.match(/<([^>]+)>/);
  return (angled ? angled[1] : raw).trim().toLowerCase();
}

/** The domain campaigns are sent from, for the health panel. */
export function getMarketingSenderDomain(): string | null {
  const address = extractAddress(process.env.MARKETING_EMAIL_FROM || process.env.EMAIL_FROM);
  const at = address.lastIndexOf('@');
  return at >= 0 ? address.slice(at + 1) : null;
}

export interface BulkMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Absolute https URL that unsubscribes the recipient. */
  unsubscribeUrl: string;
  campaignId: string;
  senderName?: string;
  replyTo?: string;
}

export interface SendOutcome {
  ok: boolean;
  messageId?: string;
  error?: string;
  /** True when the address itself is bad, so retrying will never help. */
  permanent?: boolean;
}

/**
 * SMTP 5xx means the server has rejected the message for good; 4xx is a
 * temporary condition worth retrying. Anything unrecognised is treated as
 * temporary, because wrongly marking someone `bounced` removes a real
 * subscriber from the list permanently — a worse outcome than a retry.
 */
function isPermanentFailure(err: unknown): boolean {
  const code = (err as { responseCode?: number })?.responseCode;
  return typeof code === 'number' && code >= 500 && code < 600;
}

/**
 * Send one campaign message.
 *
 * The List-Unsubscribe headers are not optional decoration: Gmail and Yahoo
 * have required them of bulk senders since February 2024, and mail without them
 * is filtered aggressively. HXMailer sent none.
 */
export async function sendBulkMessage(msg: BulkMessage): Promise<SendOutcome> {
  try {
    const info = await getBulkTransport().sendMail({
      from: getMarketingFrom(msg.senderName),
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      headers: {
        'List-Unsubscribe': `<${msg.unsubscribeUrl}>`,
        // Declares one-click support, so the mail client's own unsubscribe
        // button POSTs rather than sending the recipient to a web page.
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        // Lets Brevo webhook events be attributed back to the campaign.
        'X-Campaign-Id': msg.campaignId,
        // Marks the message as bulk so autoresponders do not reply to it.
        Precedence: 'bulk',
      },
    });

    return { ok: true, messageId: info.messageId };
  } catch (err) {
    const permanent = isPermanentFailure(err);
    const message = err instanceof Error ? err.message : String(err);
    logger.error(`[marketing] send to ${msg.to} failed (permanent=${permanent}): ${message}`);
    return { ok: false, error: message, permanent };
  }
}

/** Verify SMTP credentials and connectivity. Used by the pre-send checklist. */
export async function verifyBulkTransport(): Promise<{ ok: boolean; error?: string }> {
  try {
    await getBulkTransport().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
