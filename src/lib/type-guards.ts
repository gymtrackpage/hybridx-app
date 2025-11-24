// src/lib/type-guards.ts
import type { Workout, RunningWorkout, Program, RunningProgram } from "@/models/types";

/**
 * Type guard to check if a workout is a RunningWorkout.
 */
export function isRunningWorkout(workout: Workout | RunningWorkout): workout is RunningWorkout {
    return workout.programType === 'running';
}

/**
 * Type guard to check if a workout is a standard Hyrox Workout.
 */
export function isHyroxWorkout(workout: Workout | RunningWorkout): workout is Workout {
    return workout.programType === 'hyrox';
}

/**
 * Type guard to check if a program is a RunningProgram.
 */
export function isRunningProgram(program: Program | RunningProgram): program is RunningProgram {
    return program.programType === 'running';
}
