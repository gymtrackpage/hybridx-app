'use server';

// src/ai/flows/marketing/subject-variants.ts
//
// Alternative subject lines, ranked against this audience's own history.
//
// The knowledge snapshot carries the best- and worst-performing past subject
// lines with their open rates, so the suggestions are informed by what has
// actually worked on this list rather than by generic copywriting advice. That
// is the part a general-purpose tool cannot do — it needs both the copy and the
// outcome, and only this system has both.

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { HYBRIDX_BRAND_CONTEXT } from '@/ai/brand-context';
import { getPromptKnowledge } from '@/lib/marketing/knowledge';

const subjectVariantsInputSchema = z.object({
  currentSubject: z.string(),
  emailSummary: z.string().describe('What the email says, so subjects stay honest about it.'),
  audienceDescription: z.string().optional(),
});

export type SubjectVariantsInput = z.infer<typeof subjectVariantsInputSchema>;

const subjectVariantsOutputSchema = z.object({
  variants: z
    .array(
      z.object({
        subject: z.string(),
        previewText: z.string(),
        angle: z.string().describe('The tactic, e.g. "curiosity", "specific benefit", "urgency".'),
        rationale: z.string().describe('Why this should work with this audience, citing history where relevant.'),
      }),
    )
    .length(3),
});

export type SubjectVariantsOutput = z.infer<typeof subjectVariantsOutputSchema>;

const subjectVariantsFlow = ai.defineFlow(
  {
    name: 'subjectVariantsFlow',
    inputSchema: subjectVariantsInputSchema,
    outputSchema: subjectVariantsOutputSchema,
  },
  async (input) => {
    const { block } = await getPromptKnowledge();

    const { output } = await ai.generate({
      output: { schema: subjectVariantsOutputSchema },
      prompt: `You write subject lines for HYBRIDX.

${HYBRIDX_BRAND_CONTEXT}

${block}

## Task
Propose exactly three alternatives to the current subject line, each taking a
genuinely different angle — not three rewordings of the same idea.

Rules:
- Under 60 characters each.
- No exclamation marks, no ALL CAPS words other than HYROX and HYBRIDX, and
  never a fake "Re:" or "Fwd:" prefix — those read as deceptive and damage
  sender reputation.
- The subject must be honest about what the email actually contains. A subject
  that oversells earns an open and then a spam report.
- Study the historical performance above. If a pattern worked with this
  audience, use it and say so in the rationale; if a pattern performed badly,
  avoid it.
- Never state a price, trial length or statistic absent from the facts.

## Current subject
${input.currentSubject}

## What the email says
${input.emailSummary}
${input.audienceDescription ? `\n## Audience\n${input.audienceDescription}` : ''}`,
    });

    if (!output) throw new Error('The subject flow returned no output.');
    return output;
  },
);

export async function subjectVariants(input: SubjectVariantsInput): Promise<SubjectVariantsOutput> {
  return subjectVariantsFlow(input);
}
