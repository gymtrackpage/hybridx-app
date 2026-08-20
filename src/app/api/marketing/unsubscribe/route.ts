// src/app/api/marketing/unsubscribe/route.ts
//
// Unsubscribe, by signed token.
//
// Two entry points, both required:
//   GET  — the link in the email footer, ending on a confirmation page.
//   POST — RFC 8058 one-click, which the mail client calls by itself when the
//          reader presses its own unsubscribe button. Gmail and Yahoo have
//          required this of bulk senders since February 2024.
//
// The previous implementation took a bare subscriberId in the query string, so
// anyone could unsubscribe anyone by guessing an id.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { CAMPAIGNS, sendDocId } from '@/lib/marketing/queue';
import { SUBSCRIBERS, suppressSubscriber } from '@/lib/marketing/subscribers';
import { verifyToken } from '@/lib/marketing/tokens';
import type { Subscriber } from '@/lib/marketing/types';

export const dynamic = 'force-dynamic';

async function unsubscribe(token: string | null): Promise<{ ok: boolean; reason?: string }> {
  if (!token) return { ok: false, reason: 'missing-token' };

  const verified = verifyToken(token, 'unsubscribe');
  if (!verified.valid) return { ok: false, reason: verified.reason };

  const { subscriberId, campaignId } = verified.payload;
  const db = getAdminDb();

  try {
    const subSnap = await db.collection(SUBSCRIBERS).doc(subscriberId).get();
    const wasActive = subSnap.exists && (subSnap.data() as Subscriber).status === 'active';

    // createTombstone: this endpoint also serves mail sent by the marketing
    // site, which can go out before the subscriber write has landed. Without
    // it, an opt-out on the very first email would be silently discarded.
    await suppressSubscriber(subscriberId, 'unsubscribed', 'email-link', {
      createTombstone: true,
    });

    // Clear the athlete's own preference too, so the profile toggle reflects
    // reality rather than claiming they are still subscribed.
    const userId = (subSnap.data() as Subscriber | undefined)?.userId;
    if (userId) {
      await db.collection('users').doc(userId).update({
        marketingConsent: false,
        marketingUnsubscribedAt: FieldValue.serverTimestamp(),
      }).catch((err) => logger.error('[unsubscribe] could not clear user consent:', err));
    }

    // Attribute the unsubscribe to the campaign that prompted it — the number
    // that tells you a campaign misjudged its audience. Counted only when the
    // subscriber was active, so a second click on an old link does not inflate
    // the campaign's total.
    if (campaignId && wasActive) {
      const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
      await campaignRef
        .update({ unsubscribeCount: FieldValue.increment(1) })
        .catch(() => undefined);
      await campaignRef
        .collection('sends')
        .doc(sendDocId(campaignId, subscriberId))
        .update({ unsubscribed: true, unsubscribedAt: FieldValue.serverTimestamp() })
        .catch(() => undefined);
    }

    return { ok: true };
  } catch (err) {
    logger.error('[unsubscribe] failed:', err instanceof Error ? err.message : String(err));
    return { ok: false, reason: 'error' };
  }
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  const result = await unsubscribe(token);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
  const target = new URL('/unsubscribed', appUrl);
  if (!result.ok) target.searchParams.set('error', result.reason ?? 'unknown');

  return NextResponse.redirect(target);
}

/**
 * One-click unsubscribe. The mail client sends this without any user-visible
 * page, so it must succeed on its own and must never require a confirmation
 * step — RFC 8058 is explicit that a further click would defeat the purpose.
 */
export async function POST(request: Request) {
  // The token may arrive in the query string or, per RFC 8058, in the body.
  let token = new URL(request.url).searchParams.get('t');
  if (!token) {
    try {
      const body = await request.text();
      token = new URLSearchParams(body).get('t');
    } catch {
      // Body is optional; the query string is the normal case.
    }
  }

  const result = await unsubscribe(token);
  if (!result.ok) {
    logger.log(`[unsubscribe] one-click rejected: ${result.reason}`);
    // Deliberately still 200: a mail client that sees an error may retry
    // indefinitely, and the reader has already expressed their wish.
  }
  return new NextResponse(null, { status: 200 });
}
