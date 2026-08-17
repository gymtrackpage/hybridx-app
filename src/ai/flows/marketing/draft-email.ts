'use server';

// src/ai/flows/marketing/draft-email.ts
//
// One email brief becomes structured content.
//
// The output is a typed block array, never HTML. The model chooses structure
// and words; src/lib/marketing/render.ts owns every visual decision. See
// src/lib/marketing/blocks.ts for why.
//
// Output is fact-checked against the same knowledge snapshot that produced it
// before it is returned, so a draft citing a wrong price never reaches the
// review screen looking finished.

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { HYBRIDX_BRAND_CONTEXT } from '@/ai/brand-context';
import { emailContentSchema, blocksToText, MERGE_TOKEN_HINT } from '@/lib/marketing/blocks';
import { getPromptKnowledge } from '@/lib/marketing/knowledge';
import { validateDraft, type ValidationIssue } from '@/lib/marketing/validate';
import { renderBlocks, renderBlocksAsText } from '@/lib/marketing/render';

const draftEmailInputSchema = z.object({
  brief: z.string().describe('What this email must achieve.'),
  journeyGoal: z.string().optional().describe('The wider goal of the sequence.'),
  audienceDescription: z.string().optional(),
  /** Subjects of the other emails in the sequence, so this one does not repeat them. */
  siblingSubjects: z.array(z.string()).optional(),
  position: z.string().optional().describe('e.g. "email 2 of 3, sent 3 days in".'),
});

export type DraftEmailInput = z.infer<typeof draftEmailInputSchema>;

export interface DraftEmailResult {
  subject: string;
  previewText: string;
  blocks: z.infer<typeof emailContentSchema>['blocks'];
  html: string;
  text: string;
  /** Fact-check findings. Errors mean the draft should not be sent as-is. */
  issues: ValidationIssue[];
  valid: boolean;
}

const draftEmailFlow = ai.defineFlow(
  {
    name: 'draftEmailFlow',
    inputSchema: draftEmailInputSchema,
    outputSchema: emailContentSchema,
  },
  async (input) => {
    const { block } = await getPromptKnowledge();

    const siblings = input.siblingSubjects?.length
      ? `\n## Other emails in this sequence\nDo not repeat these angles or subject lines:\n${input.siblingSubjects.map((s) => `- ${s}`).join('\n')}`
      : '';

    const { output } = await ai.generate({
      model: 'googleai/gemini-3-pro-preview',
      output: { schema: emailContentSchema },
      prompt: `You are a direct-response copywriter for HYBRIDX.

${HYBRIDX_BRAND_CONTEXT}

${block}

## Output format
You produce structured blocks, not HTML. Available block types:
- hero: opening headline with optional subheading
- heading: section heading
- paragraph: one paragraph of body copy
- bulletList: two to eight short points
- cta: a button — label and absolute https URL
- image: absolute https URL plus required alt text
- divider: a horizontal rule
- programCard: highlights one training programme by exact name
- statRow: two or three figures with labels
- quote: a testimonial

${MERGE_TOKEN_HINT}

## Rules
- Open with a hero block. Include exactly one primary cta.
- Six to ten blocks. Athletes do not read long email.
- Subject under 60 characters so inboxes do not truncate it.
- Preview text complements the subject; it must not repeat it.
- Link to https://app.hybridx.club/... for anything in the app.
- Only name a programme that appears verbatim in the facts above.
- Never state a price, trial length or statistic that is not in the facts.
- Write HYROX in capitals and the brand as HYBRIDX.
- No exclamation marks in the subject line, and no fake "Re:" prefix.

${input.journeyGoal ? `## Sequence goal\n${input.journeyGoal}\n` : ''}${input.audienceDescription ? `## Audience\n${input.audienceDescription}\n` : ''}${input.position ? `## Position\n${input.position}\n` : ''}${siblings}

## This email's brief
${input.brief}`,
    });

    if (!output) throw new Error('The drafting flow returned no output.');
    return output;
  },
);

/**
 * Draft an email and fact-check it.
 *
 * Validation runs here rather than in the UI so every caller gets it — the
 * studio, a regenerate action, and any future batch drafting all inherit the
 * same gate.
 */
export async function draftEmail(input: DraftEmailInput): Promise<DraftEmailResult> {
  const content = await draftEmailFlow(input);
  const { snapshot } = await getPromptKnowledge();

  const { ok, issues } = validateDraft(
    { subject: content.subject, body: blocksToText(content.blocks) },
    snapshot,
  );

  return {
    subject: content.subject,
    previewText: content.previewText,
    blocks: content.blocks,
    html: renderBlocks(content.blocks, { previewText: content.previewText }),
    text: renderBlocksAsText(content.blocks),
    issues,
    valid: ok,
  };
}
