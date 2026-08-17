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

/** Merge tokens usable inside any text field. Resolved per recipient at send time. */
export const MERGE_TOKEN_HINT =
  'You may use [First Name], [Last Name], [Full Name] and [Email] as merge tokens in any text.';

const hero = z.object({
  type: z.literal('hero'),
  heading: z.string().describe('Short, punchy headline. Under 60 characters.'),
  subheading: z.string().optional().describe('One supporting sentence.'),
  imageUrl: z.string().optional().describe('Absolute https URL of a hero image.'),
});

const heading = z.object({
  type: z.literal('heading'),
  text: z.string(),
  level: z.union([z.literal(2), z.literal(3)]).default(2),
});

const paragraph = z.object({
  type: z.literal('paragraph'),
  text: z.string().describe('One paragraph of body copy. Plain text; no HTML.'),
});

const bulletList = z.object({
  type: z.literal('bulletList'),
  items: z.array(z.string()).min(1).max(8),
});

const cta = z.object({
  type: z.literal('cta'),
  label: z.string().describe('Button text. Two to four words, action-led.'),
  url: z.string().describe('Absolute https URL.'),
});

const image = z.object({
  type: z.literal('image'),
  url: z.string(),
  alt: z.string().describe('Alt text. Required — many clients block images by default.'),
  linkUrl: z.string().optional(),
});

const divider = z.object({ type: z.literal('divider') });

const programCard = z.object({
  type: z.literal('programCard'),
  programName: z.string().describe('Must exactly match a programme from the supplied facts.'),
  description: z.string(),
  url: z.string().optional(),
});

const statRow = z.object({
  type: z.literal('statRow'),
  stats: z
    .array(z.object({ value: z.string(), label: z.string() }))
    .min(2)
    .max(3)
    .describe('Only figures present in the supplied facts, or the recipient\'s own data.'),
});

const quote = z.object({
  type: z.literal('quote'),
  text: z.string(),
  attribution: z.string().optional(),
});

/**
 * Escape hatch for hand-built emails and for campaigns migrated from HXMailer,
 * which are HTML-only. Never produced by the AI flows — the whole point of the
 * block model is that generated content cannot emit arbitrary markup.
 */
const rawHtml = z.object({
  type: z.literal('rawHtml'),
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

export const emailContentSchema = z.object({
  subject: z.string().describe('Subject line. Under 60 characters so inboxes do not truncate it.'),
  previewText: z
    .string()
    .describe('Preheader shown after the subject in the inbox. One short sentence.'),
  blocks: z.array(generatableBlockSchema).min(2).max(20),
});

export type EmailContent = z.infer<typeof emailContentSchema>;

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
