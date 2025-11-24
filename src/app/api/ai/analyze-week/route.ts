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
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json({ error: 'User ID required' }, { status: 400 });
        }

        // 1. Fetch User Profile
        // Changed to use the Admin SDK version of getUser
        const user = await getUser(userId);
        
        if (!user || !user.programId || !user.startDate) {
            return NextResponse.json({ error: 'User or program data missing' }, { status: 404 });
        }

        // 2. Fetch Recent History (last 5 sessions)
        // Using Admin SDK to bypass potential client-side auth issues in API route
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

        // 3. Fetch Upcoming Workouts (next 7 days)
        const program = await getProgram(user.programId);
        if (!program) {
             return NextResponse.json({ error: 'Program not found' }, { status: 404 });
        }

        // If user has a custom program override, we should respect that, but for now let's analyze the base vs custom
        const sourceProgram = user.customProgram ? { ...program, workouts: user.customProgram } : program;

        const today = new Date();
        const upcomingWorkouts = [];
        for (let i = 1; i <= 7; i++) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() + i);
            const w = getWorkoutForDay(sourceProgram, user.startDate, targetDate);
            if (w.workout) {
                upcomingWorkouts.push({
                    ...w.workout,
                    day: w.day // Explicit day number for reference
                });
            }
        }

        if (upcomingWorkouts.length === 0) {
             return NextResponse.json({ analysis: "No upcoming workouts found to adjust.", needsAdjustment: false });
        }

        // 4. Run AI Analysis
        // Ensure inputs are valid
        if (!user.firstName || !user.goal) {
            console.warn("Missing user details for AI prompt, using defaults");
        }

        const aiResult = await analyzeAndAdjust({
            userName: user.firstName || "Athlete",
            userGoal: user.goal || "Improve Fitness",
            recentHistory,
            upcomingWorkouts: upcomingWorkouts as any // Cast due to complex union types in workout
        });

        return NextResponse.json(aiResult);

    } catch (error: any) {
        console.error("Analysis error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
