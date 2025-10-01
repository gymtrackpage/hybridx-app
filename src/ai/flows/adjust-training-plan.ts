// src/ai/flows/adjust-training-plan.ts
'use server';
/**
 * @fileOverview AI-driven training plan adjuster.
 *
 * - adjustTrainingPlan - A function that condenses a standard 5-day training plan to a 3 or 4-day plan.
 * - AdjustTrainingPlanInput - The input type for the adjustTrainingPlan function.
 * - AdjustTrainingPlanOutput - The return type for the adjustTrainingPlan function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { ExerciseSchema } from '@/ai/schemas';

const WorkoutSchema = z.object({
  day: z.number(),
  title: z.string(),
  programType: z.enum(['hyrox', 'running']),
  exercises: z.array(ExerciseSchema),
});

const AdjustTrainingPlanInputSchema = z.object({
  currentWorkouts: z.array(WorkoutSchema).describe('The original array of workout objects for a 5-day week.'),
  targetDays: z.enum(['3', '4']).describe('The target number of training days per week.'),
});
export type AdjustTrainingPlanInput = z.infer<typeof AdjustTrainingPlanInputSchema>;

const AdjustTrainingPlanOutputSchema = z.object({
  adjustedWorkouts: z.array(WorkoutSchema).describe('The new, condensed array of workout objects for the target number of days.'),
});
export type AdjustTrainingPlanOutput = z.infer<typeof AdjustTrainingPlanOutputSchema>;

export async function adjustTrainingPlan(input: AdjustTrainingPlanInput): Promise<AdjustTrainingPlanOutput> {
  return adjustTrainingPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adjustTrainingPlanPrompt',
  input: {schema: AdjustTrainingPlanInputSchema},
  output: {schema: AdjustTrainingPlanOutputSchema},
  prompt: `You are an expert strength and conditioning coach. Your task is to intelligently condense a 5-day training plan into a {{{targetDays}}}-day plan.

  **CRITICAL INSTRUCTIONS:**
  1.  **Analyze the 5-day Plan:** Review the original workouts to understand the weekly structure, intensity, and goals (e.g., strength days, conditioning days, recovery).
  2.  **Prioritize & Combine:**
      *   Identify the most critical workouts that must be kept.
      *   Combine complementary sessions. For example, merge a shorter strength session with a metcon, or combine accessory work into a main lift day.
      *   Lower priority workouts (e.g., secondary recovery sessions, light accessory work) can be dropped if necessary.
      *   Ensure the combined days are challenging but manageable, not excessively long or conflicting (e.g., don't pair a heavy leg day with intense running).
  3.  **Restructure the Week:**
      *   The final output MUST contain exactly {{{targetDays}}} workout objects.
      *   Re-assign the 'day' property for the new workouts to be sequential (e.g., Day 1, Day 2, Day 3). Distribute them logically through a 7-day week (e.g., Day 1, 3, 5 for a 3-day plan).
      *   The remaining days of the 7-day week should be rest days. Do NOT include rest day objects in the output array.
  4.  **Maintain Integrity:** The goal is to retain the original program's effectiveness, just in a more condensed format.

  **Original 5-Day Plan:**
  {{{JSON.stringify currentWorkouts}}}

  Generate the adjusted {{{targetDays}}}-day workout plan.`,
});

const adjustTrainingPlanFlow = ai.defineFlow(
  {
    name: 'adjustTrainingPlanFlow',
    inputSchema: AdjustTrainingPlanInputSchema,
    outputSchema: AdjustTrainingPlanOutputSchema,
  },
  async input => {
    // The prompt is powerful enough to handle this directly.
    // In a more complex scenario, you might add pre-processing logic here.
    const {output} = await prompt(input);
    return output!;
  }
);
