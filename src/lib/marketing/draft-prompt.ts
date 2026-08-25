// src/lib/marketing/draft-prompt.ts
//
// The drafting prompt, and the input shape it is built from.
//
// This lives here rather than in the flow because draft-email.ts is a
// 'use server' module, where every export must be an async function. A pure
// string builder exported from there is a build error, and making it async to
// satisfy the rule would publish it as a network-callable Server Action — a
// wider surface than a prompt builder has any business having.
//
// Keeping it in lib also means the diagnostic probe sends the byte-identical
// prompt: a probe that reconstructs an approximation of it could only prove
// things about the approximation.

import { z } from 'zod';
import { HYBRIDX_BRAND_CONTEXT } from '@/ai/brand-context';
import { MERGE_TOKEN_HINT } from '@/lib/marketing/blocks';

export const draftEmailInputSchema = z.object({
  brief: z.string().describe('What this email must achieve.'),
  journeyGoal: z.string().optional().describe('The wider goal of the sequence.'),
  audienceDescription: z.string().optional(),
  /** Subjects of the other emails in the sequence, so this one does not repeat them. */
  siblingSubjects: z.array(z.string()).optional(),
  position: z.string().optional().describe('e.g. "email 2 of 3, sent 3 days in".'),
});

export type DraftEmailInput = z.infer<typeof draftEmailInputSchema>;

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
- heading: text (+ optional level, 2 or 3) — NOT "heading". A block of type
  "heading" puts its words in "text"; the field called "heading" belongs only
  to the hero block.
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
