'use server';

// src/ai/flows/marketing/revise-block.ts
//
// Rewrite one block on instruction — "shorter", "harder CTA", "less corporate".
//
// Scoped to a single block rather than the whole email. HXMailer's reviser
// regenerated the entire HTML body, so improving one paragraph risked changing
// everything else and losing edits the marketer had already made.

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import { HYBRIDX_BRAND_CONTEXT } from '@/ai/brand-context';
import { generatableBlockSchema, MERGE_TOKEN_HINT } from '@/lib/marketing/blocks';
import { getPromptKnowledge } from '@/lib/marketing/knowledge';

const reviseBlockInputSchema = z.object({
  block: z.unknown().describe('The block to revise, as JSON.'),
  instruction: z.string().describe('What to change, e.g. "make it shorter and more direct".'),
  emailContext: z.string().optional().describe('Surrounding copy, so the revision fits.'),
});

export type ReviseBlockInput = z.infer<typeof reviseBlockInputSchema>;

const reviseBlockFlow = ai.defineFlow(
  {
    name: 'reviseBlockFlow',
    inputSchema: reviseBlockInputSchema,
    outputSchema: generatableBlockSchema,
  },
  async ({ block, instruction, emailContext }) => {
    const { block: facts } = await getPromptKnowledge();

    const { output } = await ai.generate({
      // A single-block rewrite is a small, well-constrained edit, so the faster
      // default model is the right trade here.
      output: { schema: generatableBlockSchema },
      prompt: `You are editing one block of a HYBRIDX marketing email.

${HYBRIDX_BRAND_CONTEXT}

${facts}

## Rules
- Return the SAME block type you were given. Never change the type.
- Change only what the instruction asks for.
- Preserve any merge tokens present in the original. ${MERGE_TOKEN_HINT}
- Preserve URLs unless the instruction is explicitly about them.
- Never introduce a price, trial length, programme name or statistic that is
  not in the facts above.

${emailContext ? `## Surrounding email\n${emailContext}\n` : ''}
## Block to revise
${JSON.stringify(block, null, 2)}

## Instruction
${instruction}`,
    });

    if (!output) throw new Error('The revision flow returned no output.');
    return output;
  },
);

export async function reviseBlock(input: ReviseBlockInput) {
  return reviseBlockFlow(input);
}
