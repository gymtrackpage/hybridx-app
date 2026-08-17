// src/app/api/marketing/capture/route.ts
//
// Public lead capture for the marketing site. Unauthenticated by design — the
// whole point is to collect addresses from people who do not have an account
// yet — so it is rate-limited per IP and never reveals whether an address is
// already known.

import { NextResponse } from 'next/server';
import { captureLead, checkCaptureRate, type CaptureAttribution } from '@/lib/marketing/capture';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

interface CaptureBody {
  email?: string;
  name?: string;
  tags?: string[];
  consent?: boolean;
  attribution?: CaptureAttribution;
}

export async function POST(request: Request) {
  const rate = checkCaptureRate(request, 'marketing:capture');
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }

  let body: CaptureBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.email) {
    return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
  }

  // Submitting this form *is* the opt-in, but the client must say so
  // explicitly: a form that collects an address for some other purpose should
  // not silently enrol anyone in marketing.
  if (body.consent !== true) {
    return NextResponse.json(
      { error: 'Consent is required to join the mailing list.' },
      { status: 400 },
    );
  }

  // Tags come from an unauthenticated caller, so they are constrained rather
  // than trusted — otherwise anyone could add themselves to a `vip` segment.
  const safeTags = (body.tags ?? [])
    .filter((t) => typeof t === 'string' && /^[a-z0-9:-]{1,40}$/.test(t))
    .slice(0, 5)
    .map((t) => `lead:${t}`);

  const result = await captureLead({
    email: body.email,
    name: body.name,
    source: 'landing',
    tags: ['source:landing', ...safeTags],
    consent: true,
    consentMethod: 'landing-form',
    attribution: body.attribution,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  logger.log('[marketing] landing capture accepted');

  // Deliberately uniform: the response is identical whether the address was new
  // or already present, so this endpoint cannot be used to test who is on the
  // list.
  return NextResponse.json({ success: true });
}
