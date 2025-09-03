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
import { getUser } from '@/services/user-service';
import { getProgram, getWorkoutForDay } from '@/services/program-service';
import { getOrCreateWorkoutSession } from '@/services/session-service';
import type { User, WorkoutSession } from '@/models/types';

const getUserWorkoutDataTool = ai.defineTool(
    {
        name: 'getUserWorkoutData',
        description: 'Get the user\'s current workout data, including their profile, assigned program, and today\'s workout session with notes.',
        inputSchema: z.object({ userId: z.string().describe('The ID of the user.') }),
        outputSchema: z.object({
            user: z.custom<User>(),
            program: z.any().optional(),
            todaysWorkout: z.any().optional(),
            todaysSession: z.custom<WorkoutSession>().optional(),
        }),
    },
    async ({ userId }) => {
        const user = await getUser(userId);
        if (!user) {
            throw new Error('User not found');
        }
        if (user.programId && user.startDate) {
            const program = await getProgram(user.programId);
            if(program) {
                const today = new Date();
                today.setHours(0,0,0,0);
                const { workout } = getWorkoutForDay(program, user.startDate, today);
                if (workout) {
                    const session = await getOrCreateWorkoutSession(userId, program.id, today, workout);
                    return { user, program, todaysWorkout: workout, todaysSession: session };
                }
                return { user, program, todaysWorkout: workout };
            }
        }
        return { user };
    }
);


const TrainingAssistantInputSchema = z.object({
  userId: z.string().describe('The user ID to fetch data for.'),
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

const trainingAssistantFlow = ai.defineFlow(
  {
    name: 'trainingAssistantFlow',
    inputSchema: TrainingAssistantInputSchema,
    outputSchema: TrainingAssistantOutputSchema,
  },
  async (input) => {
    // Initial generation request with the tool
    const llmResponse = await ai.generate({
        prompt: `You are a virtual AI training assistant. Use the available tools to get the user's workout data to answer their question and offer advice. Pay special attention to any notes the user may have left on their workout session.

        Question: ${input.question}`,
        tools: [getUserWorkoutDataTool],
        toolConfig: {
          usage: 'force',
          options: {
              getUserWorkoutData: {
                  userId: input.userId
              }
          }
      }
    });

    // Check if the model decided to use the tool
    if (llmResponse.toolRequest) {
        // Execute the tool and get the result
        const toolResponse = await llmResponse.toolRequest.execute();

        // Send the tool's output back to the model to get a final answer
        const finalResponse = await ai.generate({
            prompt: `You are an expert HYROX coach. You are answering a question from a user. Here is their question and their data that you requested.
        
            Question: ${input.question}
            
            User Data (from your tool call): ${JSON.stringify(toolResponse.output)}
    
            Provide a helpful and encouraging answer based on this data. If the user provided notes, incorporate them into your response.`,
            output: { schema: TrainingAssistantOutputSchema }
        });
        
        return finalResponse.output!;

    } else {
        // If the model didn't use the tool, it might have answered directly.
        // We will return that answer, formatted correctly.
        return { answer: llmResponse.text };
    }
  }
);
