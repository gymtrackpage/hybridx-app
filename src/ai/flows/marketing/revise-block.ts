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
import {
  aiBlockSchema,
  toEmailBlocks,
  MERGE_TOKEN_HINT,
  type GeneratableBlock,
} from '@/lib/marketing/blocks';
import { getPromptKnowledge } from '@/lib/marketing/knowledge';
import { validateLinks } from '@/lib/marketing/validate';

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
    outputSchema: aiBlockSchema,
  },
  async ({ block, instruction, emailContext }) => {
    const { block: facts } = await getPromptKnowledge();

    const { output } = await ai.generate({
      // A single-block rewrite is a small, well-constrained edit, so the faster
      // default model is the right trade here.
      output: { schema: aiBlockSchema },
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

export async function reviseBlock(input: ReviseBlockInput): Promise<GeneratableBlock> {
  const raw = await reviseBlockFlow(input);

  // The flow asks Gemini for the flat block shape (see blocks.ts); narrow it
  // back to a real block before it reaches the editor. There is only one block
  // here, so a rejection is a failure rather than something to drop silently.
  const { blocks, rejected } = toEmailBlocks([raw]);
  if (!blocks.length) {
    throw new Error(
      `The revision was not a valid ${raw.type} block: ${rejected[0]?.reason ?? 'unknown reason'}`,
    );
  }

  // The prompt asks the model to leave URLs alone unless the instruction is
  // about them, but "make the button link to the programs page" is exactly
  // the instruction where it should touch one — and can invent a path that
  // 404s just as easily here as in a first draft. Same failure, same check.
  const linkIssues = validateLinks(
    blocks,
    process.env.NEXT_PUBLIC_APP_URL || 'https://app.hybridx.club',
  );
  if (linkIssues.length) {
    throw new Error(linkIssues[0].message);
  }

  return blocks[0];
}
