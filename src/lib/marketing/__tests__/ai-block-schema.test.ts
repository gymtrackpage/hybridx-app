import { describe, it, expect } from 'vitest';
import { toJsonSchema } from '@genkit-ai/core/schema';
import {
  aiBlockSchema,
  aiEmailContentSchema,
  toEmailBlocks,
} from '@/lib/marketing/blocks';

// Gemini's `generationConfig.responseSchema` is a restricted OpenAPI subset,
// not full JSON Schema. This is the complete field list from the v1beta
// discovery document (generativelanguage.googleapis.com/$discovery/rest).
// Anything outside it is rejected with a bare 400 INVALID_ARGUMENT, which is
// how the campaign studio broke twice: first on `const` (from z.literal), then
// on `anyOf` (from z.discriminatedUnion).
const GEMINI_SCHEMA_FIELDS = new Set([
  'anyOf', 'default', 'description', 'enum', 'example', 'format', 'items',
  'maxItems', 'maxLength', 'maxProperties', 'maximum', 'minItems', 'minLength',
  'minProperties', 'minimum', 'nullable', 'pattern', 'properties',
  'propertyOrdering', 'required', 'title', 'type',
]);

/** Mirrors the plugin's own cleanSchema, which strips only these two. */
function clean(schema: unknown): any {
  const out: any = structuredClone(schema);
  for (const k in out) {
    if (k === '$schema' || k === 'additionalProperties') {
      delete out[k];
      continue;
    }
    if (typeof out[k] === 'object' && out[k] !== null) out[k] = clean(out[k]);
    if (k === 'type' && Array.isArray(out[k])) out[k] = out[k].find((t: string) => t !== 'null');
  }
  return out;
}

function violations(schema: unknown): string[] {
  const found: string[] = [];
  const walk = (node: any, path: string) => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return;
    for (const [k, v] of Object.entries<any>(node)) {
      const p = path ? `${path}.${k}` : k;
      if (!GEMINI_SCHEMA_FIELDS.has(k)) {
        found.push(`unsupported keyword "${k}" at ${p}`);
        continue;
      }
      // `enum` is a repeated string in the proto, so numeric members fail even
      // though the keyword itself is allowed.
      if (k === 'enum' && Array.isArray(v) && v.some((e) => typeof e !== 'string')) {
        found.push(`non-string enum at ${p}`);
      }
      // anyOf is in the proto but is rejected in practice for these schemas —
      // it is what drafting failed on. Unions must be flattened instead.
      if (k === 'anyOf') found.push(`anyOf at ${p}`);

      if (k === 'properties') for (const [f, sub] of Object.entries(v)) walk(sub, `${p}.${f}`);
      else if (k === 'items') walk(v, p);
    }
  };
  walk(clean(toJsonSchema({ schema: schema as any })), '');
  return found;
}

describe('AI-facing block schemas stay within Gemini responseSchema', () => {
  it('aiEmailContentSchema uses no construct Gemini rejects', () => {
    expect(violations(aiEmailContentSchema)).toEqual([]);
  });

  it('aiBlockSchema uses no construct Gemini rejects', () => {
    expect(violations(aiBlockSchema)).toEqual([]);
  });
});

// The keyword set of compose-journey's output schema, which Gemini accepts in
// production. Two rounds of this bug were spent guessing which keyword the 400
// was about; the durable rule is that a schema we send may only use keywords a
// schema we know works already uses.
const PROVEN_KEYWORDS = new Set([
  '$schema', 'additionalProperties', 'description', 'enum', 'items',
  'maxItems', 'minItems', 'properties', 'required', 'type',
]);

function keywordsUsed(schema: unknown): Set<string> {
  const seen = new Set<string>();
  const walk = (n: any, path: string) => {
    if (!n || typeof n !== 'object' || Array.isArray(n)) return;
    for (const [k, v] of Object.entries<any>(n)) {
      seen.add(k);
      if (k === 'properties') for (const sub of Object.values(v)) walk(sub, path);
      else if (k === 'items' || k === '$defs') walk(v, path);
      else if (k === 'anyOf' || k === 'oneOf') (v as any[]).forEach((s2) => walk(s2, path));
    }
  };
  // Raw, uncleaned: genkit assigns this straight to responseJsonSchema.
  walk(toJsonSchema({ schema: schema as any }), '');
  return seen;
}

describe('AI-facing schemas stay within keywords Gemini demonstrably accepts', () => {
  it('aiEmailContentSchema uses no keyword beyond the proven set', () => {
    const extra = [...keywordsUsed(aiEmailContentSchema)].filter((k) => !PROVEN_KEYWORDS.has(k));
    expect(extra).toEqual([]);
  });
});

describe('toEmailBlocks', () => {
  it('narrows well-formed flat blocks into the strict union', () => {
    const { blocks, rejected } = toEmailBlocks([
      { type: 'hero', heading: 'Back to the start line' },
      { type: 'paragraph', text: 'Hi [First Name].' },
      { type: 'cta', label: 'Resume', url: 'https://app.hybridx.club/dashboard' },
      { type: 'divider' },
    ] as any);

    expect(rejected).toEqual([]);
    expect(blocks.map((b) => b.type)).toEqual(['hero', 'paragraph', 'cta', 'divider']);
  });

  it('defaults an omitted heading level rather than dropping the block', () => {
    const { blocks } = toEmailBlocks([{ type: 'heading', text: 'What changed' }] as any);
    expect(blocks).toHaveLength(1);
    expect((blocks[0] as { level: number }).level).toBe(2);
  });

  it('drops a block missing a field its own type requires, with a reason', () => {
    const { blocks, rejected } = toEmailBlocks([
      { type: 'cta', label: 'Broken' },
      { type: 'programCard', programName: 'HYROX Base' },
    ] as any);

    expect(blocks).toEqual([]);
    expect(rejected.map((r) => r.type)).toEqual(['cta', 'programCard']);
    expect(rejected[0].reason).toContain('url');
    expect(rejected[1].reason).toContain('description');
  });

  it('strips fields belonging to a different variant', () => {
    // The flat shape lets the model attach any field to any block; a leftover
    // cta url must not ride along on a paragraph into storage.
    const { blocks } = toEmailBlocks([
      { type: 'paragraph', text: 'Clean me', label: 'stale', url: 'https://x.test' },
    ] as any);

    expect(blocks[0]).toEqual({ type: 'paragraph', text: 'Clean me' });
  });

  it('clamps an out-of-range heading level instead of dropping the block', () => {
    const { blocks, rejected } = toEmailBlocks([
      { type: 'heading', text: 'Too deep', level: 5 },
      { type: 'heading', text: 'Too shallow', level: 1 },
      { type: 'heading', text: 'Fractional', level: 2.6 },
    ] as any);

    expect(rejected).toEqual([]);
    expect(blocks.map((b) => (b as { level: number }).level)).toEqual([3, 2, 3]);
  });

  it('ignores explicit nulls the model sends for unused fields', () => {
    const { blocks, rejected } = toEmailBlocks([
      { type: 'paragraph', text: 'Still fine', heading: null, items: null },
    ] as any);

    expect(rejected).toEqual([]);
    expect(blocks[0]).toEqual({ type: 'paragraph', text: 'Still fine' });
  });
});
