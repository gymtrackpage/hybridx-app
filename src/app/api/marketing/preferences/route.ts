// src/app/api/marketing/preferences/route.ts
//
// The athlete's own marketing-email toggle.
//
// This exists as a server route rather than a direct client write because the
// consent flag lives in two places — `users/{uid}.marketingConsent`, which the
// profile page reads, and `marketingSubscribers/{id}.consent.marketing`, which
// the send path actually checks. A client write would update only the first,
// leaving the system convinced it may still email someone who has just opted
// out. `firestore.rules` blocks that write for exactly this reason.

import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { requireUser } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { SUBSCRIBERS, resubscribe, subscriberId, suppressSubscriber } from '@/lib/marketing/subscribers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireUser(request, { bucket: 'marketing:prefs:read', max: 30 });
  if ('response' in auth) return auth.response;

  const snap = await getAdminDb().collection('users').doc(auth.uid).get();
  return NextResponse.json({ marketingConsent: snap.data()?.marketingConsent === true });
}

export async function POST(request: Request) {
  const auth = await requireUser(request, { bucket: 'marketing:prefs:write', max: 10 });
  if ('response' in auth) return auth.response;

  let body: { marketingConsent?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  if (typeof body.marketingConsent !== 'boolean') {
    return NextResponse.json({ error: 'marketingConsent must be a boolean.' }, { status: 400 });
  }

  const consent = body.marketingConsent;
  const db = getAdminDb();

  try {
    const userRef = db.collection('users').doc(auth.uid);
    const userSnap = await userRef.get();
    const email = userSnap.data()?.email as string | undefined;

    await userRef.update({
      marketingConsent: consent,
      ...(consent
        ? { marketingConsentAt: FieldValue.serverTimestamp() }
        : { marketingUnsubscribedAt: FieldValue.serverTimestamp() }),
    });

    // Mirror onto the subscriber record. An athlete with no subscriber row yet
    // (signed up before the sync ran) gets one created on opt-in; on opt-out
    // there is nothing to suppress and the user-document write is enough.
    if (email) {
      const id = subscriberId(email);
      if (consent) {
        const created = await resubscribe(id, 'profile-toggle');
        if (!created) {
          await db.collection(SUBSCRIBERS).doc(id).set(
            {
              email: email.toLowerCase(),
              firstName: userSnap.data()?.firstName ?? '',
              lastName: userSnap.data()?.lastName ?? '',
              tags: ['athlete'],
              status: 'active',
              source: 'signup',
              userId: auth.uid,
              consent: {
                marketing: true,
                at: FieldValue.serverTimestamp(),
                method: 'profile-toggle',
              },
              totalSent: 0,
              openCount: 0,
              clickCount: 0,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
        }
      } else {
        await suppressSubscriber(id, 'unsubscribed', 'profile-toggle');
      }
    }

    return NextResponse.json({ success: true, marketingConsent: consent });
  } catch (err) {
    logger.error('[marketing] preference update failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Could not update your preference.' }, { status: 500 });
  }
}
