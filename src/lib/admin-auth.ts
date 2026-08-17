// src/lib/admin-auth.ts
// Shared authorization helper for admin-only surfaces.
//
// Admin pages and their API routes are reached from the browser, so they
// authenticate with the `__session` cookie rather than a bearer token — the
// mirror image of `src/lib/api-auth.ts`, which serves the app's cross-origin
// (web + Capacitor) calls.
//
// Admin status lives on the athlete record (`users/{uid}.isAdmin`) and is
// server-managed: `firestore.rules` lists `isAdmin` among the protected fields
// a client may never write.

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

export interface AdminIdentity {
  uid: string;
  email?: string;
}

/**
 * Resolve the current admin from the session cookie, or `null`.
 *
 * Reads `isAdmin` straight off the user document rather than going through
 * `getUser()` — that helper hydrates the whole athlete profile (Strava tokens,
 * Garmin tokens, programs) which is wasted work for a boolean check.
 *
 * Safe to call from server components and layouts. Returns `null` for every
 * failure mode (no cookie, expired cookie, revoked session, missing user,
 * non-admin) so callers can treat "not an admin" uniformly.
 */
export async function getAdminUser(): Promise<AdminIdentity | null> {
  const sessionCookie = (await cookies()).get('__session')?.value;
  if (!sessionCookie) return null;

  try {
    // checkRevoked: true — an admin whose session was revoked loses access
    // immediately rather than at natural cookie expiry.
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);

    const snap = await getAdminDb().collection('users').doc(decoded.uid).get();
    if (snap.data()?.isAdmin !== true) return null;

    return { uid: decoded.uid, email: decoded.email };
  } catch (err) {
    logger.error('[admin-auth] Session verification failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

/**
 * Route-handler guard. Returns the caller's identity, or a ready-to-send
 * `NextResponse` (401 / 403 / 429) — check with `'response' in result`, the
 * same shape `requireUser` uses in `src/lib/api-auth.ts`:
 *
 * ```ts
 * const auth = await requireAdmin(request, { bucket: 'marketing:campaigns' });
 * if ('response' in auth) return auth.response;
 * ```
 *
 * @param opts.bucket   Rate-limit namespace, e.g. `"marketing:send"`
 * @param opts.windowMs Rolling window in ms (default 60s)
 * @param opts.max      Max requests per window per admin (default 30)
 */
export async function requireAdmin(
  _request: Request,
  opts: { bucket: string; windowMs?: number; max?: number },
): Promise<AdminIdentity | { response: NextResponse }> {
  const admin = await getAdminUser();

  if (!admin) {
    // Deliberately indistinguishable from a valid session belonging to a
    // non-admin: revealing which one it was tells an attacker whether they
    // hold a live session.
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const rl = checkRateLimit(`${opts.bucket}:${admin.uid}`, opts.windowMs ?? 60_000, opts.max ?? 30);
  if (!rl.allowed) {
    return {
      response: NextResponse.json(
        { error: 'Too many requests. Please wait before trying again.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) } },
      ),
    };
  }

  return admin;
}

/**
 * Server-action guard. Throws instead of returning a response, since actions
 * have no `NextResponse` to hand back — the thrown error surfaces to the
 * client as a failed action.
 */
export async function assertAdmin(bucket: string): Promise<AdminIdentity> {
  const admin = await getAdminUser();
  if (!admin) throw new Error('Forbidden: admin access required.');

  const rl = checkRateLimit(`${bucket}:${admin.uid}`, 60_000, 30);
  if (!rl.allowed) throw new Error('Too many requests. Please wait before trying again.');

  return admin;
}
