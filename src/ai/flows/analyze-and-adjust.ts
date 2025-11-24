// src/ai/flows/analyze-and-adjust.ts
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ExerciseSchema } from '@/ai/schemas';

// Reusing schema definitions where possible
const WorkoutSchema = z.object({
  day: z.number(),
  title: z.string(),
  programType: z.enum(['hyrox', 'running']),
  exercises: z.array(ExerciseSchema).optional(),
  runs: z.array(z.any()).optional(), // simplified for now, as we focus on strength adjustments mostly
});

const SessionHistorySchema = z.object({
    date: z.string(),
    workoutTitle: z.string(),
    notes: z.string().optional(),
    difficultyRating: z.number().optional(), // 1-10 implied from notes if not explicit
    skipped: z.boolean().optional(),
});

const AnalyzeAndAdjustInputSchema = z.object({
  userName: z.string(),
  userGoal: z.string(),
  recentHistory: z.array(SessionHistorySchema).describe("The last 3-5 workout sessions with user notes."),
  upcomingWorkouts: z.array(WorkoutSchema).describe("The scheduled workouts for the next 7 days."),
});

export type AnalyzeAndAdjustInput = z.infer<typeof AnalyzeAndAdjustInputSchema>;

const AdjustmentSchema = z.object({
    day: z.number().describe("The day number of the workout being modified."),
    originalTitle: z.string(),
    modifiedTitle: z.string(),
    reason: z.string().describe("Why this modification was made based on user feedback (e.g. 'Reduced volume due to reported fatigue')."),
    modifiedWorkout: WorkoutSchema.describe("The full new workout object replacing the old one."),
});

const AnalyzeAndAdjustOutputSchema = z.object({
  analysis: z.string().describe("A summary of the user's recent performance and feedback."),
  needsAdjustment: z.boolean().describe("Whether any changes are recommended."),
  adjustments: z.array(AdjustmentSchema).optional().describe("List of specific modifications to the upcoming plan."),
});

export type AnalyzeAndAdjustOutput = z.infer<typeof AnalyzeAndAdjustOutputSchema>;

export async function analyzeAndAdjust(input: AnalyzeAndAdjustInput): Promise<AnalyzeAndAdjustOutput> {
  return analyzeAndAdjustFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeAndAdjustPrompt',
  input: { schema: AnalyzeAndAdjustInputSchema },
  output: { schema: AnalyzeAndAdjustOutputSchema },
  prompt: `You are an expert adaptive training coach. Your goal is to analyze an athlete's recent feedback and adjust their upcoming training week if necessary.
  
  **Athlete Profile:**
  - Name: {{{userName}}}
  - Goal: {{{userGoal}}}

  **Recent Training History (Last few sessions):**
  {{#each recentHistory}}
  - Date: {{date}} | Workout: {{workoutTitle}} | Skipped: {{skipped}}
    Notes: "{{notes}}"
  {{/each}}

  **Upcoming Scheduled Workouts (Next 7 days):**
  {{#each upcomingWorkouts}}
  - Day {{day}}: {{title}} ({{programType}})
  {{/each}}

  **Instructions:**
  1. **Analyze Feedback:** Look for keywords in the notes indicating:
     - **Pain/Injury:** "knee hurts", "back pain", "shoulder tweak".
     - **Fatigue/Burnout:** "exhausted", "no energy", "failed reps", "too hard".
     - **Ease:** "too easy", "bored", "could have done more".
     - **Life Stress:** "busy week", "no time", "stressed".

  2. **Determine Adjustments:**
     - **If Pain/Injury:** Modify upcoming workouts to avoid aggravating the area. E.g., if "knee pain", swap heavy squats for glute bridges or swimming/rowing.
     - **If Fatigue:** Reduce volume (sets/reps) or intensity for the next 2-3 days. Suggest a "Deload" version of the planned workout.
     - **If Too Easy:** Slightly increase complexity or volume for the next key session.
     - **If No Issues:** Do NOT make changes just for the sake of it.

  3. **Output:**
     - Provide a brief **analysis** of how they are doing.
     - Set **needsAdjustment** to true only if you are actually changing something.
     - Return an array of **adjustments** where each item contains the full modified workout object.

  **Important:** Only modify workouts if the user's history strongly suggests it. If they are doing great, encourage them and keep the plan.
  `,
});

const analyzeAndAdjustFlow = ai.defineFlow(
  {
    name: 'analyzeAndAdjustFlow',
    inputSchema: AnalyzeAndAdjustInputSchema,
    outputSchema: AnalyzeAndAdjustOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
