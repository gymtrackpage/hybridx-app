// src/app/api/marketing/track/open/route.ts
//
// Open-tracking pixel. Ported from HXMailer with two changes: the recipient is
// identified by a signed token rather than raw ids in the query string, and
// machine opens are recorded separately from human ones.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { classifyTrackingHit } from '@/lib/marketing/bots';
import { CAMPAIGNS, sendDocId } from '@/lib/marketing/queue';
import { SUBSCRIBERS } from '@/lib/marketing/subscribers';
import { verifyToken } from '@/lib/marketing/tokens';

export const dynamic = 'force-dynamic';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64',
);

/** The pixel must render whatever happens — a tracking failure is not the reader's problem. */
function pixelResponse() {
  return new NextResponse(PIXEL, {
    headers: {
      'Content-Type': 'image/gif',
      'Content-Length': String(PIXEL.length),
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    },
  });
}

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('t');
  if (!token) return pixelResponse();

  const verified = verifyToken(token, 'track');
  if (!verified.valid) {
    logger.log(`[track/open] rejected token: ${verified.reason}`);
    return pixelResponse();
  }

  const { subscriberId, campaignId } = verified.payload;
  const verdict = classifyTrackingHit(request);

  try {
    const db = getAdminDb();
    const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
    const sendRef = campaignRef.collection('sends').doc(sendDocId(campaignId, subscriberId));

    await db.runTransaction(async (tx) => {
      const sendSnap = await tx.get(sendRef);
      if (!sendSnap.exists) return;

      // Every hit counts towards the raw total, including prefetches.
      tx.update(sendRef, { openRaw: FieldValue.increment(1) });
      if (verdict.isBot) return;

      // Only the first human open moves the headline counters, so a reader who
      // opens a message five times counts once.
      if (sendSnap.data()?.opened) return;

      tx.update(sendRef, { opened: true, openedAt: FieldValue.serverTimestamp() });
      tx.update(campaignRef, { openCount: FieldValue.increment(1) });
      tx.update(db.collection(SUBSCRIBERS).doc(subscriberId), {
        openCount: FieldValue.increment(1),
      });
    });
  } catch (err) {
    logger.error('[track/open] failed:', err instanceof Error ? err.message : String(err));
  }

  return pixelResponse();
}
