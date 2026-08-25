// src/lib/marketing/blocks.ts
//
// The structured content model for emails.
//
// HXMailer's AI styler returned a raw `styledHtml` string. That is the wrong
// output shape for three reasons:
//
//   - Email HTML is not web HTML. It needs tables, inline styles and Outlook
//     conditionals; a model regenerating it wholesale gets it subtly wrong in a
//     different way every time.
//   - The brand drifts. Every regeneration is a fresh chance to invent a new
//     shade, a new button radius, a new heading size.
//   - Editing means editing HTML. Changing one paragraph meant hand-editing a
//     markup blob, or regenerating the whole email and losing everything else.
//
// So the model chooses *structure and words* and nothing else. It emits a typed
// block array; render.ts turns that into email-safe HTML from one template that
// owns every visual decision. Branding is then correct by construction, any
// block is independently editable, and a brand change re-renders every campaign
// instead of needing forty emails rewritten.

import { z } from 'zod';

// A note on `z.enum(['hero'])` where `z.literal('hero')` would read better.
//
// These schemas are sent to Gemini as `generationConfig.responseSchema`, which
// is a restricted OpenAPI subset, not full JSON Schema. `z.literal()` compiles
// to `{"const": "hero"}`, and `const` is not a field on Gemini's Schema type —
// the request is rejected with a 400 INVALID_ARGUMENT before the model runs.
// `z.enum(['hero'])` compiles to `{"type":"string","enum":["hero"]}`, which is
// supported and infers the same `'hero'` TypeScript type.
//
// Same reason `level` is a bounded integer rather than `z.union([z.literal(2),
// z.literal(3)])`: that compiles to `{"enum":[2,3]}`, and Gemini's `enum` is a
// list of *strings*, so numeric members are rejected too.
//
// See also src/ai/flows/analyze-and-adjust.ts, which hit this same limit.

/** Merge tokens usable inside any text field. Resolved per recipient at send time. */
export const MERGE_TOKEN_HINT =
  'You may use [First Name], [Last Name], [Full Name] and [Email] as merge tokens in any text.';

const hero = z.object({
  type: z.enum(['hero']),
  heading: z.string().describe('Short, punchy headline. Under 60 characters.'),
  subheading: z.string().optional().describe('One supporting sentence.'),
  imageUrl: z.string().optional().describe('Absolute https URL of a hero image.'),
});

const heading = z.object({
  type: z.enum(['heading']),
  text: z.string(),
  level: z.number().int().min(2).max(3).default(2),
});

const paragraph = z.object({
  type: z.enum(['paragraph']),
  text: z.string().describe('One paragraph of body copy. Plain text; no HTML.'),
});

const bulletList = z.object({
  type: z.enum(['bulletList']),
  items: z.array(z.string()).min(1).max(8),
});

const cta = z.object({
  type: z.enum(['cta']),
  label: z.string().describe('Button text. Two to four words, action-led.'),
  url: z.string().describe('Absolute https URL.'),
});

const image = z.object({
  type: z.enum(['image']),
  url: z.string(),
  alt: z.string().describe('Alt text. Required — many clients block images by default.'),
  linkUrl: z.string().optional(),
});

const divider = z.object({ type: z.enum(['divider']) });

const programCard = z.object({
  type: z.enum(['programCard']),
  programName: z.string().describe('Must exactly match a programme from the supplied facts.'),
  description: z.string(),
  url: z.string().optional(),
});

const statRow = z.object({
  type: z.enum(['statRow']),
  stats: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .min(2)
    .max(3)
    .describe('Only figures present in the supplied facts, or the recipient\'s own data.'),
});

const quote = z.object({
  type: z.enum(['quote']),
  text: z.string(),
  attribution: z.string().optional(),
});

/**
 * Escape hatch for hand-built emails and for campaigns migrated from HXMailer,
 * which are HTML-only. Never produced by the AI flows — the whole point of the
 * block model is that generated content cannot emit arbitrary markup.
 */
const rawHtml = z.object({
  type: z.enum(['rawHtml']),
  html: z.string(),
});

export const emailBlockSchema = z.discriminatedUnion('type', [
  hero,
  heading,
  paragraph,
  bulletList,
  cta,
  image,
  divider,
  programCard,
  statRow,
  quote,
  rawHtml,
]);

export type EmailBlock = z.infer<typeof emailBlockSchema>;
export type EmailBlockType = EmailBlock['type'];

/** The blocks an AI flow may emit — rawHtml is deliberately excluded. */
export const generatableBlockSchema = z.discriminatedUnion('type', [
  hero,
  heading,
  paragraph,
  bulletList,
  cta,
  image,
  divider,
  programCard,
  statRow,
  quote,
]);

/** A block an AI flow may emit — the union above minus rawHtml. */
export type GeneratableBlock = z.infer<typeof generatableBlockSchema>;

export const emailContentSchema = z.object({
  subject: z.string().describe('Subject line. Under 60 characters so inboxes do not truncate it.'),
  previewText: z
    .string()
    .describe('Preheader shown after the subject in the inbox. One short sentence.'),
  blocks: z.array(generatableBlockSchema).min(2).max(20),
});

export type EmailContent = z.infer<typeof emailContentSchema>;

// ---------------------------------------------------------------------------
// The AI-facing shape
// ---------------------------------------------------------------------------
//
// Everything above is the real model: a discriminated union, where a `cta` is
// guaranteed to carry a `url` and a `quote` cannot. That is what storage and
// render.ts work with, and it stays strict.
//
// It cannot be what we ask Gemini for. A zod discriminated union compiles to
// JSON Schema `anyOf`, and `anyOf` inside `items` is rejected by
// `generationConfig.responseSchema` with a bare 400 INVALID_ARGUMENT. The
// natural experiment is in this repo: compose-journey's `plannedStepSchema`
// and analyze-and-adjust's `WorkoutSchema` are both unions-in-spirit that were
// already flattened into one object with optional fields, and both work. This
// union was the only one left, and drafting was the only flow failing.
//
// So the model is asked for one flat object per block — a `type` enum plus
// every field any variant might need, all optional — and the result is narrowed
// back into the strict union by `toEmailBlocks` below. The looseness is
// confined to the API boundary; nothing downstream sees it.

/** Every block type an AI flow may emit. Order matches the union above. */
export const GENERATABLE_BLOCK_TYPES = [
  'hero',
  'heading',
  'paragraph',
  'bulletList',
  'cta',
  'image',
  'divider',
  'programCard',
  'statRow',
  'quote',
] as const;

/**
 * One block as Gemini is asked to produce it. Flat and permissive by
 * necessity — `toEmailBlocks` is what enforces the real per-type rules.
 */
export const aiBlockSchema = z.object({
  type: z.enum(GENERATABLE_BLOCK_TYPES).describe('Which kind of block this is.'),
  // hero
  heading: z.string().optional().describe('hero: short, punchy headline, under 60 characters.'),
  subheading: z.string().optional().describe('hero: one supporting sentence.'),
  imageUrl: z.string().optional().describe('hero: absolute https URL of a hero image.'),
  // heading, paragraph, quote
  text: z.string().optional().describe('heading/paragraph/quote: the text itself. Plain text; no HTML.'),
  // Deliberately an unconstrained number, not .int().min(2).max(3).
  //
  // `minimum`/`maximum` were the only JSON Schema keywords this schema used
  // that compose-journey's — which Gemini accepts in this same deployment —
  // does not. Rather than keep guessing which keyword the 400 is about, this
  // schema now uses a strict subset of the keyword set that is provably
  // working. toEmailBlocks clamps the value instead, so a stray 5 costs a
  // heading level rather than the whole block.
  level: z.number().optional().describe('heading: 2 for a section, 3 for a sub-section. Use 2 or 3 only.'),
  // bulletList
  items: z.array(z.string()).optional().describe('bulletList: two to eight short points.'),
  // cta
  label: z.string().optional().describe('cta: button text. Two to four words, action-led.'),
  // cta, image, programCard
  url: z.string().optional().describe('cta/image/programCard: absolute https URL.'),
  // image
  alt: z.string().optional().describe('image: alt text. Required — many clients block images.'),
  linkUrl: z.string().optional().describe('image: optional absolute https URL to link the image to.'),
  // programCard
  programName: z.string().optional().describe('programCard: must exactly match a programme from the facts.'),
  description: z.string().optional().describe('programCard: one or two sentences about the programme.'),
  // statRow
  stats: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .optional()
    .describe('statRow: two or three figures. Only figures present in the supplied facts.'),
  // quote
  attribution: z.string().optional().describe('quote: who said it.'),
});

/** What a drafting flow asks Gemini for. */
export const aiEmailContentSchema = z.object({
  subject: z.string().describe('Subject line. Under 60 characters so inboxes do not truncate it.'),
  previewText: z
    .string()
    .describe('Preheader shown after the subject in the inbox. One short sentence.'),
  // max 10, not 20. The probe at /api/marketing/ai-probe showed this wrapper
  // failing while the identical block schema capped at 3 passed, so the cap is
  // implicated — most likely a constrained-decoding grammar limit, since the
  // item schema carries 14 optional properties and Gemini names no field in
  // the 400. 10 is also what the prompt has always asked for ("six to ten
  // blocks"), so the schema now matches its own instruction.
  blocks: z.array(aiBlockSchema).min(2).max(10),
});

export type AiEmailContent = z.infer<typeof aiEmailContentSchema>;

export interface NarrowedBlocks {
  /** Narrowed against generatableBlockSchema, so never a rawHtml block. */
  blocks: GeneratableBlock[];
  /** Blocks the model produced that do not satisfy their own type's rules. */
  rejected: { type: string; reason: string }[];
}

/**
 * Narrow flat AI output back into real blocks.
 *
 * A block that does not satisfy its type's rules — a `cta` with no `url`, a
 * `programCard` with no `programName` — is dropped rather than repaired or
 * passed through. Guessing a missing URL would put a broken link in front of a
 * subscriber; passing it through would break render.ts's exhaustive switch. The
 * caller surfaces `rejected` so a thin draft is visibly thin rather than
 * quietly short.
 *
 * Extra keys are stripped by the per-variant schemas, so the `label` left over
 * from a `cta` cannot ride along on a `paragraph`.
 */
export function toEmailBlocks(raw: z.infer<typeof aiBlockSchema>[]): NarrowedBlocks {
  const blocks: GeneratableBlock[] = [];
  const rejected: { type: string; reason: string }[] = [];

  for (const candidate of raw) {
    // Drop keys the model left explicitly null/undefined so they cannot look
    // like a present-but-invalid value to the variant schema.
    const cleaned: Record<string, unknown> = Object.fromEntries(
      Object.entries(candidate).filter(([, v]) => v !== undefined && v !== null),
    );

    // The AI schema cannot constrain this (see `level` above), so clamp rather
    // than reject: a heading with a silly level is still a usable heading.
    if (cleaned.type === 'heading' && typeof cleaned.level === 'number') {
      cleaned.level = Math.min(3, Math.max(2, Math.round(cleaned.level)));
    }

    const parsed = generatableBlockSchema.safeParse(cleaned);
    if (parsed.success) {
      blocks.push(parsed.data);
      continue;
    }

    const reason = parsed.error.issues
      .map((i) => (i.path.length ? `${i.path.join('.')}: ${i.message}` : i.message))
      .join('; ');
    rejected.push({ type: candidate.type, reason });
  }

  return { blocks, rejected };
}

/** Human-readable label for the block editor. */
export const BLOCK_LABELS: Record<EmailBlockType, string> = {
  hero: 'Hero',
  heading: 'Heading',
  paragraph: 'Paragraph',
  bulletList: 'Bullet list',
  cta: 'Button',
  image: 'Image',
  divider: 'Divider',
  programCard: 'Programme card',
  statRow: 'Stats',
  quote: 'Quote',
  rawHtml: 'Custom HTML',
};

/** Extract every plain-text string in a block, for validation and previews. */
export function blockText(block: EmailBlock): string {
  switch (block.type) {
    case 'hero':
      return [block.heading, block.subheading].filter(Boolean).join(' ');
    case 'heading':
    case 'paragraph':
      return block.text;
    case 'bulletList':
      return block.items.join(' ');
    case 'cta':
      return block.label;
    case 'image':
      return block.alt;
    case 'programCard':
      return `${block.programName} ${block.description}`;
    case 'statRow':
      return block.stats.map((s) => `${s.value} ${s.label}`).join(' ');
    case 'quote':
      return [block.text, block.attribution].filter(Boolean).join(' ');
    case 'rawHtml':
      return block.html;
    case 'divider':
      return '';
  }
}

/** All text across a set of blocks — what the validator checks. */
export function blocksToText(blocks: EmailBlock[]): string {
  return blocks.map(blockText).filter(Boolean).join('\n\n');
}
