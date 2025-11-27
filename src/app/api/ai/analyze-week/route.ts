// src/app/api/ai/analyze-week/route.ts
import { NextResponse } from 'next/server';
import { analyzeAndAdjust } from '@/ai/flows/analyze-and-adjust';
import { getUser } from '@/services/user-service'; // Fixed import to use server-side service
import { getAdminDb } from '@/lib/firebase-admin'; // Use Admin DB for session querying
import { getProgram } from '@/services/program-service'; // Server-side
import { getWorkoutForDay } from '@/lib/workout-utils';
import { Timestamp } from 'firebase-admin/firestore';

// Mocking session auth for this example, in real app use NextAuth or Firebase Admin verification
export async function POST(request: Request) {
    try {
        console.log('[Analyze Week] Starting analysis...');
        const body = await request.json();
        const { userId, customRequest } = body;
        console.log('[Analyze Week] User ID:', userId);
        console.log('[Analyze Week] Custom Request:', customRequest || 'None');

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // 1. Fetch User Profile
        console.log('[Analyze Week] Fetching user profile...');
        const user = await getUser(userId);
        console.log('[Analyze Week] User found:', !!user, 'Has program:', !!user?.programId, 'Has startDate:', !!user?.startDate);

        if (!user || !user.programId || !user.startDate) {
            return NextResponse.json({ error: 'User or program data missing' }, { status: 404 });
        }

        // 2. Fetch Recent History (last 5 sessions)
        console.log('[Analyze Week] Fetching recent workout history...');
        const adminDb = getAdminDb();
        const sessionsRef = adminDb.collection('workoutSessions');
        const sessionsSnapshot = await sessionsRef
            .where('userId', '==', userId)
            .orderBy('workoutDate', 'desc')
            .limit(5)
            .get();

        const recentHistory = sessionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
                date: data.workoutDate.toDate().toISOString().split('T')[0],
                workoutTitle: data.workoutTitle,
                notes: data.notes || '',
                skipped: data.skipped || false
            };
        });
        console.log('[Analyze Week] Found', recentHistory.length, 'recent sessions');

        // 3. Fetch Upcoming Workouts (next 7 days)
        console.log('[Analyze Week] Fetching program:', user.programId);
        const program = await getProgram(user.programId);
        if (!program) {
             return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }
        console.log('[Analyze Week] Program found:', program.name);

        // If user has a custom program override, we should respect that, but for now let's analyze the base vs custom
        const sourceProgram = user.customProgram ? { ...program, workouts: user.customProgram } : program;

        const today = new Date();
        const upcomingWorkouts: any[] = [];
        for (let i = 1; i <= 7; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + i);
            const w = getWorkoutForDay(sourceProgram, user.startDate, targetDate);
            if (w.workout) {
                const workout = w.workout;

                // Ensure RunningWorkout has exercises array (even if empty) for schema compatibility
                // IMPORTANT: Keep the original workout.day (cycle day), do NOT overwrite with w.day (absolute day)
                if (workout.programType === 'running' && !('exercises' in workout)) {
                    upcomingWorkouts.push({
                        ...(workout as any),
                        exercises: [],
                    });
                } else {
                    upcomingWorkouts.push(workout);
                }
            }
        }

        console.log('[Analyze Week] Found', upcomingWorkouts.length, 'upcoming workouts');

        if (upcomingWorkouts.length === 0) {
             return NextResponse.json({ analysis: "No upcoming workouts found to adjust.", needsAdjustment: false });
        }

        // 4. Run AI Analysis
        console.log('[Analyze Week] Running AI analysis...');
        if (!user.firstName || !user.goal) {
            console.warn("Missing user details for AI prompt, using defaults");
        }

        const aiResult = await analyzeAndAdjust({
            userName: user.firstName || "Athlete",
            userGoal: user.goal || "Improve Fitness",
            recentHistory,
            upcomingWorkouts: upcomingWorkouts as any, // Cast due to complex union types in workout
            customRequest: customRequest || undefined, // Include custom request if provided
        });

        console.log('[Analyze Week] AI analysis complete, needsAdjustment:', aiResult.needsAdjustment);
        return NextResponse.json(aiResult);

    } catch (error: any) {
        console.error("Analysis error:", error);
        console.error("Error stack:", error.stack);
        console.error("Error details:", JSON.stringify(error, null, 2));
        return NextResponse.json({
            error: error.message || 'Unknown error occurred',
            details: error.toString()
        }, { status: 500 });
    }
}
