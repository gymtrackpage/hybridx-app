'use client';

// src/components/marketing/block-fields-editor.tsx
//
// Direct field editing for one email block.
//
// Before this, a block's own words were read-only — `blockText(block)`
// rendered as a paragraph of static text, and the only way to change it was
// typing an instruction into a single-line box and waiting for the model to
// rewrite the whole block. Fine for "make this shorter"; painful for fixing
// one word. This is the multi-line, direct alternative: the block's own
// fields, editable in place. The AI-instruction box stays alongside it in
// both callers — this does not replace revision, it adds hand-editing.
//
// One component rather than one copy in the campaign editor and another in
// the Studio's pre-save card, because those two already came close to
// drifting once (the CTA fields were built twice, by hand, in the same
// session) and every block type living here instead means there is one place
// left to fix when a field name changes.

import type { ReactNode } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { EmailBlock } from '@/lib/marketing/blocks';
import { defaultCtaUrl } from '@/lib/marketing/app-routes';

interface Props {
  block: EmailBlock;
  /** Every keystroke. The parent should just store it — no re-validation here. */
  onChange: (next: EmailBlock) => void;
  /**
   * A field has been left. Always called with the FINAL value for that field,
   * never inferred by the parent re-reading its own state — a blur handler
   * below that first normalises the value (trims a bullet list, defaults a
   * blank URL) calls this with that same normalised value, not the block
   * prop, because `onChange` immediately before it has not necessarily been
   * re-rendered into `block` yet by the time this runs in the same handler.
   */
  onCommit: (next: EmailBlock) => void;
  /** Unique per rendered block, so label `htmlFor` and input `id` never collide across cards. */
  idPrefix: string;
  /** id of the shared `<datalist>` of known app pages the parent renders once. */
  urlListId: string;
}

/** A one-line label above a field, matching the existing subject/preview-text style. */
function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}

export function BlockFieldsEditor({ block, onChange, onCommit, idPrefix, urlListId }: Props) {
  const id = (suffix: string) => `${idPrefix}-${suffix}`;
  /** For a field with no normalisation step: the latest value is already `block`. */
  const commitAsIs = () => onCommit(block);

  switch (block.type) {
    case 'hero':
      return (
        <div className="space-y-2">
          <Field id={id('heading')} label="Headline">
            <Input
              id={id('heading')}
              value={block.heading}
              onChange={(e) => onChange({ ...block, heading: e.target.value })}
              onBlur={commitAsIs}
              className="h-8 text-sm"
            />
          </Field>
          <Field id={id('subheading')} label="Subheading (optional)">
            <Input
              id={id('subheading')}
              value={block.subheading ?? ''}
              onChange={(e) => onChange({ ...block, subheading: e.target.value || undefined })}
              onBlur={commitAsIs}
              className="h-8 text-sm"
            />
          </Field>
        </div>
      );

    case 'heading':
      // Short by design — "Section heading" — so a single line is correct
      // here, not a regression of the paragraph/quote case below.
      return (
        <Field id={id('text')} label="Heading text">
          <Input
            id={id('text')}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            onBlur={commitAsIs}
            className="h-8 text-sm"
          />
        </Field>
      );

    case 'paragraph':
      return (
        <Field id={id('text')} label="Paragraph">
          <Textarea
            id={id('text')}
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            onBlur={commitAsIs}
            rows={4}
            className="text-sm"
          />
        </Field>
      );

    case 'bulletList':
      return (
        <Field id={id('items')} label="Bullet points, one per line">
          <Textarea
            id={id('items')}
            value={block.items.join('\n')}
            onChange={(e) => onChange({ ...block, items: e.target.value.split('\n') })}
            onBlur={() => {
              // Free while typing — including a blank trailing line while a
              // new bullet is mid-Enter-press — and only trimmed to real
              // content once the field is left. Filtering on every keystroke
              // would strip that trailing blank line the instant it appears,
              // which would make it impossible to ever start a new bullet.
              const next = { ...block, items: block.items.map((s) => s.trim()).filter(Boolean) };
              onChange(next);
              onCommit(next);
            }}
            rows={Math.max(3, block.items.length)}
            className="text-sm"
          />
        </Field>
      );

    case 'cta':
      return (
        <div className="space-y-2">
          <Field id={id('label')} label="Button text">
            <Input
              id={id('label')}
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              onBlur={commitAsIs}
              className="h-8 text-sm"
            />
          </Field>
          <Field id={id('url')} label="Links to">
            <Input
              id={id('url')}
              list={urlListId}
              value={block.url}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              onBlur={() => {
                // A blank field is not worth keeping around to fail validation
                // with — land it on the one page that works whether or not
                // the reader is signed in.
                const next = { ...block, url: block.url.trim() || defaultCtaUrl() };
                onChange(next);
                onCommit(next);
              }}
              placeholder={`Any URL — blank defaults to ${defaultCtaUrl()}`}
              className="h-8 font-mono text-xs"
            />
          </Field>
        </div>
      );

    case 'image':
      return (
        <div className="space-y-2">
          <Field id={id('url')} label="Image URL">
            <Input
              id={id('url')}
              value={block.url}
              onChange={(e) => onChange({ ...block, url: e.target.value })}
              onBlur={commitAsIs}
              className="h-8 font-mono text-xs"
            />
          </Field>
          <Field id={id('alt')} label="Alt text">
            <Input
              id={id('alt')}
              value={block.alt}
              onChange={(e) => onChange({ ...block, alt: e.target.value })}
              onBlur={commitAsIs}
              className="h-8 text-sm"
            />
          </Field>
          <Field id={id('linkUrl')} label="Link when clicked (optional)">
            <Input
              id={id('linkUrl')}
              list={urlListId}
              value={block.linkUrl ?? ''}
              // Left blank means "not a link", unlike a cta's url — there is
              // no default to fall back to here, only present or absent.
              onChange={(e) => onChange({ ...block, linkUrl: e.target.value || undefined })}
              onBlur={commitAsIs}
              className="h-8 font-mono text-xs"
            />
          </Field>
        </div>
      );

    case 'divider':
      return null;

    case 'programCard':
      return (
        <div className="space-y-2">
          <Field id={id('programName')} label="Programme name">
            <Input
              id={id('programName')}
              value={block.programName}
              onChange={(e) => onChange({ ...block, programName: e.target.value })}
              onBlur={commitAsIs}
              className="h-8 text-sm"
            />
          </Field>
          <Field id={id('description')} label="Description">
            <Textarea
              id={id('description')}
              value={block.description}
              onChange={(e) => onChange({ ...block, description: e.target.value })}
              onBlur={commitAsIs}
              rows={2}
              className="text-sm"
            />
          </Field>
          <Field id={id('url')} label="Link (optional)">
            <Input
              id={id('url')}
              list={urlListId}
              value={block.url ?? ''}
              onChange={(e) => onChange({ ...block, url: e.target.value || undefined })}
              onBlur={commitAsIs}
              className="h-8 font-mono text-xs"
            />
          </Field>
        </div>
      );

    case 'statRow':
      return (
        <div className="space-y-2">
          {block.stats.map((stat, i) => (
            <div key={i} className="flex gap-2">
              <Input
                aria-label={`Stat ${i + 1} value`}
                value={stat.value}
                onChange={(e) => {
                  const stats = block.stats.map((s, j) => (j === i ? { ...s, value: e.target.value } : s));
                  onChange({ ...block, stats });
                }}
                onBlur={commitAsIs}
                placeholder="Value, e.g. 8km"
                className="h-8 w-24 text-sm"
              />
              <Input
                aria-label={`Stat ${i + 1} label`}
                value={stat.label}
                onChange={(e) => {
                  const stats = block.stats.map((s, j) => (j === i ? { ...s, label: e.target.value } : s));
                  onChange({ ...block, stats });
                }}
                onBlur={commitAsIs}
                placeholder="Label, e.g. Running"
                className="h-8 flex-1 text-sm"
              />
            </div>
          ))}
        </div>
      );

    case 'quote':
      return (
        <div className="space-y-2">
          <Field id={id('text')} label="Quote">
            <Textarea
              id={id('text')}
              value={block.text}
              onChange={(e) => onChange({ ...block, text: e.target.value })}
              onBlur={commitAsIs}
              rows={3}
              className="text-sm"
            />
          </Field>
          <Field id={id('attribution')} label="Attribution (optional)">
            <Input
              id={id('attribution')}
              value={block.attribution ?? ''}
              onChange={(e) => onChange({ ...block, attribution: e.target.value || undefined })}
              onBlur={commitAsIs}
              className="h-8 text-sm"
            />
          </Field>
        </div>
      );

    case 'rawHtml':
      return (
        <Field id={id('html')} label="Custom HTML">
          <Textarea
            id={id('html')}
            value={block.html}
            onChange={(e) => onChange({ ...block, html: e.target.value })}
            onBlur={commitAsIs}
            rows={6}
            className="font-mono text-xs"
          />
        </Field>
      );
  }
}
