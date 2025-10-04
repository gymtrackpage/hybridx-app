// src/ai/flows/notification-message.ts
'use server';
/**
 * @fileOverview AI-driven notification message generator for daily workouts.
 *
 * - notificationMessage - A function that generates a short, engaging notification message for a workout.
 * - NotificationMessageInput - The input type for the notificationMessage function.
 * - NotificationMessageOutput - The return type for the notificationMessage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const NotificationMessageInputSchema = z.object({
  userName: z.string().describe("The user's first name."),
  workoutTitle: z.string().describe('The title of the workout.'),
  exercises: z.string().describe('A brief description of key exercises or workout focus.'),
});
export type NotificationMessageInput = z.infer<typeof NotificationMessageInputSchema>;

const NotificationMessageOutputSchema = z.object({
  message: z.string().describe("A short, punchy notification message (max 100 characters) that motivates the user about today's workout."),
});
export type NotificationMessageOutput = z.infer<typeof NotificationMessageOutputSchema>;

export async function notificationMessage(input: NotificationMessageInput): Promise<NotificationMessageOutput> {
  return notificationMessageFlow(input);
}

const prompt = ai.definePrompt({
  name: 'notificationMessagePrompt',
  input: {schema: NotificationMessageInputSchema},
  output: {schema: NotificationMessageOutputSchema},
  prompt: `You are an AI coach creating a daily workout notification for {{{userName}}}.

  Today's workout: "{{{workoutTitle}}}"
  Key exercises: {{{exercises}}}

  Create a SHORT, punchy, and motivating notification message (max 100 characters).
  Make it exciting and varied - use different styles:
  - Sometimes focus on the workout type
  - Sometimes mention a key exercise
  - Sometimes give a quick tip
  - Sometimes be playful or challenging

  Examples:
  - "Time to crush those burpees! 💪 Your HYROX training awaits."
  - "Leg day loading... Get ready to dominate!"
  - "Quick tempo run today - let's build that speed!"
  - "Power + endurance combo incoming. You've got this!"

  Keep it under 100 characters and energizing!`,
});

const notificationMessageFlow = ai.defineFlow(
  {
    name: 'notificationMessageFlow',
    inputSchema: NotificationMessageInputSchema,
    outputSchema: NotificationMessageOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
