'use server';
/**
 * @fileOverview AI coaching insight for athlete journal entries.
 *
 * - journalInsight - Analyses a journal entry and returns personalised coaching commentary.
 * - JournalInsightInput  - Input type
 * - JournalInsightOutput - Return type
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const JournalInsightInputSchema = z.object({
  journalContent: z.string().describe("The athlete's journal entry text."),
  mood: z.string().optional().describe("The athlete's self-reported mood (great/good/okay/tired/struggling)."),
  tags: z.array(z.string()).optional().describe("Category tags the athlete attached to this entry (e.g. form, mental, achievement)."),
  entryDate: z.string().describe("The date of the journal entry in ISO format (YYYY-MM-DD)."),
  userData: z.string().describe("A JSON string containing the athlete's profile, recent workout sessions, and any Strava training summary."),
});
export type JournalInsightInput = z.infer<typeof JournalInsightInputSchema>;

const JournalInsightOutputSchema = z.object({
  insight: z.string().describe("AI coaching commentary on the journal entry (2-4 paragraphs)."),
});
export type JournalInsightOutput = z.infer<typeof JournalInsightOutputSchema>;

export async function journalInsight(input: JournalInsightInput): Promise<JournalInsightOutput> {
  return journalInsightFlow(input);
}

const journalInsightFlow = ai.defineFlow(
  {
    name: 'journalInsightFlow',
    inputSchema: JournalInsightInputSchema,
    outputSchema: JournalInsightOutputSchema,
  },
  async (input) => {
    const moodContext = input.mood ? `The athlete's self-reported mood today: ${input.mood}.` : '';
    const tagsContext =
      input.tags && input.tags.length > 0
        ? `The athlete tagged this entry with: ${input.tags.join(', ')}.`
        : '';

    const llmResponse = await ai.generate({
      prompt: `You are an expert hybrid performance and HYROX coach reading your athlete's training journal. Your job is to respond to what they've written with honest, direct, and practical coaching commentary.

Date of entry: ${input.entryDate}
${moodContext}
${tagsContext}

Journal entry:
"""
${input.journalContent}
"""

Athlete data (profile, recent sessions, Strava training summary if available):
${input.userData}

Guidelines for your response:
- Reference specific things the athlete wrote — do not give generic advice
- Acknowledge their emotional state honestly; don't dismiss it or over-inflate it
- Be direct and practical, like a coach who respects their athlete, not a cheerleader
- If their training data shows something relevant (e.g. they mention fatigue and recent load is genuinely high, or they feel great and their metrics back that up), call it out specifically
- Celebrate achievements concretely — name what they did well and why it matters
- End with exactly one actionable suggestion for the coming days based on everything you've read
- Write 2–4 paragraphs; no bullet points, no headers — this is a personal coaching response`,
      output: { schema: JournalInsightOutputSchema },
    });

    return llmResponse.output!;
  }
);
