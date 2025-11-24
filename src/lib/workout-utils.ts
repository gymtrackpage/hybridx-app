// src/lib/workout-utils.ts
import type { Program, Workout, RunningWorkout, Exercise } from '@/models/types';
import { differenceInDays, subDays, isSameDay } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

/**
 * A pure utility function to determine the correct workout for a given day based on a program's start date.
 * This function is safe to use on both the client and server.
 * @param program The training program object, which might contain a user's custom workout schedule.
 * @param startDate The start date of the program for the user.
 * @param targetDate The date for which to find the workout.
 * @returns An object containing the day number of the program and the workout object, or null if no workout is scheduled.
 */
export function getWorkoutForDay(
    program: Pick<Program, 'workouts'>, 
    startDate: Date, 
    targetDate: Date
): { day: number; workout: Workout | RunningWorkout | null; } {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const dayOfProgram = differenceInDays(target, start) + 1;
    
    if (dayOfProgram < 1) {
        return { day: dayOfProgram, workout: null };
    }

    const workouts = program.workouts;
    const cycleLength = Math.max(...workouts.map(w => w.day), 0);

    if (cycleLength === 0) {
        return { day: dayOfProgram, workout: null };
    }
    
    const dayInCycle = ((dayOfProgram - 1) % cycleLength) + 1;
    const workoutForDay = workouts.find(w => w.day === dayInCycle);

    return { day: dayOfProgram, workout: workoutForDay || null };
}

/**
 * Finds the last time a user performed a specific exercise.
 * @param userId The ID of the user.
 * @param exerciseName The name of the exercise to search for.
 * @returns A promise resolving to a string description of the last performance, or null if never performed.
 */
export async function getLastPerformedExercise(userId: string, exerciseName: string): Promise<string | null> {
    try {
        const sessionsRef = collection(db, 'workoutSessions');
        
        // We need to query sessions and then filter client-side or use a complex index
        // Since exercise details are nested in arrays, standard Firestore queries are limited without array-contains-any on objects
        // A more scalable approach would be to have a separate 'exerciseLogs' collection
        // For now, we'll query recent sessions and search within them
        
        const q = query(
            sessionsRef,
            where('userId', '==', userId),
            where('finishedAt', '!=', null),
            orderBy('finishedAt', 'desc'),
            limit(20) // Limit to last 20 workouts for performance
        );

        const snapshot = await getDocs(q);
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const exercises = [
                ...(data.workoutDetails?.exercises || []),
                ...(data.extendedExercises || [])
            ];
            
            // Also check runs if it's a running workout, though structure is different
             if (data.programType === 'running' && data.workoutDetails?.runs) {
                // Logic for runs if needed, skipping for now based on requirement "4 sets @ 60kg" implies strength
            }

            const found = exercises.find((e: any) => e.name === exerciseName);
            
            if (found) {
                // If details contains something like "4x8 @ 60kg", we can try to extract it
                // Or simply return the details from the previous session plan
                // The 'details' field in the workout object is the prescription, not the log.
                // However, without a dedicated log per exercise (feature request: actual weight logging),
                // the best we can do is show what was prescribed last time OR the session notes.
                
                // If the user noted specific weights in the session notes, we might find them there
                // But generally, the requirement implies showing the previous *prescription* or *logged weight*.
                // Since we don't have per-exercise weight logging yet, we will return the DATE and the PRESCRIPTION.
                
                const dateStr = data.finishedAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                return `${dateStr}: ${found.details}`;
            }
        }
        
        return null;
    } catch (error) {
        console.error("Error finding last exercise:", error);
        return null;
    }
}
