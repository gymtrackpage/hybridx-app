// src/app/api/marketing/leads/route.ts
//
// Lead intake from the marketing site.
//
// hybridx.club captures leads through its own magnets — the VO2max guide, the
// race-day card, the free plan — into its own Firestore project. Those people
// are the top of the funnel, and until this endpoint existed none of them
// reached the mailing system: the audience the marketing site exists to build
// was invisible to the system built to mail it.
//
// The marketing site calls this at write time, so a lead is mailable within
// seconds of submitting a form rather than after a nightly reconciliation.

import { NextResponse } from 'next/server';
import { guardBridge } from '@/lib/marketing/bridge-auth';
import { captureLead, type CaptureAttribution } from '@/lib/marketing/capture';
import { getSubscriberByEmail } from '@/lib/marketing/subscribers';
import { UNMAILABLE_STATUSES } from '@/lib/marketing/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface LeadBody {
  email?: string;
  name?: string;
  /** Which magnet produced this lead. */
  source?: string;
  /** Whether the person opted into ongoing marketing, as opposed to just requesting the asset. */
  consent?: boolean;
  consentMethod?: string;
  utm?: Record<string, string>;
  /** Extra tags, constrained below. */
  tags?: string[];
}

export async function POST(request: Request) {
  const blocked = guardBridge(request, 'leads');
  if (blocked) return blocked;

  let body: LeadBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // Tags come from another service, so they are constrained rather than
  // trusted — an unbounded tag write would let a compromised marketing site
  // place people into any segment. Route tags are applied by the registry, not
  // taken from the request, so this cannot be used to forge an origin.
  const safeTags = (body.tags ?? [])
    .filter((t) => typeof t === 'string' && /^[a-z0-9:-]{1,40}$/.test(t))
    .filter((t) => !t.startsWith('route:'))
    .slice(0, 5);

  const attribution: CaptureAttribution | undefined = body.utm
    ? {
        utmSource: body.utm.utm_source,
        utmMedium: body.utm.utm_medium,
        utmCampaign: body.utm.utm_campaign,
        utmTerm: body.utm.utm_term,
        utmContent: body.utm.utm_content,
      }
    : undefined;

  const result = await captureLead({
    // The site's own vocabulary: an established funnel's source name, or the
    // slug of one launched since the last deploy. Either resolves; a new one
    // registers itself rather than being swept into a shared bucket.
    route: body.source ?? '',
    routeHints: { property: 'website', seenFrom: 'lead-bridge' },
    email: body.email,
    name: body.name,
    tags: safeTags,
    // Requesting a lead magnet is not the same as agreeing to ongoing
    // marketing. The marketing site knows what its own form said, so its answer
    // wins; absent one, the route's posture applies, which is conservative.
    consent: typeof body.consent === 'boolean' ? body.consent : undefined,
    consentMethod: body.consentMethod ?? (body.source ? `magnet:${body.source}` : 'website'),
    attribution,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  // Tell the caller whether this address is suppressed, so a magnet flow can
  // decide what to do without a second round trip.
  const subscriber = await getSubscriberByEmail(body.email).catch(() => null);
  const suppressed = subscriber ? UNMAILABLE_STATUSES.includes(subscriber.status) : false;

  logger.log(
    `[marketing/leads] ingested ${body.source ?? 'website'} lead as route ${result.route} ` +
      `(created=${result.created})`,
  );

  return NextResponse.json({
    success: true,
    created: result.created,
    // Echoed so the marketing site can log which route its lead landed on, and
    // notice when a new magnet is still resolving to the unclassified route.
    route: result.route,
    suppressed,
    status: subscriber?.status ?? 'active',
  });
}
