// src/app/api/marketing/ai-probe/route.ts
//
// Isolates which half of the drafting request Gemini is rejecting.
//
// Drafting fails with a bare 400 INVALID_ARGUMENT. Gemini returns no
// `error.details[]` for it, so nothing in the response names the offending
// field, and three rounds of reasoning from the schema alone produced three
// wrong answers. This route stops the guessing by bisecting the request
// against the live API: it varies the schema and the prompt independently and
// reports which combinations fail.
//
// Read it as a truth table. A tiny schema with the real prompt failing points
// at the prompt; the real schema with a trivial prompt failing points at the
// schema; both failing points at something shared, such as the model or key.
//
// GET /api/marketing/ai-probe   Authorization: Bearer $CRON_SECRET
//
// Diagnostic only — it makes real (small) API calls and sends no email.

import { NextResponse } from 'next/server';
import { z } from 'genkit';
import { requireCronAuth } from '@/lib/cron-auth';
import { ai, MODELS } from '@/ai/genkit';
import { aiEmailContentSchema, aiBlockSchema } from '@/lib/marketing/blocks';
import { buildDraftPrompt } from '@/lib/marketing/draft-prompt';
import { getPromptKnowledge } from '@/lib/marketing/knowledge';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TRIVIAL_PROMPT = 'Reply with a short subject line for a fitness email.';

const trivialSchema = z.object({ subject: z.string() });

/** The block schema alone, wrapped — separates "the union" from "the wrapper". */
const blocksOnlySchema = z.object({ blocks: z.array(aiBlockSchema).min(1).max(3) });

/**
 * The wrapper, parameterised.
 *
 * Round one showed the block schema passing at maxItems 3 and the real wrapper
 * failing at 20. Two things differ between them — the cap, and the two extra
 * string fields — so this varies one at a time, then ladders the cap to find
 * the exact boundary rather than picking a number that merely looks safe.
 */
function wrapper(opts: { max: number; extras: boolean }) {
  const shape: Record<string, z.ZodTypeAny> = {
    blocks: z.array(aiBlockSchema).min(1).max(opts.max),
  };
  if (opts.extras) {
    shape.subject = z
      .string()
      .describe('Subject line. Under 60 characters so inboxes do not truncate it.');
    shape.previewText = z
      .string()
      .describe('Preheader shown after the subject in the inbox. One short sentence.');
  }
  return z.object(shape);
}

interface ProbeResult {
  name: string;
  ok: boolean;
  error?: string;
  /** Gemini's parsed error body, which is where any field-level detail lives. */
  detail?: unknown;
}

async function probe(
  name: string,
  run: () => Promise<unknown>,
): Promise<ProbeResult> {
  try {
    await run();
    return { name, ok: true };
  } catch (err: unknown) {
    const e = err as { message?: string; detail?: unknown };
    return {
      name,
      ok: false,
      error: e?.message ?? String(err),
      detail: e?.detail,
    };
  }
}

export async function GET(request: Request) {
  const denied = requireCronAuth(request, 'ai-probe');
  if (denied) return denied;

  const { block } = await getPromptKnowledge();
  const realPrompt = buildDraftPrompt(
    { brief: 'Win back an athlete who cancelled last month.' },
    block,
  );

  const results: ProbeResult[] = [];

  // 1. Is the model reachable at all, with no structured output involved?
  results.push(
    await probe('model reachable, no schema', () =>
      ai.generate({ model: MODELS.reasoning, prompt: TRIVIAL_PROMPT }),
    ),
  );

  // 2. Structured output at its simplest.
  results.push(
    await probe('trivial schema + trivial prompt', () =>
      ai.generate({
        model: MODELS.reasoning,
        output: { schema: trivialSchema },
        prompt: TRIVIAL_PROMPT,
      }),
    ),
  );

  // 3. Real prompt, trivial schema. Failure here indicts the PROMPT.
  results.push(
    await probe('trivial schema + REAL drafting prompt', () =>
      ai.generate({
        model: MODELS.reasoning,
        output: { schema: trivialSchema },
        prompt: realPrompt,
      }),
    ),
  );

  // 4. Real schema, trivial prompt. Failure here indicts the SCHEMA.
  results.push(
    await probe('REAL email schema + trivial prompt', () =>
      ai.generate({
        model: MODELS.reasoning,
        output: { schema: aiEmailContentSchema },
        prompt: TRIVIAL_PROMPT,
      }),
    ),
  );

  // 5. Narrows #4: is it the block schema or the wrapper around it?
  results.push(
    await probe('blocks-only schema + trivial prompt', () =>
      ai.generate({
        model: MODELS.reasoning,
        output: { schema: blocksOnlySchema },
        prompt: TRIVIAL_PROMPT,
      }),
    ),
  );

  // 6. The real thing, to confirm the probe reproduces the live failure.
  results.push(
    await probe('REAL schema + REAL prompt (full repro)', () =>
      ai.generate({
        model: MODELS.reasoning,
        output: { schema: aiEmailContentSchema },
        prompt: realPrompt,
      }),
    ),
  );

  // 7. Same as #6 on the default model, to rule the model in or out.
  results.push(
    await probe('REAL schema + REAL prompt on MODELS.fast', () =>
      ai.generate({
        model: MODELS.fast,
        output: { schema: aiEmailContentSchema },
        prompt: realPrompt,
      }),
    ),
  );

  // Part B: isolate the two differences between the passing blocks-only schema
  // and the failing real one, then find where the cap stops working.
  results.push(
    await probe('wrapper: cap 3, no extra fields (control)', () =>
      ai.generate({
        model: MODELS.reasoning,
        output: { schema: wrapper({ max: 3, extras: false }) },
        prompt: TRIVIAL_PROMPT,
      }),
    ),
  );
  results.push(
    await probe('wrapper: cap 3, WITH subject+previewText', () =>
      ai.generate({
        model: MODELS.reasoning,
        output: { schema: wrapper({ max: 3, extras: true }) },
        prompt: TRIVIAL_PROMPT,
      }),
    ),
  );
  for (const max of [5, 8, 10, 12, 15, 20]) {
    results.push(
      await probe(`wrapper: cap ${max}, no extra fields`, () =>
        ai.generate({
          model: MODELS.reasoning,
          output: { schema: wrapper({ max, extras: false }) },
          prompt: TRIVIAL_PROMPT,
        }),
      ),
    );
  }

  return NextResponse.json(
    {
      model: MODELS.reasoning,
      promptChars: realPrompt.length,
      knowledgeBlockChars: block.length,
      summary: results.map((r) => `${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`),
      results,
    },
    { status: 200 },
  );
}
