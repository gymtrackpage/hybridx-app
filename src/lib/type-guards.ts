// src/lib/type-guards.ts
import type { WorkoutDay, Program } from "@/models/types";

/**
 * Returns true when a workout day contains at least one run segment.
 * Use this instead of checking `workout.programType === 'running'`.
 */
export function hasRuns(workout: WorkoutDay | null | undefined): boolean {
    return !!workout && Array.isArray(workout.runs) && workout.runs.length > 0;
}

/**
 * Returns true when a workout day contains at least one strength/gym exercise.
 * Use this instead of checking `workout.programType === 'hyrox'`.
 */
export function hasExercises(workout: WorkoutDay | null | undefined): boolean {
    return !!workout && Array.isArray(workout.exercises) && workout.exercises.length > 0;
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
