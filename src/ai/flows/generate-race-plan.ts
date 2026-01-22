
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ExerciseSchema } from '@/ai/schemas';

// Reusing schemas where possible, but simplifying for the specific task
// We need a schema that represents the plan structure we send TO the AI
// and the plan structure we receive FROM the AI.

const PlannedRunSchema = z.object({
  type: z.string(),
  distance: z.number(),
  paceZone: z.string().optional(),
  description: z.string(),
});

const WorkoutSchema = z.object({
  day: z.number(),
  title: z.string(),
  programType: z.string(), // 'hyrox' | 'running'
  exercises: z.array(ExerciseSchema).optional(),
  runs: z.array(PlannedRunSchema).optional(),
});

const GenerateRacePlanInputSchema = z.object({
  eventName: z.string(),
  eventDate: z.string(),
  eventDetails: z.string().describe("User's specific goals, injuries, or event requirements."),
  currentPlan: z.array(WorkoutSchema).describe("The mathematically generated baseline plan."),
});

const GenerateRacePlanOutputSchema = z.object({
  planName: z.string(),
  description: z.string().describe("A brief explanation of how the plan was customized for the user."),
  workouts: z.array(WorkoutSchema).describe("The fully customized workout schedule."),
});

export type GenerateRacePlanInput = z.infer<typeof GenerateRacePlanInputSchema>;
export type GenerateRacePlanOutput = z.infer<typeof GenerateRacePlanOutputSchema>;

export async function generateRacePlanFlow(input: GenerateRacePlanInput): Promise<GenerateRacePlanOutput> {
  return flow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRacePlanPrompt',
  input: { schema: GenerateRacePlanInputSchema },
  output: { schema: GenerateRacePlanOutputSchema },
  prompt: `
  You are an elite endurance and hybrid athlete coach (World Class Level).
  You have been given a baseline training schedule for an athlete preparing for: "{{eventName}}" on {{eventDate}}.

  **Athlete's Specific Request / Context:**
  "{{{eventDetails}}}"

  **Your Task:**
  1. Review the "Baseline Plan" provided below. It follows a standard periodization (Base -> Build -> Peak -> Taper).
  2. **Customize** the content of the workouts to specifically address the athlete's request.
     - IF they asked for "more strength", replace or enhance 1-2 sessions per week with specific strength work.
     - IF they mentioned specific movements (e.g., "heavy cleans"), ensure these appear progressively in the "Build" and "Peak" phases.
     - IF they have an injury (e.g., "bad knees"), swap high-impact exercises (box jumps) for low-impact ones (step-ups).
     - IF they want a specific time goal, adjust the intensity descriptions of the interval sessions.
  
  **Rules for Modification:**
  - **Preserve the Structure:** Do NOT change the number of workouts per week or the general "Hard/Easy" flow unless necessary. The volume progression is already calculated.
  - **Be Specific:** Don't just say "Strength Workout". List 3-5 specific exercises with sets/reps.
  - **Progressive Overload:** If you add a specific movement (e.g. Cleans), make it get harder/heavier over the weeks.

  **Baseline Plan (JSON):**
  {{json currentPlan}}

  Return the FULL plan (all workouts), but with your expert modifications applied.
  `,
});

const flow = ai.defineFlow(
  {
    name: 'generateRacePlanFlow',
    inputSchema: GenerateRacePlanInputSchema,
    outputSchema: GenerateRacePlanOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    return output!;
  }
);
