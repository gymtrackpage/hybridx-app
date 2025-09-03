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

// This is a plain TypeScript function, not a formal Genkit tool,
// as we will call it directly from our flow logic.
const getUserWorkoutData = async (userId: string) => {
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
};


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
    // Step 1: Directly fetch the user's data using their ID.
    const userData = await getUserWorkoutData(input.userId);

    // Step 2: Pass the fetched data directly into the prompt context.
    const llmResponse = await ai.generate({
        prompt: `You are an expert HYROX coach. You are answering a question from a user. You have been provided with their data.
    
        Question: ${input.question}
        
        User Data: ${JSON.stringify(userData)}

        Provide a helpful and encouraging answer based on this data. If the user provided notes in their session, incorporate them into your response.`,
        output: { schema: TrainingAssistantOutputSchema }
    });
    
    return llmResponse.output!;
  }
);
