// src/app/api/garmin/deregistration/route.ts
// Receives "user de-registration" pings from Garmin (sent when a user
// revokes consent inside Garmin Connect). Clears the local tokens.
//
// Configure this URL in the Garmin Developer Portal as your
// "User Permission Change" / "Deregistration" callback:
//   {NEXT_PUBLIC_APP_URL}/api/garmin/deregistration
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

interface DeregEntry {
  userId?: string;       // garmin user UUID
  userAccessToken?: string;
}

export async function POST(req: NextRequest) {
  let body: { deregistrations?: DeregEntry[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const entries = body.deregistrations ?? [];
  if (entries.length === 0) return NextResponse.json({ ok: true, cleared: 0 });

  const adminDb = getAdminDb();
  let cleared = 0;

  for (const entry of entries) {
    if (!entry.userId) continue;
    const q = await adminDb
      .collection('users')
      .where('garmin.garminUserId', '==', entry.userId)
      .limit(1)
      .get();
    if (q.empty) continue;
    try {
      await q.docs[0].ref.update({
        garmin: FieldValue.delete(),
        garminConnectedAt: FieldValue.delete(),
        garminPlanSync: FieldValue.delete(),
      });
      cleared++;
    } catch (e: any) {
      logger.error('Garmin deregistration: clear failed', {
        garminUserId: entry.userId,
        err: e.message,
      });
    }
  }

  return NextResponse.json({ ok: true, cleared });
}
