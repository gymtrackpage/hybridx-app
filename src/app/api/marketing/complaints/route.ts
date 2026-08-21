// src/app/api/marketing/complaints/route.ts
//
// The complainant list, for another property to mirror locally.
//
// The marketing site checks suppression on every send. That check is correct —
// mailing someone who has reported us as spam endangers delivery for everyone
// on a domain both properties share — but it sits on the awaited path of a form
// submission, costing a cross-project round trip before a guide the visitor is
// waiting on can go out. Serving the list instead lets the site answer the
// question locally and keep the live lookup as a backstop.
//
// Only spam complaints. Not unsubscribes, and not bounces: the site's own mail
// is a thing the recipient asked for seconds earlier, and withholding a guide
// because someone once unsubscribed from a campaign fails the person while
// solving nothing. A complaint is the one state that must block everything.
//
// Addresses are returned hashed. They are already stored as sha256 document
// ids, so this ships no new information — and it means a mirror sitting in
// another project is not a plaintext list of people who complained about us.

import { NextResponse } from 'next/server';
import { guardBridge } from '@/lib/marketing/bridge-auth';
import { SUBSCRIBERS } from '@/lib/marketing/subscribers';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * Ceiling on one response.
 *
 * Complaints are rare — a healthy list produces a handful a year — so reaching
 * this means something is badly wrong, and the honest answer is to say the list
 * was truncated rather than to hand back a partial one the caller would treat
 * as complete.
 */
const MAX_HASHES = 10_000;

export async function GET(request: Request) {
  const blocked = guardBridge(request, 'complaints', 120);
  if (blocked) return blocked;

  try {
    const snap = await getAdminDb()
      .collection(SUBSCRIBERS)
      .where('status', '==', 'complained')
      .select() // ids only — the document bodies are not needed and not wanted
      .limit(MAX_HASHES + 1)
      .get();

    const truncated = snap.size > MAX_HASHES;
    const hashes = snap.docs.slice(0, MAX_HASHES).map((d) => d.id);

    if (truncated) {
      logger.error(
        `[marketing/complaints] more than ${MAX_HASHES} complainants; response truncated`,
      );
    }

    return NextResponse.json(
      {
        // sha256 of the lowercased, trimmed address — the same derivation the
        // caller must apply to check membership.
        algorithm: 'sha256(lowercased-trimmed-email)',
        hashes,
        count: hashes.length,
        truncated,
        syncedAt: new Date().toISOString(),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (err) {
    logger.error(
      '[marketing/complaints] lookup failed:',
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json({ error: 'Lookup failed.' }, { status: 500 });
  }
}
