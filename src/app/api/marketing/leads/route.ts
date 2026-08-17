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

/** Magnet names the marketing site uses, mapped to the tag applied here. */
const KNOWN_SOURCES: Record<string, string> = {
  free_hyrox_plan: 'magnet:free-plan',
  sign_up: 'magnet:signup',
  build_a_bigger_engine: 'magnet:vo2max-guide',
  hyrox_rules_card: 'magnet:race-card',
};

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

  const sourceTag = body.source ? KNOWN_SOURCES[body.source] : undefined;

  // Tags come from another service, so they are constrained rather than
  // trusted — an unbounded tag write would let a compromised marketing site
  // place people into any segment.
  const safeTags = (body.tags ?? [])
    .filter((t) => typeof t === 'string' && /^[a-z0-9:-]{1,40}$/.test(t))
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
    email: body.email,
    name: body.name,
    source: 'landing',
    tags: ['source:website', ...(sourceTag ? [sourceTag] : []), ...safeTags],
    // Requesting a lead magnet is not the same as agreeing to ongoing
    // marketing. The marketing site says which it was; absent that, the
    // conservative reading applies and the person is stored but not mailed.
    consent: body.consent === true,
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

  logger.log(`[marketing/leads] ingested ${body.source ?? 'website'} lead (created=${result.created})`);

  return NextResponse.json({
    success: true,
    created: result.created,
    suppressed,
    status: subscriber?.status ?? 'active',
  });
}
