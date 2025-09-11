// src/ai/flows/extend-workout.ts
'use server';
/**
 * @fileOverview AI-driven workout extension generator.
 *
 * - extendWorkout - A function that generates a short, logical extension for an existing workout.
 * - ExtendWorkoutInput - The input type for the extendWorkout function.
 * - ExtendWorkoutOutput - The return type for the extendWorkout function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExerciseSchema = z.object({
    name: z.string().describe('The name of the exercise.'),
    details: z.string().describe('The sets, reps, or duration for the exercise (e.g., 3x10 reps, 5 min AMRAP).'),
});

const ExtendWorkoutInputSchema = z.object({
  workoutTitle: z.string().describe('The title of the workout.'),
  workoutType: z.enum(['hyrox', 'running']).describe('The type of workout (e.g., strength, metcon, running).'),
  exercises: z.string().describe('A JSON string of the exercises already in the workout.'),
});
export type ExtendWorkoutInput = z.infer<typeof ExtendWorkoutInputSchema>;

const ExtendWorkoutOutputSchema = z.object({
  newExercises: z.array(ExerciseSchema).describe('An array of 2-3 new, complementary exercises to extend the workout.'),
});
export type ExtendWorkoutOutput = z.infer<typeof ExtendWorkoutOutputSchema>;

export async function extendWorkout(input: ExtendWorkoutInput): Promise<ExtendWorkoutOutput> {
  return extendWorkoutFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extendWorkoutPrompt',
  input: {schema: ExtendWorkoutInputSchema},
  output: {schema: ExtendWorkoutOutputSchema},
  prompt: `You are an expert strength and conditioning coach who designs intelligent workout extensions for athletes.
  
  The user has just completed the main part of their workout and wants to add a bit more volume. Your task is to generate a short, complementary block of 2-3 exercises to extend their session.

  Analyze the original workout and create a logical extension. For example:
  - If it was a heavy strength day (e.g., squats, deadlifts), add some accessory work for smaller muscle groups (e.g., core work, glute bridges) or a short, low-impact metcon finisher.
  - If it was a HYROX-style metcon, you could add a different, shorter metcon focusing on a different energy system, or some skill work (e.g., wall balls, farmer's carries).
  - If it was a running day, add some post-run core work or mobility exercises.
  - Do NOT simply add more of the same exercises. The goal is to complement, not just repeat.

  Original Workout Information:
  - Title: {{{workoutTitle}}}
  - Type: {{{workoutType}}}
  - Original Exercises: {{{exercises}}}

  Based on this, generate an array of 2-3 new exercises to add to the end of the session.`,
});

const extendWorkoutFlow = ai.defineFlow(
  {
    name: 'extendWorkoutFlow',
    inputSchema: ExtendWorkoutInputSchema,
    outputSchema: ExtendWorkoutOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
