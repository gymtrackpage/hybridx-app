// src/lib/type-guards.ts
import type { Workout, RunningWorkout, Program, RunningProgram } from "@/models/types";

/**
 * Type guard to check if a workout is a RunningWorkout.
 */
export function isRunningWorkout(workout: Workout | RunningWorkout | null | undefined): workout is RunningWorkout {
    return !!workout && workout.programType === 'running';
}

/**
 * Type guard to check if a workout is a standard Hyrox Workout.
 */
export function isHyroxWorkout(workout: Workout | RunningWorkout | null | undefined): workout is Workout {
    return !!workout && workout.programType === 'hyrox';
}

/**
 * Type guard to check if a program is a RunningProgram.
 */
export function isRunningProgram(program: Program | RunningProgram | null | undefined): program is RunningProgram {
    return !!program && program.programType === 'running';
}
