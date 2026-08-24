'use server';

// src/ai/flows/marketing/propose-campaigns.ts
//
// Looks at the week and proposes what to send next.
//
// This is the initiative half of "semi-automated": rather than waiting to be
// asked, the system reads its own performance and the shape of the audience and
// suggests campaigns worth running. What it produces are *briefs* — the same
// kind of prompt a person would type into the studio — not finished email, and
// certainly not sends.

import { z } from 'genkit';
import { ai, MODELS } from '@/ai/genkit';
import { HYBRIDX_BRAND_CONTEXT } from '@/ai/brand-context';
import { getPromptKnowledge } from '@/lib/marketing/knowledge';
import type { WeeklyBrief } from '@/lib/marketing/brief';

const proposalSchema = z.object({
  title: z.string().describe('Short internal name, e.g. "Trial-ending nudge for non-starters".'),
  rationale: z.string().describe('Why this is worth sending now, citing the figures above.'),
  /** The prompt the composer flow will work from — the same shape a person would type. */
  prompt: z.string().describe('A complete studio prompt: goal, audience, number of emails, angle.'),
  expectedAudience: z.string().describe('Who this reaches, in plain words.'),
  priority: z.enum(['high', 'medium', 'low']),
});

export type CampaignProposal = z.infer<typeof proposalSchema>;

const proposeCampaignsOutputSchema = z.object({
  summary: z.string().describe('Two sentences on the state of marketing this week.'),
  proposals: z.array(proposalSchema).min(1).max(3),
});

export type ProposeCampaignsOutput = z.infer<typeof proposeCampaignsOutputSchema>;

const proposeCampaignsFlow = ai.defineFlow(
  {
    name: 'proposeCampaignsFlow',
    inputSchema: z.object({ briefJson: z.string() }),
    outputSchema: proposeCampaignsOutputSchema,
  },
  async ({ briefJson }) => {
    const { block } = await getPromptKnowledge();

    const { output } = await ai.generate({
      model: MODELS.reasoning,
      output: { schema: proposeCampaignsOutputSchema },
      prompt: `You are the marketing strategist for HYBRIDX, reviewing the week.

${HYBRIDX_BRAND_CONTEXT}

${block}

## This week's performance
${briefJson}

## Your task
Propose one to three campaigns or journeys worth running next, and write each as
a studio prompt that another system will turn into a real sequence.

Rules:
- Ground every proposal in the figures above. "Open rate fell six points on last
  week" is a reason; "engagement could be improved" is not.
- Propose fewer, better things. One well-aimed campaign beats three generic
  ones, and every email spends goodwill from a shared weekly frequency cap.
- Only target audiences that exist in the segment list. If a segment you want is
  not there, say so in the rationale rather than inventing a tag.
- If the list is shrinking or complaints are up, at least one proposal should
  address that rather than adding more volume.
- If nothing meaningful has changed and the current journeys are covering the
  lifecycle, it is legitimate to propose a single low-priority idea and say so.
- Each prompt must state: the goal, the audience, roughly how many emails over
  what period, and the angle to lead with.
- Never state a price, trial length, programme name or statistic that is not in
  the facts above.`,
    });

    if (!output) throw new Error('The proposal flow returned no output.');
    return output;
  },
);

export async function proposeCampaigns(brief: WeeklyBrief): Promise<ProposeCampaignsOutput> {
  // The brief is passed as JSON rather than prose so the model sees exact
  // figures instead of a summary that has already rounded them.
  return proposeCampaignsFlow({ briefJson: JSON.stringify(brief, null, 2) });
}
