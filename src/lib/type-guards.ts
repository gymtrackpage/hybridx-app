// src/lib/type-guards.ts
import type { Workout, RunningWorkout, WorkoutDay, Program } from "@/models/types";

/**
 * Type predicate: narrows WorkoutDay to RunningWorkout when runs exist.
 * Use this instead of checking `workout.programType === 'running'`.
 */
export function hasRuns(workout: WorkoutDay | null | undefined): workout is RunningWorkout {
    if (!workout) return false;
    const w = workout as RunningWorkout;
    return Array.isArray(w.runs) && w.runs.length > 0;
}

/**
 * Type predicate: narrows WorkoutDay to Workout when exercises exist.
 * Use this instead of checking `workout.programType === 'hyrox'`.
 */
export function hasExercises(workout: WorkoutDay | null | undefined): workout is Workout {
    if (!workout) return false;
    const w = workout as Workout;
    return Array.isArray(w.exercises) && w.exercises.length > 0;
}

/**
 * Returns true when a workout day contains both runs and exercises (a true hybrid session).
 */
export function isHybridDay(workout: WorkoutDay | null | undefined): boolean {
    return hasRuns(workout) && hasExercises(workout);
}

/**
 * Returns true when a program is primarily running-focused.
 * Running-focused programs can still have strength sessions — check individual
 * workouts with hasExercises / hasRuns for per-session content.
 */
export function isRunningProgram(program: Program | null | undefined): boolean {
    return !!program && program.programType === 'running';
}

/**
 * Returns true when a program is a HYROX / strength-focused program.
 */
export function isHyroxProgram(program: Program | null | undefined): boolean {
    return !!program && program.programType === 'hyrox';
}

/**
 * Returns true when a program is explicitly hybrid (mixed running + strength).
 */
export function isHybridProgram(program: Program | null | undefined): boolean {
    return !!program && program.programType === 'hybrid';
}

// ─── Legacy aliases ───────────────────────────────────────────────────────────
// Kept so any remaining call sites continue to compile while being migrated.
// These will be removed once all usages are updated.

/** @deprecated Use hasRuns(workout) instead */
export function isRunningWorkout(workout: WorkoutDay | null | undefined): boolean {
    return hasRuns(workout);
}

/** @deprecated Use hasExercises(workout) instead */
export function isHyroxWorkout(workout: WorkoutDay | null | undefined): boolean {
    return hasExercises(workout);
}
