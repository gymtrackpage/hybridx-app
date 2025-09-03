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
  question: z.string().describe("The user's question about their training."),
  userData: z.string().describe("A JSON string containing the user's profile, program, and session data."),
});
export type TrainingAssistantInput = z.infer<typeof TrainingAssistantInputSchema>;

const TrainingAssistantOutputSchema = z.object({
  answer: z.string().describe("The AI's answer to the user's question."),
});
export type TrainingAssistantOutput = z.infer<typeof TrainingAssistantOutputSchema>;

export async function trainingAssistant(input: TrainingAssistantInput): Promise<TrainingAssistantOutput> {
  return trainingAssistantFlow(input);
}

const trainingAssistantFlow = ai.defineFlow(
  {
    name: 'trainingAssistantFlow',
    inputSchema: TrainingAssistantInputSchema,
    outputSchema: TrainingAssistantOutputSchema,
  },
  async (input) => {
    // The user data is now fetched on the client and passed directly into the flow.
    // The flow can now be much simpler and doesn't need tools.
    const llmResponse = await ai.generate({
      prompt: `You are an expert HYROX coach. You are answering a question from a user. You have been provided with their data as a JSON string.
    
        Question: ${input.question}
        
        User Data: ${input.userData}

        Provide a helpful and encouraging answer based on this data. If the user provided notes in their session history, incorporate them into your response. If there is no data, politely inform the user that you need their data to provide personalized advice.`,
      output: { schema: TrainingAssistantOutputSchema }
    });
    
    return llmResponse.output!;
  }
);
