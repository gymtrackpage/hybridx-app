
// src/ai/flows/dashboard-summary.ts
'use server';
/**
 * @fileOverview AI-driven summary for the user dashboard.
 *
 * - dashboardSummary - A function that generates a short, positive summary of the user's progress.
 * - DashboardSummaryInput - The input type for the dashboardSummary function.
 * - DashboardSummaryOutput - The return type for the dashboardSummary function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DashboardSummaryInputSchema = z.object({
  userName: z.string().describe('The first name of the user.'),
  programName: z.string().describe('The name of the user active training program.'),
  daysCompleted: z.number().describe('The total number of days the user has completed in their program.'),
  weeklyConsistency: z.string().describe('A brief summary of workouts completed in the last 4 weeks.'),
});
export type DashboardSummaryInput = z.infer<typeof DashboardSummaryInputSchema>;

const DashboardSummaryOutputSchema = z.object({
  summary: z.string().describe('A single, short, encouraging sentence combining a progress summary and a positive affirmation.'),
});
export type DashboardSummaryOutput = z.infer<typeof DashboardSummaryOutputSchema>;

export async function dashboardSummary(input: DashboardSummaryInput): Promise<DashboardSummaryOutput> {
  return dashboardSummaryFlow(input);
}

const prompt = ai.definePrompt({
  name: 'dashboardSummaryPrompt',
  input: {schema: DashboardSummaryInputSchema},
  output: {schema: DashboardSummaryOutputSchema},
  prompt: `You are an AI coach for an athlete named {{{userName}}}. 
  
  Based on the following progress data, create a single, encouraging sentence that summarizes their progress and gives them a positive affirmation for the day. Keep it concise and impactful.

  Data:
  - Program: {{{programName}}}
  - Total Days Completed: {{{daysCompleted}}}
  - Recent Consistency: {{{weeklyConsistency}}}
  
  Example: "Your consistency on the {{{programName}}} program is paying off, keep that momentum going today!"`,
});

const dashboardSummaryFlow = ai.defineFlow(
  {
    name: 'dashboardSummaryFlow',
    inputSchema: DashboardSummaryInputSchema,
    outputSchema: DashboardSummaryOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
