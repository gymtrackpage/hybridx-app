'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { Pencil, Trash2, ArrowRight, Sparkles } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { deleteJournalEntry } from '@/services/journal-service-client';
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
  userData: string;
  onDeleted: (id: string) => void;
  onUpdated: (entry: JournalEntry) => void;
}

export function JournalEntryCard({
  entry: initialEntry,
  userId,
  onDeleted,
  onUpdated,
}: JournalEntryCardProps) {
  const { toast } = useToast();
  const [entry] = useState<JournalEntry>(initialEntry);
  const [isEditOpen, setIsEditOpen] = useState(false);

  const isLong = entry.content.length > EXCERPT_LENGTH;
  const excerpt = isLong
    ? `${entry.content.slice(0, EXCERPT_LENGTH)}…`
    : entry.content;

  const hasAnalysis = Boolean(entry.aiInterpretation || entry.aiCoachResponse || entry.aiInsight);

  const handleDelete = async () => {
    try {
      await deleteJournalEntry(entry.id);
      onDeleted(entry.id);
      toast({ title: 'Entry deleted', description: 'Your journal entry has been removed.' });
    } catch (err) {
      console.error('Error deleting journal entry:', err);
      toast({ title: 'Error', description: 'Failed to delete entry.', variant: 'destructive' });
    }
  };

  const handleEditSuccess = () => {
    setIsEditOpen(false);
    toast({ title: 'Entry updated' });
  };

  return (
    <>
      <Card className="transition-shadow hover:shadow-md">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1.5 min-w-0">
              <span className="font-semibold text-sm truncate">
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
                {hasAnalysis && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Sparkles className="h-3 w-3" />
                    Analysed
                  </Badge>
                )}
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
          {/* Excerpt */}
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
            {excerpt}
          </p>

          {/* Read entry link */}
          <Link href={`/journal/${entry.id}`} className="block">
            <Button variant="outline" size="sm" className="w-full gap-2 group">
              Read Entry
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </Button>
          </Link>
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
            onSuccess={handleEditSuccess}
            onCancel={() => setIsEditOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
