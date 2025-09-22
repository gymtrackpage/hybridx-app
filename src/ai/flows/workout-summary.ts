
// src/ai/flows/workout-summary.ts
'use server';
/**
 * @fileOverview AI-driven summary for the day's workout.
 *
 * - workoutSummary - A function that generates a short summary and tips for a specific workout.
 * - WorkoutSummaryInput - The input type for the workoutSummary function.
 * - WorkoutSummaryOutput - The return type for the workoutSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const WorkoutSummaryInputSchema = z.object({
  userName: z.string().describe("The user's first name."),
  workoutTitle: z.string().describe('The title of the workout.'),
  exercises: z.string().describe('A comma-separated list of exercises for the workout.'),
});
export type WorkoutSummaryInput = z.infer<typeof WorkoutSummaryInputSchema>;

const WorkoutSummaryOutputSchema = z.object({
  summary: z.string().describe("A single, encouraging sentence summarizing the workout's focus with a useful tip."),
});
export type WorkoutSummaryOutput = z.infer<typeof WorkoutSummaryOutputSchema>;

export async function workoutSummary(input: WorkoutSummaryInput): Promise<WorkoutSummaryOutput> {
  return workoutSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'workoutSummaryPrompt',
  input: {schema: WorkoutSummaryInputSchema},
  output: {schema: WorkoutSummaryOutputSchema},
  prompt: `You are an AI coach for an athlete named {{{userName}}}.

  Today's workout is "{{{workoutTitle}}}" and includes these exercises: {{{exercises}}}.

  Based on this, create a single, encouraging sentence that summarizes the focus of the workout and provides a short, actionable tip.

  Example: "Today's focus is on building full-body strength; remember to brace your core on the heavy lifts for stability and power."`,
});

const workoutSummaryFlow = ai.defineFlow(
  {
    name: 'workoutSummaryFlow',
    inputSchema: WorkoutSummaryInputSchema,
    outputSchema: WorkoutSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
