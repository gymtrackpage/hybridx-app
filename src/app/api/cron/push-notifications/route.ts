/**
 * Daily push notification cron job.
 * Runs every morning, finds today's workout for each subscribed user,
 * generates an AI message, and sends a push notification.
 *
 * Secure with CRON_SECRET header. In Vercel: set as a cron job at e.g. 0 7 * * *
 */

import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendPushToUser } from '@/lib/web-push';
import { notificationMessage } from '@/ai/flows/notification-message';
import { Timestamp } from 'firebase-admin/firestore';
import type { User, Workout, RunningWorkout } from '@/models/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function getTodayWorkout(
  workouts: (Workout | RunningWorkout)[],
  startDate: Date
): Workout | RunningWorkout | null {
  const now = new Date();
  const diffMs = now.getTime() - startDate.getTime();
  const dayNumber = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return workouts.find((w) => w.day === dayNumber) ?? null;
}

function workoutSummary(workout: Workout | RunningWorkout): string {
  if ('runs' in workout && workout.runs?.length) {
    return workout.runs
      .slice(0, 3)
      .map((r) => `${r.type} ${r.distance}km`)
      .join(', ');
  }
  if ('exercises' in workout && workout.exercises?.length) {
    return workout.exercises
      .slice(0, 3)
      .map((e: any) => e.name)
      .join(', ');
  }
  return workout.title;
}

/** Re-engagement message for users who haven't opened the app in 3+ days */
const RE_ENGAGEMENT_MESSAGES = [
  "Your training program is waiting — pick up where you left off 💪",
  "3 days since your last session. Time to get back on track!",
  "Your HYROX goals haven't changed. Have you? Come train 🔥",
  "The hardest part is showing up. Open the app and get moving.",
  "Don't lose your progress — your next workout is ready 🏋️",
];

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = getAdminDb();

  // Get all users with push subscriptions
  const subsSnap = await db.collection('pushSubscriptions').get();
  if (subsSnap.empty) {
    return NextResponse.json({ message: 'No push subscribers' });
  }

  // Build unique userId list from subscriptions
  const userIds = [...new Set(subsSnap.docs.map((d) => d.data().userId as string))];

  // Batch fetch users
  const userDocs = await Promise.all(
    userIds.map((id) => db.collection('users').doc(id).get())
  );

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  const results = { sent: 0, skipped: 0, errors: 0 };

  await Promise.all(
    userDocs.map(async (userDoc) => {
      if (!userDoc.exists) return;

      const user = userDoc.data() as User;
      const userId = userDoc.id;

      // Skip if trial ended / canceled
      const status = user.subscriptionStatus ?? 'trial';
      if (!['trial', 'active', 'paused'].includes(status)) {
        results.skipped++;
        return;
      }

      try {
        // Determine today's workout
        let workoutTitle = "Today's Training";
        let exerciseSummary = 'Keep up the great work!';
        let notifUrl = '/dashboard';

        if (user.programId && user.startDate) {
          const startDate =
            user.startDate instanceof Timestamp
              ? user.startDate.toDate()
              : new Date(user.startDate as any);

          const programDoc = await db.collection('programs').doc(user.programId).get();
          if (programDoc.exists) {
            const workouts = programDoc.data()?.workouts as (Workout | RunningWorkout)[];
            const customWorkouts = user.customProgram;
            const allWorkouts = customWorkouts?.length ? customWorkouts : workouts;
            const todayWorkout = getTodayWorkout(allWorkouts ?? [], startDate);

            if (todayWorkout) {
              workoutTitle = todayWorkout.title;
              exerciseSummary = workoutSummary(todayWorkout);
              notifUrl = '/workout';
            }
          }
        }

        // Check if this is a re-engagement scenario (no recent session)
        const recentSessionSnap = await db
          .collection('workoutSessions')
          .where('userId', '==', userId)
          .where('startedAt', '>=', Timestamp.fromDate(threeDaysAgo))
          .limit(1)
          .get();

        let messageBody: string;

        if (recentSessionSnap.empty) {
          // Re-engagement: pick a rotating message
          const idx = now.getDate() % RE_ENGAGEMENT_MESSAGES.length;
          messageBody = RE_ENGAGEMENT_MESSAGES[idx];
        } else {
          // Daily workout reminder: use AI
          try {
            const aiResult = await notificationMessage({
              userName: user.firstName || 'Athlete',
              workoutTitle,
              exercises: exerciseSummary,
            });
            messageBody = aiResult.message;
          } catch {
            messageBody = `${workoutTitle} is scheduled for today. Let's go! 💪`;
          }
        }

        const { sent } = await sendPushToUser(userId, {
          title: 'HYBRIDX Training',
          body: messageBody,
          url: notifUrl,
        });

        if (sent > 0) results.sent++;
        else results.skipped++;
      } catch (err) {
        console.error(`Push failed for user ${userId}:`, err);
        results.errors++;
      }
    })
  );

  return NextResponse.json({ success: true, results, subscribers: userIds.length });
}
