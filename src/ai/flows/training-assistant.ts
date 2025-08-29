'use server';
/**
 * @fileOverview AI-powered virtual coaching for training advice.
 *
 * - trainingAssistant - A function that answers user questions about their training and offers advice.
 * - TrainingAssistantInput - The input type for the trainingAssistant function.
 * - TrainingAssistantOutput - The return type for the trainingAssistant function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TrainingAssistantInputSchema = z.object({
  workoutData: z.string().describe('The user\'s workout history data.'),
  question: z.string().describe('The user\'s question about their training.'),
});
export type TrainingAssistantInput = z.infer<typeof TrainingAssistantInputSchema>;

const TrainingAssistantOutputSchema = z.object({
  answer: z.string().describe('The AI\'s answer to the user\'s question.'),
});
export type TrainingAssistantOutput = z.infer<typeof TrainingAssistantOutputSchema>;

export async function trainingAssistant(input: TrainingAssistantInput): Promise<TrainingAssistantOutput> {
  return trainingAssistantFlow(input);
}

const prompt = ai.definePrompt({
  name: 'trainingAssistantPrompt',
  input: {schema: TrainingAssistantInputSchema},
  output: {schema: TrainingAssistantOutputSchema},
  prompt: `You are a virtual AI training assistant. Use the provided workout data to answer the user's question about their training and offer advice.

Workout Data: {{{workoutData}}}

Question: {{{question}}}`,
});

const trainingAssistantFlow = ai.defineFlow(
  {
    name: 'trainingAssistantFlow',
    inputSchema: TrainingAssistantInputSchema,
    outputSchema: TrainingAssistantOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
