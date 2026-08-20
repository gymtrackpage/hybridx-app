// src/lib/marketing/capture.ts
//
// The single entry point for every address that enters the mailing system —
// the marketing site's magnets, the app's homepage form, account sync, the
// Android beta request, an admin adding someone by hand, a CSV import.
//
// Two things are centralised here rather than left to each call site:
//
//   1. **Route resolution.** Callers name the route they represent; this module
//      asks lib/marketing/sources.ts what that means in terms of tags, coarse
//      source and consent posture. Adding an intake path is a registry entry,
//      not a scattering of literals across route handlers.
//
//   2. **Event emission.** Journeys enrol from `marketingEvents` and nothing
//      else. Before this, no capture path raised an event at all, so a lead
//      captured by any route landed on the list and then received silence —
//      every automation in the system was unreachable from the top of the
//      funnel. Emitting here means a route cannot be added that forgets to.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';
import { emitMarketingEventAsync } from './events';
import { resolveRouteFor, type ResolveOptions } from './route-store';
import { grantsConsentOnCapture, tagsForRoute } from './sources';
import {
  SUBSCRIBERS,
  isPlausibleEmail,
  normaliseEmail,
  splitName,
  truncateIp,
  upsertSubscriber,
} from './subscribers';

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
  /**
   * Which intake route this is. Accepts a route id, one of the marketing site's
   * own source names, or the slug of a funnel the registry has never seen — a
   * new funnel registers itself on its first lead rather than needing a deploy.
   */
  route: string;
  /**
   * Where this capture came from, recorded if the route turns out to be new.
   * Only used on first sight; an established route ignores it.
   */
  routeHints?: Pick<ResolveOptions, 'property' | 'seenFrom'>;
  /** Tags beyond the ones the route already implies. */
  tags?: string[];
  /**
   * Override the route's consent posture. Supply this only where the caller
   * genuinely knows better than the route does — an admin toggling consent by
   * hand, or the marketing site reporting what its form actually said. Omitted,
   * the route decides, which is the safer default.
   */
  consent?: boolean;
  /** How consent was captured. Defaults to the route id. */
  consentMethod?: string;
  userId?: string;
  attribution?: CaptureAttribution;
  /** Truncated IP, for consent evidence. */
  ip?: string;
}

export type CaptureResult =
  | {
      ok: true;
      id: string;
      created: boolean;
      /** Resolved route id, which may differ from what the caller passed. */
      route: string;
      /** Whether this write made the person mailable for the first time. */
      consentGranted: boolean;
    }
  | { ok: false; error: string; status: number };

/** Cap per IP per hour on public forms. Generous for a human, useless for a script. */
const PUBLIC_CAPTURE_MAX_PER_HOUR = 5;

/**
 * Record a captured address.
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

  // Registers the route if this slug has never been seen, so a funnel launched
  // this morning tags its leads correctly this morning. The caller's consent
  // assertion is passed through because it becomes the new route's posture —
  // a funnel whose form promised ongoing email should not start life as one
  // that grants nothing.
  const route = await resolveRouteFor(input.route, {
    consentGranted: input.consent === true,
    ...input.routeHints,
  });

  // The route's posture unless the caller states otherwise. Requesting a lead
  // magnet is not the same as agreeing to ongoing marketing, and a confirmed
  // opt-in route grants nothing until the link is clicked.
  const consent = input.consent ?? grantsConsentOnCapture(route.consentPolicy);

  const { firstName, lastName } = input.name
    ? splitName(input.name)
    : { firstName: input.firstName ?? '', lastName: input.lastName ?? '' };

  try {
    const result = await upsertSubscriber({
      email,
      firstName,
      lastName,
      tags: [...tagsForRoute(route), ...(input.tags ?? [])],
      source: route.source,
      route: route.id,
      userId: input.userId,
      consent: {
        marketing: consent,
        method: input.consentMethod ?? route.id,
        ...(input.ip ? { ip: input.ip } : {}),
      },
    });

    // Attribution is written alongside rather than inside the subscriber
    // document so a later re-capture of the same address cannot overwrite the
    // first-touch record — first-touch is only meaningful if it stays first.
    if (input.attribution && result.created) {
      await getAdminDb()
        .collection(SUBSCRIBERS)
        .doc(result.id)
        .set(
          {
            attribution: { ...input.attribution, capturedAt: FieldValue.serverTimestamp() },
          },
          { merge: true },
        );
    }

    emitCaptureEvents(result, email, route.id, input.userId);

    logger.log(
      `[marketing] captured ${email} via ${route.id} ` +
        `(created=${result.created}, consentGranted=${result.consentGranted})`,
    );

    return {
      ok: true,
      id: result.id,
      created: result.created,
      route: route.id,
      consentGranted: result.consentGranted,
    };
  } catch (err) {
    logger.error('[marketing] capture failed:', err instanceof Error ? err.message : String(err));
    return { ok: false, error: 'Could not record that address. Please try again.', status: 500 };
  }
}

/**
 * Raise the trigger-bus events for a capture.
 *
 * Two distinct events, because they answer different questions and journeys
 * want different ones:
 *
 *   - `subscriberCreated` — we now know this person. Fires once, ever, whether
 *     or not they may be mailed.
 *   - `consentGranted` — they may now be mailed. This is the one a nurture
 *     sequence should trigger on: on a single opt-in route it fires alongside
 *     creation, and on a confirmed opt-in route it fires later, when the
 *     confirmation link is actually clicked.
 *
 * Both carry the route, so a journey can be narrowed to one magnet.
 *
 * The address is passed explicitly: the emitter resolves a subscriber from an
 * email by hashing it, but from a userId only by querying. Since the engine
 * discards any event it cannot attribute to a subscriber, handing it the
 * address is both cheaper and the difference between an event that enrols
 * someone and one that is silently dropped.
 */
function emitCaptureEvents(
  result: { id: string; created: boolean; consentGranted: boolean },
  email: string,
  routeId: string,
  userId?: string,
): void {
  const payload = { route: routeId };

  if (result.created) {
    emitMarketingEventAsync('subscriberCreated', { email, userId, payload });
  }
  if (result.consentGranted) {
    emitMarketingEventAsync('consentGranted', { email, userId, payload });
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
