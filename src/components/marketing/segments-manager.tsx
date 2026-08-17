'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { refreshSegmentCount, removeSegment, saveSegment } from '@/lib/marketing/actions';
import type { SegmentDefinition } from '@/lib/marketing/segments';
import type { SerialisableSegment } from '@/lib/marketing/segment-store';
import { AudiencePicker } from './audience-picker';

interface Props {
  segments: SerialisableSegment[];
  tags: Array<{ tag: string; count: number }>;
}

/** Describe a segment definition in words, for the list. */
function describe(definition: SegmentDefinition): string {
  const parts: string[] = [];

  if (definition.anyTags?.length) parts.push(`tagged ${definition.anyTags.join(' or ')}`);
  if (definition.noneTags?.length) parts.push(`not tagged ${definition.noneTags.join(' or ')}`);

  const athlete = definition.athlete;
  if (athlete?.subscriptionStatus?.length) {
    parts.push(`subscription ${athlete.subscriptionStatus.join(' or ')}`);
  }
  if (athlete?.maxCompletedWorkouts === 0) parts.push('never logged a workout');
  if (athlete?.minCompletedWorkouts) parts.push('has trained');
  if (athlete?.inactiveForDays) parts.push(`inactive ${athlete.inactiveForDays}+ days`);

  return parts.length ? parts.join(', ') : 'everyone on the list';
}

export function SegmentsManager({ segments, tags }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [definition, setDefinition] = useState<SegmentDefinition>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const result = await saveSegment({ name, definition });
    setSaving(false);

    if (result.success) {
      toast({ title: 'Segment saved' });
      setName('');
      setDefinition({});
      setOpen(false);
      router.refresh();
    } else {
      toast({ title: 'Could not save', description: result.error, variant: 'destructive' });
    }
  };

  const run = (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      toast(
        result.success
          ? { title: label }
          : { title: 'Action failed', description: result.error, variant: 'destructive' },
      );
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New segment
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New segment</DialogTitle>
            <DialogDescription>
              Build the audience and give it a name. The count updates as you change it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="segment-name">Name</Label>
              <Input
                id="segment-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Trialists who have never trained"
              />
            </div>

            <AudiencePicker tags={tags} value={definition} onChange={setDefinition} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save segment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {segments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No saved segments yet. Any audience you find yourself rebuilding is worth naming.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {segments.map((segment) => (
            <Card key={segment.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{segment.name}</CardTitle>
                    <CardDescription className="mt-1">{describe(segment.definition)}</CardDescription>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    {segment.lastCount?.toLocaleString() ?? '—'}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => run('Recounted', () => refreshSegmentCount(segment.id))}
                >
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  Recount
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="ghost" disabled={pending}>
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete &ldquo;{segment.name}&rdquo;?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Campaigns and journeys already using this audience keep their own copy of
                        the definition, so nothing already set up will change.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => run('Segment deleted', () => removeSegment(segment.id))}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {segment.lastCountedAt && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Counted {new Date(segment.lastCountedAt).toLocaleDateString()}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
