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
