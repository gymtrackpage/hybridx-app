// src/lib/workout-utils.ts
import type { Program, Workout, RunningWorkout } from '@/models/types';
import { differenceInDays } from 'date-fns';

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
