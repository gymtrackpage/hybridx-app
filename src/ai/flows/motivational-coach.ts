// src/ai/flows/motivational-coach.ts
'use server';
/**
 * @fileOverview AI-driven motivational coach that provides personalized encouragement messages based on user workout history.
 *
 * - motivationalCoach - A function that generates personalized motivational messages.
 * - MotivationalCoachInput - The input type for the motivationalCoach function.
 * - MotivationalCoachOutput - The return type for the motivationalCoach function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const MotivationalCoachInputSchema = z.object({
  workoutHistory: z
    .string()
    .describe(
      'A summary of the user workout history, including workout types, frequency, and progress.'
    ),
  userName: z.string().describe('The first name of the user.'),
});
export type MotivationalCoachInput = z.infer<typeof MotivationalCoachInputSchema>;

const MotivationalCoachOutputSchema = z.object({
  message: z.string().describe('A personalized motivational message for the user.'),
});
export type MotivationalCoachOutput = z.infer<typeof MotivationalCoachOutputSchema>;

export async function motivationalCoach(input: MotivationalCoachInput): Promise<MotivationalCoachOutput> {
  return motivationalCoachFlow(input);
}

const prompt = ai.definePrompt({
  name: 'motivationalCoachPrompt',
  input: {schema: MotivationalCoachInputSchema},
  output: {schema: MotivationalCoachOutputSchema},
  prompt: `You are a personal AI coach, giving encouragement to the user based on their workout history.

  Workout history: {{{workoutHistory}}}

  Give the user a personalized, encouraging message to stay motivated and consistent with their training. Address the user by their first name: {{{userName}}}.`,
});

const motivationalCoachFlow = ai.defineFlow(
  {
    name: 'motivationalCoachFlow',
    inputSchema: MotivationalCoachInputSchema,
    outputSchema: MotivationalCoachOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
