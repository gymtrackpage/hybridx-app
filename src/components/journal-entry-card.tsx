'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Sparkles, Pencil, Trash2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { journalInsight } from '@/ai/flows/journal-insight';
import { updateJournalEntry, deleteJournalEntry } from '@/services/journal-service-client';
import { JournalEntryForm } from '@/components/journal-entry-form';
import type { JournalEntry, MoodLevel } from '@/models/types';

const MOOD_COLOURS: Record<MoodLevel, string> = {
  great:      'bg-green-500 text-white',
  good:       'bg-emerald-400 text-white',
  okay:       'bg-yellow-400 text-white',
  tired:      'bg-orange-400 text-white',
  struggling: 'bg-red-500 text-white',
};

const MOOD_LABELS: Record<MoodLevel, string> = {
  great:      'Great',
  good:       'Good',
  okay:       'Okay',
  tired:      'Tired',
  struggling: 'Struggling',
};

const EXCERPT_LENGTH = 150;

interface JournalEntryCardProps {
  entry: JournalEntry;
  userId: string;
  userData: string;           // JSON string of athlete data for AI context
  onDeleted: (id: string) => void;
  onUpdated: (entry: JournalEntry) => void;
}

export function JournalEntryCard({
  entry: initialEntry,
  userId,
  userData,
  onDeleted,
  onUpdated,
}: JournalEntryCardProps) {
  const { toast } = useToast();
  const [entry, setEntry] = useState<JournalEntry>(initialEntry);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInsightExpanded, setIsInsightExpanded] = useState(false);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isLong = entry.content.length > EXCERPT_LENGTH;
  const displayContent = isExpanded || !isLong
    ? entry.content
    : `${entry.content.slice(0, EXCERPT_LENGTH)}…`;

  const handleGetInsight = async () => {
    setIsLoadingInsight(true);
    try {
      const result = await journalInsight({
        journalContent: entry.content,
        mood: entry.mood,
        tags: entry.tags,
        entryDate: format(entry.date, 'yyyy-MM-dd'),
        userData,
      });
      const now = new Date();
      await updateJournalEntry(entry.id, {
        aiInsight: result.insight,
        aiInsightGeneratedAt: now,
      });
      const updated: JournalEntry = {
        ...entry,
        aiInsight: result.insight,
        aiInsightGeneratedAt: now,
        updatedAt: now,
      };
      setEntry(updated);
      onUpdated(updated);
      setIsInsightExpanded(true);
      toast({ title: 'Insight ready', description: 'Your coach has responded to your journal entry.' });
    } catch (err) {
      console.error('Error getting journal insight:', err);
      toast({
        title: 'Error',
        description: 'Failed to get AI insight. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingInsight(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteJournalEntry(entry.id);
      onDeleted(entry.id);
      toast({ title: 'Entry deleted', description: 'Your journal entry has been removed.' });
    } catch (err) {
      console.error('Error deleting journal entry:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete entry. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    // The parent page will refresh via its own onSuccess handler
    // But we also locally update to avoid a full reload
    toast({ title: 'Entry updated' });
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-sm">
                {format(entry.date, 'EEEE, d MMMM yyyy')}
              </span>
              <div className="flex flex-wrap gap-1">
                {entry.mood && (
                  <Badge className={cn('text-xs', MOOD_COLOURS[entry.mood])}>
                    {MOOD_LABELS[entry.mood]}
                  </Badge>
                )}
                {entry.tags?.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs capitalize">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsEditOpen(true)}
                aria-label="Edit entry"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    aria-label="Delete entry"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete journal entry?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your entry from{' '}
                      {format(entry.date, 'd MMMM yyyy')}. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Journal text */}
          <div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {displayContent}
            </p>
            {isLong && (
              <button
                type="button"
                onClick={() => setIsExpanded(v => !v)}
                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              >
                {isExpanded ? (
                  <><ChevronUp className="h-3 w-3" /> Show less</>
                ) : (
                  <><ChevronDown className="h-3 w-3" /> Read more</>
                )}
              </button>
            )}
          </div>

          {/* AI insight section */}
          {entry.aiInsight ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
              <button
                type="button"
                onClick={() => setIsInsightExpanded(v => !v)}
                className="flex items-center gap-2 text-xs font-medium text-primary w-full text-left"
              >
                <Sparkles className="h-3.5 w-3.5 flex-shrink-0" />
                <span>Coach Insight</span>
                {isInsightExpanded
                  ? <ChevronUp className="h-3 w-3 ml-auto" />
                  : <ChevronDown className="h-3 w-3 ml-auto" />}
              </button>
              {isInsightExpanded && (
                <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                  {entry.aiInsight}
                </p>
              )}
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-primary border-primary/30 hover:bg-primary/5"
              onClick={handleGetInsight}
              disabled={isLoadingInsight}
            >
              {isLoadingInsight ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isLoadingInsight ? 'Getting insight…' : 'Get Coach Insight'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Journal Entry</DialogTitle>
          </DialogHeader>
          <JournalEntryForm
            userId={userId}
            entry={entry}
            onSuccess={() => {
              handleEditSuccess();
              // Reload entry data from parent via onUpdated with updated fields
              setIsEditOpen(false);
            }}
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
