// src/lib/marketing/capture.ts
//
// One entry point for every place an email address enters the system — the
// landing page form, the Android beta banner, account signup, and the admin's
// manual add.
//
// Before this existed, /api/beta-testing/request sent a confirmation email and
// then discarded the address, so every lead that form ever collected was lost.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import {
  isPlausibleEmail,
  normaliseEmail,
  splitName,
  truncateIp,
  upsertSubscriber,
} from './subscribers';
import type { SubscriberSource } from './types';

/**
 * First-touch attribution as sent from the browser. Mirrors the `Attribution`
 * shape in src/lib/attribution.ts, which the client reads out of localStorage.
 */
export interface CaptureAttribution {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
  landingPage?: string;
  referrer?: string;
}

export interface CaptureInput {
  email: string;
  /** Either a full name, or first/last if the form collects them separately. */
  name?: string;
  firstName?: string;
  lastName?: string;
  source: SubscriberSource;
  tags?: string[];
  /** Whether the person actively agreed to marketing email. */
  consent: boolean;
  /** How consent was captured, e.g. 'landing-form'. Defaults to the source. */
  consentMethod?: string;
  userId?: string;
  attribution?: CaptureAttribution;
}

export type CaptureResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; error: string; status: number };

/** Cap per IP per hour on public forms. Generous for a human, useless for a script. */
const PUBLIC_CAPTURE_MAX_PER_HOUR = 5;

/**
 * Record a captured lead.
 *
 * Returns a result object rather than throwing, because every caller is a form
 * handler that needs to turn failure into a status code. Note that a suppressed
 * address returns `ok: true` — the form should behave identically whether or
 * not the address is already on the list, since differing responses turn the
 * endpoint into an oracle for checking who has subscribed.
 */
export async function captureLead(input: CaptureInput): Promise<CaptureResult> {
  const email = normaliseEmail(input.email ?? '');

  if (!email) return { ok: false, error: 'Email is required.', status: 400 };
  if (!isPlausibleEmail(email)) {
    return { ok: false, error: 'That does not look like a valid email address.', status: 400 };
  }

  const { firstName, lastName } = input.name
    ? splitName(input.name)
    : { firstName: input.firstName ?? '', lastName: input.lastName ?? '' };

  try {
    const result = await upsertSubscriber({
      email,
      firstName,
      lastName,
      tags: input.tags,
      source: input.source,
      userId: input.userId,
      consent: {
        marketing: input.consent,
        method: input.consentMethod ?? input.source,
      },
    });

    // Attribution is written alongside rather than inside the subscriber
    // document so a later re-capture of the same address cannot overwrite the
    // first-touch record — first-touch is only meaningful if it stays first.
    if (input.attribution && result.created) {
      await getAdminDb()
        .collection('marketingSubscribers')
        .doc(result.id)
        .set(
          {
            attribution: { ...input.attribution, capturedAt: FieldValue.serverTimestamp() },
          },
          { merge: true },
        );
    }

    logger.log(`[marketing] captured ${email} from ${input.source} (created=${result.created})`);
    return { ok: true, id: result.id, created: result.created };
  } catch (err) {
    logger.error('[marketing] capture failed:', err instanceof Error ? err.message : String(err));
    return { ok: false, error: 'Could not record that address. Please try again.', status: 500 };
  }
}

/**
 * Rate-limit gate for public capture endpoints, keyed on the caller's IP.
 * Returns the truncated IP for consent evidence when the request is allowed.
 */
export function checkCaptureRate(
  request: Request,
  bucket: string,
): { allowed: true; ip?: string } | { allowed: false; retryAfterSeconds: number } {
  const rawIp = request.headers.get('x-forwarded-for') ?? 'unknown';
  const key = rawIp.split(',')[0]?.trim() || 'unknown';

  const rl = checkRateLimit(`${bucket}:${key}`, 60 * 60_000, PUBLIC_CAPTURE_MAX_PER_HOUR);
  if (!rl.allowed) {
    return { allowed: false, retryAfterSeconds: Math.ceil(rl.retryAfterMs / 1000) };
  }
  return { allowed: true, ip: truncateIp(rawIp) };
}
