// src/app/api/marketing/unsubscribe-link/route.ts
//
// Mint a one-click unsubscribe URL for an address, on behalf of another
// property.
//
// The marketing site sends its own mail — magnets, confirmations — and until
// now the only unsubscribe it could offer was a mailto: to a human inbox. That
// fails twice over: Gmail and Yahoo have required a one-click HTTPS endpoint of
// bulk senders since February 2024, and an opt-out that lands in somebody's
// inbox never reaches the suppression list at all. The list was shared in one
// direction only — this app could tell the site who had complained, the site
// could never tell this app that someone had left.
//
// The signing key stays here. The alternative — handing MARKETING_TOKEN_SECRET
// to the other project so it could mint its own — would put the key that makes
// every unsubscribe and tracking link unforgeable in two places, to save one
// HTTP call on a few messages a minute.

import { NextResponse } from 'next/server';
import { guardBridge } from '@/lib/marketing/bridge-auth';
import { isPlausibleEmail, subscriberId } from '@/lib/marketing/subscribers';
import { createToken, isTokenSecretConfigured, UNSUBSCRIBE_TTL_SECONDS } from '@/lib/marketing/tokens';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const blocked = guardBridge(request, 'unsubscribe-link', 600);
  if (blocked) return blocked;

  if (!isTokenSecretConfigured()) {
    // Fail loudly rather than returning an unsigned or absent link. The caller
    // falls back to a mailto, which is worse but honest; a link that does not
    // work is worse than one that is merely inconvenient.
    logger.error('[marketing/unsubscribe-link] MARKETING_TOKEN_SECRET is not configured');
    return NextResponse.json({ error: 'Link signing is not configured.' }, { status: 503 });
  }

  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (!body.email || !isPlausibleEmail(body.email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  // No campaign: this is list mail from another property, not a campaign send,
  // so there is nothing to attribute the unsubscribe to. The token format
  // carries an empty campaign id, and the unsubscribe route already skips
  // attribution when one is absent.
  const token = createToken(
    'unsubscribe',
    subscriberId(body.email),
    '',
    UNSUBSCRIBE_TTL_SECONDS,
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hybridx.club';

  return NextResponse.json({
    url: `${appUrl}/api/marketing/unsubscribe?t=${encodeURIComponent(token)}`,
    // So the caller can set List-Unsubscribe-Post honestly: one-click is only
    // valid when the endpoint genuinely accepts a POST, and this one does.
    oneClick: true,
  });
}
