// src/app/api/ai/analyze-week/route.ts
import { NextResponse } from 'next/server';
import { analyzeAndAdjust } from '@/ai/flows/analyze-and-adjust';
import { getUser } from '@/services/user-service'; // Fixed import to use server-side service
import { getAllUserSessions } from '@/services/session-service-client'; // This is still okay to query from client SDK in server route for simplicity, or should be moved to admin SDK if auth issues arise
import { getProgram } from '@/services/program-service'; // Server-side
import { getWorkoutForDay } from '@/lib/workout-utils';

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
        // Using client SDK on server is technically possible but better to use admin.
        // For quick fix, ensuring getAllUserSessions works. It uses client DB instance.
        // Since this is an API route, we should technically use Admin SDK for everything to bypass RLS if needed,
        // but if public access is allowed or auth is passed, client SDK works.
        // However, 'getUserClient' was definitely wrong as it expects client-side Firebase Auth state.
        const allSessions = await getAllUserSessions(userId);
        // Sort explicitly just in case, though service usually orders them
        const sortedSessions = allSessions.sort((a, b) => b.workoutDate.getTime() - a.workoutDate.getTime());
        const recentHistory = sortedSessions.slice(0, 5).map(s => ({
            date: s.workoutDate.toISOString().split('T')[0],
            workoutTitle: s.workoutTitle,
            notes: s.notes || '',
            skipped: s.skipped
        }));

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
