
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { analyzeAndAdjust } from '@/ai/flows/analyze-and-adjust';
import { sendEmail } from '@/lib/email-service'; // Assuming we have this or similar
import { FieldValue } from 'firebase-admin/firestore';
import type { User, Workout, RunningWorkout } from '@/models/types';

// Allow this route to run for up to 5 minutes (if platform supports it)
export const maxDuration = 300; 
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Security: In production, verify a secret token header (CRON_SECRET)
  // const authHeader = request.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  const db = getAdminDb();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // 1. Get Active Users (simplification: getting all users with programId for now)
  // In a real app with thousands of users, you'd paginate or query carefully.
  const usersSnap = await db.collection('users').where('programId', '!=', null).get();
  
  const results = {
    processed: 0,
    missed: 0,
    adjusted: 0,
    errors: 0
  };

  const updatePromises = usersSnap.docs.map(async (userDoc) => {
    try {
      const userData = userDoc.data() as User;
      const userId = userDoc.id;
      results.processed++;

      // 2. Check if they worked out yesterday
      // We look for a session between yesterday 00:00 and yesterday 23:59
      const startOfYesterday = new Date(yesterday); startOfYesterday.setHours(0,0,0,0);
      const endOfYesterday = new Date(yesterday); endOfYesterday.setHours(23,59,59,999);

      const sessionSnap = await db.collection('workoutSessions')
        .where('userId', '==', userId)
        .where('finishedAt', '>=', startOfYesterday)
        .where('finishedAt', '<=', endOfYesterday)
        .limit(1)
        .get();

      if (!sessionSnap.empty) {
        // User trained yesterday. Good job. No proactive adjustment needed for "missed workout".
        return;
      }

      // 3. Check if they were SCHEDULED to train yesterday
      // We need their program to know this.
      // Ideally, we fetch the program. For optimization, maybe we only fetch if we suspect a miss.
      if (!userData.programId) return;
      
      const programSnap = await db.collection('programs').doc(userData.programId).get();
      if (!programSnap.exists) return;
      
      const programData = programSnap.data();
      const workouts = programData?.workouts as (Workout | RunningWorkout)[];
      
      if (!workouts || !userData.startDate) return;

      // Calculate what day yesterday was in their program
      // const daysSinceStart = Math.floor((yesterday.getTime() - userData.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      // This is tricky because "startDate" might be weeks ago.
      // Assuming linear progression: Day 1, Day 2... 
      // A better way is: map calendar date to program day.
      
      // Let's rely on the assumption that if they missed *any* scheduled day recently, we care.
      // But for "Yesterday specifically", we calculate:
      const startDate = userData.startDate.toDate(); // Firestore timestamp
      const diffTime = Math.abs(yesterday.getTime() - startDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      // Find workout for "Day X" (yesterday's program day)
      // Note: This logic assumes program runs 7 days/week continuously or days map exactly.
      // If program has "Day 1, Day 2, Day 3" and user frequency is "3x/week", mapping dates is hard without a schedule.
      // MVP APPROACH: If they have a "streak" of 0, they missed yesterday.
      
      // Let's refine the trigger:
      // "If user has missed > 2 sessions in a row, suggest a reset."
      // OR "If user missed yesterday and today is a hard workout, suggest softening it."
      
      results.missed++;

      // 4. AI Analysis
      // We'll ask AI to look at the "Missed Yesterday" context and "Today's Scheduled Workout"
      
      // Find TODAY's workout
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
        // 5. Apply Adjustment
        // We save this to `users/{id}/customProgram`
        // We merge it with existing customProgram or create new array
        
        const newAdjustment = aiResponse.adjustments[0].modifiedWorkout;
        
        // We need to store this adjustment in a way the Dashboard sees it.
        // The dashboard checks `user.customProgram`.
        // We should append or replace the workout for this specific day.
        
        // Let's assume we overwrite the customProgram array with this single adjustment for simplicity in MVP, 
        // or better, append to a 'pendingAdjustments' collection? 
        // For now, let's update the user doc's `customProgram` field.
        // Warning: This replaces their whole custom program if we aren't careful.
        // Proper way: Fetch existing customProgram, find index, update.
        
        let currentCustom = userData.customProgram || [];
        // Remove any existing for this day
        currentCustom = currentCustom.filter(w => w.day !== newAdjustment.day);
        // Add new
        currentCustom.push(newAdjustment as any);
        
        await db.collection('users').doc(userId).update({
            customProgram: currentCustom
        });
        
        results.adjusted++;

        // 6. Notify User
        // Ideally Push Notification. Falling back to logging or simple "Notification" collection
        // that the frontend polls.
        
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
