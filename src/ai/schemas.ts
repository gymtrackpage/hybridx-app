// src/ai/schemas.ts
/**
 * @fileOverview Shared Zod schemas for AI flows to prevent circular dependencies.
 */
import { z } from 'genkit';

export const ExerciseSchema = z.object({
    name: z.string().describe('The name of the exercise.'),
    details: z.string().describe('The sets, reps, or duration for the exercise (e.g., 3x10 reps, 5 min AMRAP).'),
});
