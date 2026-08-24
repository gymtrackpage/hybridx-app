// src/lib/cron-auth.ts
//
// Shared bearer check for every /api/cron/* endpoint.
//
// This lives in one place for two reasons. The first is that three routes had
// drifted into checking `authHeader !== `Bearer ${process.env.CRON_SECRET}``
// without first testing that the secret exists — when CRON_SECRET is unset that
// template renders the literal string "Bearer undefined", so anyone sending
// exactly that header was authenticated. Failing closed has to be the default,
// not something each route remembers to do.
//
// The second is diagnosis. A bare 401 tells you nothing, and Cloud Scheduler
// only reports the status it got back, so a misconfigured job looks identical
// to a rotated secret from the outside. These refusals log *why* — and via
// logger.error, because logger.log and logger.warn are compiled out in
// production and would leave the same silence that made this hard to chase.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on a length mismatch, so that has to be tested
  // first. Length is not the secret, so leaking it through timing is fine.
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Returns a 401 response if the request is not an authorised cron call, or
 * `null` if it is. Call as:
 *
 *   const denied = requireCronAuth(request, 'marketing-send');
 *   if (denied) return denied;
 *
 * `job` only labels the log line.
 */
export function requireCronAuth(request: Request, job: string): NextResponse | null {
  const deny = (reason: string) => {
    logger.error(`[cron/${job}] refused: ${reason}`);
    return new NextResponse('Unauthorized', { status: 401 });
  };

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return deny('CRON_SECRET is not set in this environment — the endpoint cannot authenticate anyone');
  }

  const header = request.headers.get('authorization');
  if (!header) return deny('request carried no Authorization header');

  // Split rather than slice off a "Bearer " prefix: header values are
  // whitespace-trimmed before they reach us, so a header sent as "Bearer "
  // with an empty token arrives as bare "Bearer" and would not match the
  // prefix at all. That case needs its own message, not a confusing
  // "not a Bearer token (scheme: Bearer)".
  const [scheme, ...rest] = header.split(' ');
  if (scheme.toLowerCase() !== 'bearer') {
    return deny(`Authorization header is not a Bearer token (scheme: ${scheme || '(empty)'})`);
  }

  const token = rest.join(' ');
  if (!token) {
    return deny(
      'Authorization header was "Bearer" with no token — when the Cloud Scheduler ' +
        'job was created the shell variable holding the secret was probably empty',
    );
  }
  if (!safeEqual(token, secret)) {
    // Lengths, never values. This is the line that distinguishes the failure
    // modes: a received length in the hundreds means something replaced the
    // header with a Google OIDC JWT; `expected` one longer than `received` is
    // usually a newline captured into the stored secret by `echo` without -n;
    // equal lengths that still mismatch mean the value is simply stale.
    return deny(
      `bearer token does not match CRON_SECRET (received ${token.length} chars, expected ${secret.length})`,
    );
  }

  return null;
}
