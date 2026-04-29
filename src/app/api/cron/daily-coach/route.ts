
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { analyzeAndAdjust } from '@/ai/flows/analyze-and-adjust';

import { FieldValue } from 'firebase-admin/firestore';
import type { User, Workout, RunningWorkout } from '@/models/types';

// Allow this route to run for up to 5 minutes (if platform supports it)
export const maxDuration = 300; 
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const db = getAdminDb();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const startOfYesterday = new Date(yesterday); startOfYesterday.setHours(0,0,0,0);
  const endOfYesterday = new Date(yesterday);   endOfYesterday.setHours(23,59,59,999);

  // 1. Get active users and ALL of yesterday's completed sessions in parallel — 2 queries total
  //    instead of 1 + N (one per user).
  const [usersSnap, sessionsSnap] = await Promise.all([
    db.collection('users').where('programId', '!=', null).get(),
    db.collection('workoutSessions')
      .where('finishedAt', '>=', startOfYesterday)
      .where('finishedAt', '<=', endOfYesterday)
      .get(),
  ]);

  // Build a Set of userIds who completed a session yesterday — O(1) lookup per user.
  const trainedYesterday = new Set(sessionsSnap.docs.map(d => d.data().userId as string));

  const results = {
    processed: 0,
    missed: 0,
    adjusted: 0,
    errors: 0
  };

  // 2. Collect unique programIds from users who missed, then batch-fetch those programs.
  const missedUsers = usersSnap.docs.filter(d => !trainedYesterday.has(d.id) && d.data().programId);
  const uniqueProgramIds = [...new Set(missedUsers.map(d => d.data().programId as string))];

  const programSnaps = await Promise.all(
    uniqueProgramIds.map(id => db.collection('programs').doc(id).get())
  );
  const programCache = new Map(
    programSnaps.filter(s => s.exists).map(s => [s.id, s.data()])
  );

  const updatePromises = usersSnap.docs.map(async (userDoc) => {
    try {
      const userData = userDoc.data() as User;
      const userId = userDoc.id;
      results.processed++;

      // 3. Skip users who trained yesterday (already fetched in batch above)
      if (trainedYesterday.has(userId)) return;

      if (!userData.programId) return;

      // Use the cached program — no per-user Firestore read needed
      const programData = programCache.get(userData.programId);
      if (!programData) return;

      const workouts = programData.workouts as (Workout | RunningWorkout)[];
      if (!workouts || !userData.startDate) return;

      results.missed++;

      const startDate = userData.startDate instanceof Date ? userData.startDate : new Date((userData.startDate as any).toDate?.() ?? userData.startDate);
      const diffTime = Math.abs(yesterday.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // Find TODAY's workout for the AI adjustment
      const todayDiffDays = diffDays + 1;
      const todaysWorkout = workouts.find(w => w.day === todayDiffDays);
      
      if (!todaysWorkout) return; // Rest day or end of program

      // Call AI
      const aiResponse = await analyzeAndAdjust({
        userName: userData.firstName,
        userGoal: userData.goal,
        recentHistory: [{
            date: yesterday.toISOString().split('T')[0],
            workoutTitle: "Scheduled Workout",
            skipped: true, // Key signal
            notes: "System detected missed session."
        }],
        upcomingWorkouts: [{...todaysWorkout, day: todayDiffDays} as any], // Just send today's for adjustment
        customRequest: "I missed yesterday. Should I adjust today?"
      });

      if (aiResponse.needsAdjustment && aiResponse.adjustments && aiResponse.adjustments.length > 0) {
        const newAdjustment = aiResponse.adjustments[0].modifiedWorkout;

        let currentCustom = userData.customProgram || [];
        currentCustom = currentCustom.filter(w => w.day !== newAdjustment.day);
        currentCustom.push(newAdjustment as any);

        await db.collection('users').doc(userId).update({
            customProgram: currentCustom
        });

        results.adjusted++;

        await db.collection('notifications').add({
            userId,
            title: "Plan Adjusted 🤖",
            body: `Since you missed yesterday, I've modified today's ${todaysWorkout.title} to be more manageable.`,
            read: false,
            createdAt: FieldValue.serverTimestamp(),
            type: 'ai-adjustment'
        });
      }

    } catch (err) {
      console.error(`Error processing user ${userDoc.id}:`, err);
      results.errors++;
    }
  });

  await Promise.all(updatePromises);

  return NextResponse.json({ success: true, results });
}
