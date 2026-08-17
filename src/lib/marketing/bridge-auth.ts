// src/lib/marketing/bridge-auth.ts
//
// Shared-secret authentication for the marketing-site bridge.
//
// hybridx.club (a separate Next.js app in its own Firebase project) needs to
// push captured leads into this system and ask whether an address is
// suppressed. Those calls are server-to-server, so there is no Firebase
// session to verify — a shared secret is the appropriate mechanism.
//
// Deliberately separate from CRON_SECRET: the marketing site holding a
// credential that also unlocks the send cron would be more authority than it
// needs.

import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

/**
 * Verify the bridge secret in constant time.
 *
 * Accepts the secret as a bearer token or an `x-bridge-secret` header. Returns
 * false when unconfigured, so an unset secret fails closed rather than
 * accepting everything.
 */
export function isBridgeAuthorised(request: Request): boolean {
  const expected = process.env.LEAD_BRIDGE_SECRET;
  if (!expected || expected.length < 32) return false;

  const supplied =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    request.headers.get('x-bridge-secret') ??
    '';

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Guard a bridge route. Returns a ready 401/429 response, or null when the
 * caller may proceed.
 *
 * Rate-limited on the secret rather than the IP, because every legitimate call
 * comes from one origin: a limit per IP would either be useless or would throttle
 * the marketing site as a whole.
 */
export function guardBridge(
  request: Request,
  bucket: string,
  max = 300,
): NextResponse | null {
  if (!isBridgeAuthorised(request)) {
    logger.error(`[marketing/bridge] rejected unauthenticated call to ${bucket}`);
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const rl = checkRateLimit(`bridge:${bucket}`, 60_000, max);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  return null;
}

/** Whether the bridge is usable at all. Surfaced in the settings health panel. */
export function isBridgeConfigured(): boolean {
  const value = process.env.LEAD_BRIDGE_SECRET;
  return !!value && value.length >= 32;
}
