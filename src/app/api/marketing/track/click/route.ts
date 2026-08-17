// src/app/api/marketing/track/click/route.ts
//
// Click tracking and redirect.

import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { isScannerClick } from '@/lib/marketing/bots';
import { CAMPAIGNS, sendDocId } from '@/lib/marketing/queue';
import { SUBSCRIBERS } from '@/lib/marketing/subscribers';
import { verifyToken } from '@/lib/marketing/tokens';

export const dynamic = 'force-dynamic';

/**
 * Only redirect to http(s).
 *
 * The destination arrives as a query parameter, so without this the endpoint
 * would happily bounce a visitor to `javascript:` or `data:` — an open
 * redirect wearing our domain, which is exactly what a phisher wants to borrow.
 */
function safeRedirectUrl(raw: string | null): URL | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const destination = safeRedirectUrl(params.get('url'));
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

  // An unusable destination sends the reader somewhere real rather than showing
  // them an error — they clicked a link in good faith.
  if (!destination) {
    logger.log('[track/click] missing or unsafe destination');
    return NextResponse.redirect(appUrl);
  }

  const token = params.get('t');
  const verified = token ? verifyToken(token, 'track') : null;

  if (!verified?.valid) {
    logger.log(`[track/click] unverified click: ${verified?.reason ?? 'no-token'}`);
    return NextResponse.redirect(destination);
  }

  const { subscriberId, campaignId } = verified.payload;

  if (!isScannerClick(request)) {
    try {
      const db = getAdminDb();
      const campaignRef = db.collection(CAMPAIGNS).doc(campaignId);
      const sendRef = campaignRef.collection('sends').doc(sendDocId(campaignId, subscriberId));

      await db.runTransaction(async (tx) => {
        const sendSnap = await tx.get(sendRef);
        if (!sendSnap.exists || sendSnap.data()?.clicked) return;

        tx.update(sendRef, { clicked: true, clickedAt: FieldValue.serverTimestamp() });
        tx.update(campaignRef, { clickCount: FieldValue.increment(1) });
        tx.update(db.collection(SUBSCRIBERS).doc(subscriberId), {
          clickCount: FieldValue.increment(1),
        });
      });

      // Per-URL totals, counting every click rather than only the first per
      // person — this is what tells you which link in the email worked.
      const urlHash = createHash('sha256').update(destination.toString()).digest('hex').slice(0, 20);
      await campaignRef.collection('linkClicks').doc(urlHash).set(
        {
          url: destination.toString(),
          clickCount: FieldValue.increment(1),
          lastClickedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      logger.error('[track/click] failed:', err instanceof Error ? err.message : String(err));
    }
  }

  return NextResponse.redirect(destination);
}
