'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Eye, Loader2, Pencil, Save, Sparkles, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { BLOCK_LABELS, blockText, type EmailBlock, type EmailBlockType } from '@/lib/marketing/blocks';
import { APP_MARKETING_PATHS } from '@/lib/marketing/app-routes';
import { BlockFieldsEditor } from '@/components/marketing/block-fields-editor';
import { renderBlocks } from '@/lib/marketing/render';
import { updateCampaignContent } from '@/lib/marketing/actions';
import { revalidateContent, reviseEmailBlock, suggestSubjects } from '@/lib/marketing/studio-actions';
import type { ValidationIssue } from '@/lib/marketing/validate';

interface Props {
  campaignId: string;
  initial: {
    subject: string;
    previewText: string;
    blocks: EmailBlock[];
    htmlBody: string;
  };
  /** Migrated HXMailer campaigns have HTML but no blocks — not block-editable. */
  legacyHtmlOnly: boolean;
}

/** Blocks an author can add by hand. rawHtml is the escape hatch; hero is usually first. */
const ADDABLE: EmailBlockType[] = [
  'heading',
  'paragraph',
  'bulletList',
  'cta',
  'image',
  'divider',
  'quote',
  'statRow',
  'rawHtml',
];

function emptyBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case 'hero':
      return { type: 'hero', heading: 'New headline' };
    case 'heading':
      return { type: 'heading', text: 'Section heading', level: 2 };
    case 'paragraph':
      return { type: 'paragraph', text: 'Write something here.' };
    case 'bulletList':
      return { type: 'bulletList', items: ['First point'] };
    case 'cta':
      return { type: 'cta', label: 'Open HYBRIDX', url: 'https://app.hybridx.club/dashboard' };
    case 'image':
      return { type: 'image', url: '', alt: '' };
    case 'divider':
      return { type: 'divider' };
    case 'quote':
      return { type: 'quote', text: 'Something an athlete said.' };
    case 'statRow':
      return { type: 'statRow', stats: [{ value: '8km', label: 'Running' }, { value: '8', label: 'Stations' }] };
    case 'programCard':
      return { type: 'programCard', programName: '', description: '' };
    case 'rawHtml':
      return { type: 'rawHtml', html: '<p>Custom HTML</p>' };
  }
}

export function CampaignEditor({ campaignId, initial, legacyHtmlOnly }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [subject, setSubject] = useState(initial.subject);
  const [previewText, setPreviewText] = useState(initial.previewText);
  const [blocks, setBlocks] = useState<EmailBlock[]>(initial.blocks);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyBlock, setBusyBlock] = useState<number | null>(null);
  const [instruction, setInstruction] = useState<Record<number, string>>({});
  const [subjectIdeas, setSubjectIdeas] = useState<
    Array<{ subject: string; previewText: string; angle: string; rationale: string }>
  >([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  // Preview is derived, never stored in state — it cannot drift from the blocks.
  const previewHtml = useMemo(
    () => (legacyHtmlOnly ? initial.htmlBody : renderBlocks(blocks, { previewText })),
    [blocks, previewText, legacyHtmlOnly, initial.htmlBody],
  );

  const errors = issues.filter((i) => i.severity === 'error');

  const mutate = (next: EmailBlock[]) => {
    setBlocks(next);
    setDirty(true);
  };

  const updateBlock = (index: number, next: EmailBlock) => {
    mutate(blocks.map((b, j) => (j === index ? next : b)));
  };

  /**
   * A block field was committed (blurred). Revalidates with the array built
   * from the value BlockFieldsEditor just handed us, not by reading `blocks`
   * back out of state — setState is not synchronous, so a re-read here could
   * still be the array from before this exact edit.
   */
  const commitBlock = (index: number, next: EmailBlock) => {
    const nextBlocks = blocks.map((b, j) => (j === index ? next : b));
    mutate(nextBlocks);
    void check(nextBlocks, subject);
  };

  const check = async (nextBlocks: EmailBlock[], nextSubject: string) => {
    const result = await revalidateContent({ subject: nextSubject, blocks: nextBlocks });
    if (result.success) setIssues(result.data.issues);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateCampaignContent(campaignId, { subject, previewText, blocks });
    setSaving(false);

    if (result.success) {
      setDirty(false);
      toast({ title: 'Saved' });
      router.refresh();
    } else {
      toast({ title: 'Could not save', description: result.error, variant: 'destructive' });
    }
  };

  const handleRevise = async (index: number) => {
    const text = instruction[index]?.trim();
    if (!text) return;

    setBusyBlock(index);
    const result = await reviseEmailBlock({
      block: blocks[index],
      instruction: text,
      emailContext: blocks.map(blockText).filter(Boolean).join('\n'),
    });
    setBusyBlock(null);

    if (!result.success) {
      toast({ title: 'Could not revise', description: result.error, variant: 'destructive' });
      return;
    }

    const next = blocks.map((b, i) => (i === index ? result.data : b));
    setInstruction({ ...instruction, [index]: '' });
    mutate(next);
    void check(next, subject);
  };

  const handleSuggestSubjects = async () => {
    setLoadingSubjects(true);
    const result = await suggestSubjects({
      currentSubject: subject,
      emailSummary: blocks.map(blockText).filter(Boolean).join(' ').slice(0, 800),
    });
    setLoadingSubjects(false);

    if (result.success) setSubjectIdeas(result.data.variants);
    else toast({ title: 'Could not suggest', description: result.error, variant: 'destructive' });
  };

  return (
    <div className="space-y-4">
      {legacyHtmlOnly && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Migrated campaign</AlertTitle>
          <AlertDescription>
            This came across from HXMailer as raw HTML, so it has no editable blocks. The subject
            and preview text can still be changed; to rebuild the body, create a new campaign in
            the studio.
          </AlertDescription>
        </Alert>
      )}

      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {errors.some((i) => i.kind !== 'structure') ? 'Fact check failed' : 'Draft incomplete'}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-inside list-disc space-y-1">
              {errors.map((issue, i) => (
                <li key={i}>
                  <span className="font-mono text-xs">{issue.found}</span> — {issue.message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader className="flex flex-col items-stretch gap-3 space-y-0 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <CardTitle className="text-base">Content</CardTitle>
          <Button className="sm:w-auto" onClick={handleSave} disabled={saving || !dirty}>
            {saving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <div className="flex gap-2">
              <Input
                id="subject"
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setDirty(true);
                }}
                onBlur={() => check(blocks, subject)}
              />
              <Button variant="outline" size="icon" className="shrink-0" onClick={handleSuggestSubjects} disabled={loadingSubjects}>
                {loadingSubjects ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {subject.length} characters
              {subject.length > 60 && ' — most inboxes truncate beyond about 60'}
            </p>
          </div>

          {subjectIdeas.length > 0 && (
            <div className="space-y-2 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Alternatives, ranked against this list&apos;s own history
              </p>
              {subjectIdeas.map((idea, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setSubject(idea.subject);
                    setPreviewText(idea.previewText);
                    setSubjectIdeas([]);
                    setDirty(true);
                    void check(blocks, idea.subject);
                  }}
                  className="w-full rounded-md border p-2 text-left transition-colors hover:bg-muted"
                >
                  <p className="text-sm font-medium">{idea.subject}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    <span className="uppercase tracking-wide">{idea.angle}</span> — {idea.rationale}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="preview-text">Preview text</Label>
            <Input
              id="preview-text"
              value={previewText}
              onChange={(e) => {
                setPreviewText(e.target.value);
                setDirty(true);
              }}
              placeholder="Shown beside the subject in the inbox"
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue={legacyHtmlOnly ? 'preview' : 'blocks'}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="blocks" className="flex-1 sm:flex-none" disabled={legacyHtmlOnly}>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Blocks
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex-1 sm:flex-none">
            <Eye className="mr-2 h-3.5 w-3.5" />
            Preview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="blocks" className="space-y-3 pt-4">
          {blocks.map((block, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="text-[10px]">
                    {BLOCK_LABELS[block.type]}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => mutate(blocks.filter((_, j) => j !== i))}
                    aria-label={`Remove ${BLOCK_LABELS[block.type]} block`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <BlockFieldsEditor
                  block={block}
                  onChange={(next) => updateBlock(i, next)}
                  onCommit={(next) => commitBlock(i, next)}
                  idPrefix={`block-${i}`}
                  urlListId="cta-known-urls"
                />

                <div className="flex gap-2">
                  <Input
                    value={instruction[i] ?? ''}
                    onChange={(e) => setInstruction({ ...instruction, [i]: e.target.value })}
                    placeholder="Shorter, harder CTA, less corporate…"
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void handleRevise(i);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyBlock === i || !instruction[i]?.trim()}
                    onClick={() => handleRevise(i)}
                  >
                    {busyBlock === i ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          <div className="flex items-center gap-2">
            <Select onValueChange={(type) => mutate([...blocks, emptyBlock(type as EmailBlockType)])}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Add a block…" />
              </SelectTrigger>
              <SelectContent>
                {ADDABLE.map((type) => (
                  <SelectItem key={type} value={type}>
                    {BLOCK_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="pt-4">
          <iframe
            srcDoc={previewHtml}
            title="Campaign preview"
            className="h-[60vh] min-h-[320px] w-full rounded-md border bg-white sm:h-[640px]"
            sandbox=""
          />
        </TabsContent>
      </Tabs>

      <datalist id="cta-known-urls">
        {APP_MARKETING_PATHS.map((path) => (
          <option key={path} value={`https://app.hybridx.club${path === '/' ? '' : path}`} />
        ))}
      </datalist>
    </div>
  );
}
