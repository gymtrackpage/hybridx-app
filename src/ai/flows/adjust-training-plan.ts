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

// Internal schema for the prompt, which expects a stringified version of the workouts
const AdjustTrainingPlanPromptInputSchema = z.object({
  workoutsJSON: z.string().describe('The JSON string of the original workout objects.'),
  targetDays: z.enum(['3', '4']),
});

const AdjustTrainingPlanOutputSchema = z.object({
  adjustedWorkouts: z.array(WorkoutSchema).describe('The new, condensed array of workout objects for the target number of days.'),
});
export type AdjustTrainingPlanOutput = z.infer<typeof AdjustTrainingPlanOutputSchema>;

export async function adjustTrainingPlan(input: AdjustTrainingPlanInput): Promise<AdjustTrainingPlanOutput> {
  return adjustTrainingPlanFlow(input);
}

const prompt = ai.definePrompt({
  name: 'adjustTrainingPlanPrompt',
  input: {schema: AdjustTrainingPlanPromptInputSchema},
  output: {schema: AdjustTrainingPlanOutputSchema},
  prompt: `You are an expert strength and conditioning coach. Your task is to intelligently condense a 5-day training plan into a {{{targetDays}}}-day plan.

  **CRITICAL INSTRUCTIONS:**
  1.  **Analyze the 5-day Plan:** Review the original workouts to understand the weekly structure, intensity, and goals (e.g., strength days, conditioning days, recovery).

  2.  **Prioritize & Combine:**
      *   Identify the most critical workouts that must be kept.
      *   Combine complementary sessions. For example, merge a shorter strength session with a metcon, or combine accessory work into a main lift day.
      *   Lower priority workouts (e.g., secondary recovery sessions, light accessory work) can be dropped if necessary.
      *   Ensure the combined days are challenging but manageable, not excessively long or conflicting (e.g., don't pair a heavy leg day with intense running).

  3.  **Smart Weekly Distribution:**
      *   The final output MUST contain exactly {{{targetDays}}} workout objects.
      *   Distribute workouts intelligently throughout the 7-day week with proper recovery placement.
      *   **DO NOT cluster all workouts at the end of the week** - spread them out!
      *   **Place rest days strategically** - especially after heavy strength sessions or high-intensity workouts.
      *   Follow these guidelines for day numbering:
          - For 3-day plans: Use Day 1, Day 3, Day 5 or Day 2, Day 4, Day 6 (alternating pattern with rest in between)
          - For 4-day plans: Use Day 1, Day 2, Day 4, Day 5 or Day 1, Day 3, Day 4, Day 6 (with rest after heavy sessions)
      *   Example good patterns:
          - 3-day: [Strength Day 1] → [Rest Day 2] → [Conditioning Day 3] → [Rest Day 4] → [Long Run Day 5] → [Rest Days 6-7]
          - 4-day: [Lower Body Day 1] → [Upper Body Day 2] → [Rest Day 3] → [Conditioning Day 4] → [Endurance Day 5] → [Rest Days 6-7]
      *   **Key principle:** Heavy lower body or full body strength sessions should typically have a rest day or light conditioning after them.

  4.  **Maintain Integrity:** The goal is to retain the original program's effectiveness, just in a more condensed format with intelligent recovery placement.

  **Original 5-Day Plan:**
  {{{workoutsJSON}}}

  Generate the adjusted {{{targetDays}}}-day workout plan with smart weekly distribution.`,
});

const adjustTrainingPlanFlow = ai.defineFlow(
  {
    name: 'adjustTrainingPlanFlow',
    inputSchema: AdjustTrainingPlanInputSchema,
    outputSchema: AdjustTrainingPlanOutputSchema,
  },
  async input => {
    // Stringify the workouts array before passing it to the prompt.
    const workoutsJSON = JSON.stringify(input.currentWorkouts);

    const {output} = await prompt({
      workoutsJSON,
      targetDays: input.targetDays,
    });
    
    return output!;
  }
);
