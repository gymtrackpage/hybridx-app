// src/app/api/marketing/suppression/route.ts
//
// One suppression list, shared across properties.
//
// hybridx.club sends its own magnet and confirmation email. Without this, an
// unsubscribe or spam complaint recorded here would be invisible to it, and
// someone who opted out of campaigns could still receive email from the
// marketing site — the exact pattern that produces complaints and damages a
// sending domain both properties now share.
//
// Note this endpoint answers "is this address suppressed", which is an
// enumeration oracle for anyone holding the secret. That is acceptable for a
// server-to-server credential we control, and is why it is rate-limited and
// not reachable with a session cookie.

import { NextResponse } from 'next/server';
import { guardBridge } from '@/lib/marketing/bridge-auth';
import { getSubscriberByEmail, isPlausibleEmail } from '@/lib/marketing/subscribers';
import { UNMAILABLE_STATUSES } from '@/lib/marketing/types';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const blocked = guardBridge(request, 'suppression', 600);
  if (blocked) return blocked;

  const email = new URL(request.url).searchParams.get('email');
  if (!email || !isPlausibleEmail(email)) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
  }

  try {
    const subscriber = await getSubscriberByEmail(email);

    // An address we have never seen is not suppressed — the marketing site
    // reaches people who have had no contact with the app at all.
    if (!subscriber) {
      return NextResponse.json({ suppressed: false, complained: false, status: 'unknown' });
    }

    return NextResponse.json({
      suppressed: UNMAILABLE_STATUSES.includes(subscriber.status),
      // Called out separately: a complaint is the one state that should block
      // even a transactional send, because mailing a complainant again risks
      // the domain for every other recipient.
      complained: subscriber.status === 'complained',
      status: subscriber.status,
    });
  } catch (err) {
    logger.error('[marketing/suppression] lookup failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 });
  }
}
