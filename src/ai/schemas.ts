// src/ai/schemas.ts
/**
 * @fileOverview Shared Zod schemas for AI flows to prevent circular dependencies.
 */
import { z } from 'genkit';

export const ExerciseSchema = z.object({
    name: z.string().describe('The name of the exercise.'),
    details: z.string().describe('The sets, reps, or duration for the exercise (e.g., 3x10 reps, 5 min AMRAP).'),
});

export const PlannedRunSchema = z.object({
    type: z.enum(['easy', 'tempo', 'intervals', 'long', 'recovery']).describe('The type of run.'),
    distance: z.number().describe('Distance in kilometres.'),
    paceZone: z.enum(['recovery', 'easy', 'marathon', 'threshold', 'interval', 'repetition']).describe('The target pace zone.'),
    description: z.string().describe('Detailed description of the run segment.'),
    effortLevel: z.number().min(1).max(10).describe('Perceived effort on a 1–10 scale.'),
    targetPace: z.number().optional().describe('Target pace in seconds per kilometre, if calculated.'),
    noIntervals: z.number().optional().describe('Number of intervals, if applicable.'),
});

/**
 * Unified workout day schema — both exercises and runs are optional arrays.
 * A session can contain exercises only (strength day), runs only (pure run day),
 * or both (hybrid / compromised-running session).
 */
export const WorkoutDaySchema = z.object({
    day: z.number().describe('The day number within the program cycle.'),
    title: z.string().describe('The title of the workout session.'),
    exercises: z.array(ExerciseSchema).default([]).describe('Strength or gym exercises for this session. Empty array when none.'),
    runs: z.array(PlannedRunSchema).default([]).describe('Run segments for this session. Empty array when none.'),
});
