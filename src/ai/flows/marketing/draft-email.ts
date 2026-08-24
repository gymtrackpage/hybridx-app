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
import { ai, MODELS } from '@/ai/genkit';
import { HYBRIDX_BRAND_CONTEXT } from '@/ai/brand-context';
import {
  aiEmailContentSchema,
  toEmailBlocks,
  emailContentSchema,
  blocksToText,
  MERGE_TOKEN_HINT,
} from '@/lib/marketing/blocks';
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

/**
 * Build the drafting prompt.
 *
 * Exported so the diagnostic probe can send the byte-identical prompt: a probe
 * that reconstructs an approximation of it can only prove things about the
 * approximation.
 */
export function buildDraftPrompt(input: DraftEmailInput, block: string): string {
  const siblings = input.siblingSubjects?.length
    ? `\n## Other emails in this sequence\nDo not repeat these angles or subject lines:\n${input.siblingSubjects.map((s) => `- ${s}`).join('\n')}`
    : '';

  return `You are a direct-response copywriter for HYBRIDX.

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

## Required fields per block type
Every field is optional in the schema because one shape covers all block types,
so it is on you to send the right ones. Set "type", then only that type's fields:
- hero: heading (+ optional subheading, imageUrl)
- heading: text (+ optional level, 2 or 3)
- paragraph: text
- bulletList: items
- cta: label AND url — a cta without a url is discarded
- image: url AND alt — alt is not optional in practice
- divider: nothing else
- programCard: programName AND description
- statRow: stats, each with value and label
- quote: text (+ optional attribution)
Leave every other field out rather than sending it empty.

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
${input.brief}`;
}

const draftEmailFlow = ai.defineFlow(
  {
    name: 'draftEmailFlow',
    inputSchema: draftEmailInputSchema,
    outputSchema: aiEmailContentSchema,
  },
  async (input) => {
    const { block } = await getPromptKnowledge();

    const { output } = await ai.generate({
      model: MODELS.reasoning,
      output: { schema: aiEmailContentSchema },
      prompt: buildDraftPrompt(input, block),
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

  // Gemini is asked for the flat block shape (see blocks.ts); narrow it back to
  // the strict union before anything renders or validates.
  const { blocks, rejected } = toEmailBlocks(content.blocks);

  const { ok, issues } = validateDraft(
    { subject: content.subject, body: blocksToText(blocks) },
    snapshot,
  );

  // A dropped block makes the email shorter than the model intended, which is
  // not something the reviewer should have to notice for themselves.
  const blockIssues: ValidationIssue[] = rejected.map((r) => ({
    severity: 'error',
    found: r.type,
    message: `The model returned a ${r.type} block that was not usable and has been dropped (${r.reason}). Redraft, or add the block by hand.`,
  }));

  return {
    subject: content.subject,
    previewText: content.previewText,
    blocks,
    html: renderBlocks(blocks, { previewText: content.previewText }),
    text: renderBlocksAsText(blocks),
    issues: [...issues, ...blockIssues],
    valid: ok && rejected.length === 0,
  };
}
