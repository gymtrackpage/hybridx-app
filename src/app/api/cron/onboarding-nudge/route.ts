/**
 * Onboarding nudge cron — runs daily, fires 3-email sequence at users
 * who signed up but haven't completed a workout yet.
 *
 * Day windows (relative to trialStartDate):
 *   Nudge 1 (day 2)  — quick-start users (onboardingSkipped) with no completed workouts
 *   Nudge 2 (day 6)  — all users with no completed workouts
 *   Nudge 3 (day 10) — all users still with no completed workouts (final push)
 *
 * Trigger: GET /api/cron/onboarding-nudge
 * Header:  Authorization: Bearer <CRON_SECRET>
 */
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  sendOnboardingNudge1,
  sendOnboardingNudge2,
  sendOnboardingNudge3,
} from '@/lib/email-service';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/** Returns the start and end of a 24-hour window that is `daysAgo` days before now. */
function dayWindow(daysAgo: number): { start: Date; end: Date } {
  const now = Date.now();
  return {
    start: new Date(now - (daysAgo + 1) * 864e5),
    end: new Date(now - daysAgo * 864e5),
  };
}

/** Returns true if the user has at least one completed (non-skipped) workout. */
async function hasCompletedWorkout(db: FirebaseFirestore.Firestore, userId: string): Promise<boolean> {
  const snap = await db
    .collection('workoutSessions')
    .where('userId', '==', userId)
    .where('skipped', '!=', true)
    .limit(1)
    .get();
  return snap.docs.some((d) => !!d.data().finishedAt);
}

export async function GET(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = getAdminDb();
  const usersRef = db.collection('users');
  const sent = { nudge1: 0, nudge2: 0, nudge3: 0 };

  // ── Nudge 1 (day 2): quick-start users with no workouts ──────────────────
  const w2 = dayWindow(2);
  const snap2 = await usersRef
    .where('trialStartDate', '>=', Timestamp.fromDate(w2.start))
    .where('trialStartDate', '<=', Timestamp.fromDate(w2.end))
    .where('onboardingSkipped', '==', true)
    .get();

  for (const doc of snap2.docs) {
    const u = doc.data();
    if (!u.email) continue;
    if (u.nudge1SentAt) continue;
    if (await hasCompletedWorkout(db, doc.id)) continue;
    const result = await sendOnboardingNudge1(u.email, u.firstName);
    if (result?.success) {
      await doc.ref.update({ nudge1SentAt: FieldValue.serverTimestamp() });
      sent.nudge1++;
    }
  }

  // ── Nudge 2 (day 6): all users with no workouts ───────────────────────────
  const w6 = dayWindow(6);
  const snap6 = await usersRef
    .where('trialStartDate', '>=', Timestamp.fromDate(w6.start))
    .where('trialStartDate', '<=', Timestamp.fromDate(w6.end))
    .get();

  for (const doc of snap6.docs) {
    const u = doc.data();
    if (!u.email) continue;
    if (u.nudge2SentAt) continue;
    if (await hasCompletedWorkout(db, doc.id)) continue;
    const result = await sendOnboardingNudge2(u.email, u.firstName);
    if (result?.success) {
      await doc.ref.update({ nudge2SentAt: FieldValue.serverTimestamp() });
      sent.nudge2++;
    }
  }

  // ── Nudge 3 (day 10): all users still with no workouts ────────────────────
  const w10 = dayWindow(10);
  const snap10 = await usersRef
    .where('trialStartDate', '>=', Timestamp.fromDate(w10.start))
    .where('trialStartDate', '<=', Timestamp.fromDate(w10.end))
    .get();

  for (const doc of snap10.docs) {
    const u = doc.data();
    if (!u.email) continue;
    if (u.nudge3SentAt) continue;
    if (await hasCompletedWorkout(db, doc.id)) continue;
    const result = await sendOnboardingNudge3(u.email, u.firstName);
    if (result?.success) {
      await doc.ref.update({ nudge3SentAt: FieldValue.serverTimestamp() });
      sent.nudge3++;
    }
  }

  return NextResponse.json({ success: true, sent });
}
