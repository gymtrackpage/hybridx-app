// src/app/api/garmin/webhook/route.ts
// Receives Activity Push notifications from Garmin (Activities API).
//
// Garmin posts JSON shaped like:
//   {
//     "activities": [
//       { "userId": "<garminUserUuid>", "userAccessToken": "...", "activityId": 12345,
//         "activityName": "...", "summary": { ... }, ... }
//     ]
//   }
//
// We look up the local user by garmin.garminUserId, persist the raw
// activity into `garminActivities/{activityId}`, and acknowledge.
//
// Configure this URL as your "Activity Push" callback in the Garmin
// Developer Portal: {NEXT_PUBLIC_APP_URL}/api/garmin/webhook
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';

interface IncomingActivity {
  userId?: string;
  userAccessToken?: string;
  activityId: number | string;
  activityName?: string;
  summary?: Record<string, unknown>;
  samples?: unknown[];
  laps?: unknown[];
  [k: string]: unknown;
}

interface GarminWebhookBody {
  activities?: IncomingActivity[];
  activityDetails?: IncomingActivity[];
}

export async function POST(req: NextRequest) {
  let body: GarminWebhookBody;
  try {
    body = (await req.json()) as GarminWebhookBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const items = [...(body.activities ?? []), ...(body.activityDetails ?? [])];
  if (items.length === 0) {
    return NextResponse.json({ ok: true, received: 0 });
  }

  const adminDb = getAdminDb();
  let stored = 0;

  for (const act of items) {
    if (!act.activityId) {
      logger.warn('Garmin webhook: activity without id, skipping');
      continue;
    }

    let userId: string | null = null;
    if (act.userId) {
      const q = await adminDb
        .collection('users')
        .where('garmin.garminUserId', '==', act.userId)
        .limit(1)
        .get();
      if (!q.empty) userId = q.docs[0].id;
    }

    try {
      await adminDb.collection('garminActivities').doc(String(act.activityId)).set(
        {
          ...act,
          userId,
          garminUserId: act.userId ?? null,
          receivedAt: new Date(),
        },
        { merge: true },
      );
      stored++;
    } catch (e: any) {
      logger.error('Garmin webhook: failed to store activity', {
        activityId: act.activityId,
        err: e.message,
      });
    }
  }

  // Garmin requires a 200 quickly — ack with a count so we can debug.
  return NextResponse.json({ ok: true, received: items.length, stored });
}
