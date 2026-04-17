'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { createJournalEntry, updateJournalEntry } from '@/services/journal-service-client';
import type { JournalEntry, MoodLevel, JournalTag } from '@/models/types';

const MOOD_OPTIONS: { value: MoodLevel; label: string; colour: string }[] = [
  { value: 'great',      label: 'Great',      colour: 'bg-green-500 text-white hover:bg-green-600' },
  { value: 'good',       label: 'Good',        colour: 'bg-emerald-400 text-white hover:bg-emerald-500' },
  { value: 'okay',       label: 'Okay',        colour: 'bg-yellow-400 text-white hover:bg-yellow-500' },
  { value: 'tired',      label: 'Tired',       colour: 'bg-orange-400 text-white hover:bg-orange-500' },
  { value: 'struggling', label: 'Struggling',  colour: 'bg-red-500 text-white hover:bg-red-600' },
];

const TAG_OPTIONS: { value: JournalTag; label: string }[] = [
  { value: 'achievement', label: 'Achievement' },
  { value: 'challenge',   label: 'Challenge' },
  { value: 'form',        label: 'Form' },
  { value: 'mental',      label: 'Mental' },
  { value: 'motivation',  label: 'Motivation' },
  { value: 'nutrition',   label: 'Nutrition' },
  { value: 'progress',    label: 'Progress' },
  { value: 'recovery',    label: 'Recovery' },
  { value: 'technique',   label: 'Technique' },
  { value: 'injury',      label: 'Injury' },
];

const journalFormSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  content: z.string().min(1, 'Journal entry cannot be empty'),
  mood: z.enum(['great', 'good', 'okay', 'tired', 'struggling']).optional(),
  tags: z.array(z.string()).optional(),
});

type JournalFormValues = z.infer<typeof journalFormSchema>;

interface JournalEntryFormProps {
  userId: string;
  entry?: JournalEntry;       // undefined = create mode
  onSuccess: () => void;
  onCancel?: () => void;
}

export function JournalEntryForm({ userId, entry, onSuccess, onCancel }: JournalEntryFormProps) {
  const { toast } = useToast();
  const isEditing = Boolean(entry);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<JournalFormValues>({
    resolver: zodResolver(journalFormSchema),
    defaultValues: {
      date: entry ? format(entry.date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
      content: entry?.content ?? '',
      mood: entry?.mood,
      tags: entry?.tags ?? [],
    },
  });

  const selectedMood = watch('mood');
  const selectedTags = watch('tags') ?? [];

  const toggleTag = (tag: JournalTag) => {
    const current = selectedTags as JournalTag[];
    if (current.includes(tag)) {
      setValue('tags', current.filter(t => t !== tag));
    } else {
      setValue('tags', [...current, tag]);
    }
  };

  const onSubmit = async (values: JournalFormValues) => {
    try {
      if (isEditing && entry) {
        await updateJournalEntry(entry.id, {
          date: new Date(values.date),
          content: values.content,
          mood: values.mood as MoodLevel | undefined,
          tags: (values.tags ?? []) as JournalTag[],
        });
        toast({ title: 'Entry updated', description: 'Your journal entry has been saved.' });
      } else {
        await createJournalEntry(userId, {
          date: new Date(values.date),
          content: values.content,
          mood: values.mood as MoodLevel | undefined,
          tags: (values.tags ?? []) as JournalTag[],
        });
        toast({ title: 'Entry saved', description: 'Your journal entry has been recorded.' });
      }
      onSuccess();
    } catch (err) {
      console.error('Error saving journal entry:', err);
      toast({
        title: 'Error',
        description: 'Failed to save your journal entry. Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Date */}
      <div className="space-y-1">
        <Label htmlFor="journal-date">Date</Label>
        <input
          id="journal-date"
          type="date"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          {...register('date')}
        />
        {errors.date && (
          <p className="text-xs text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Journal content */}
      <div className="space-y-1">
        <Label htmlFor="journal-content">Journal Entry</Label>
        <Textarea
          id="journal-content"
          placeholder="How are you feeling? What's on your mind? Note anything about your form, energy, challenges or wins..."
          className="min-h-[180px] resize-none"
          {...register('content')}
        />
        {errors.content && (
          <p className="text-xs text-destructive">{errors.content.message}</p>
        )}
      </div>

      {/* Mood */}
      <div className="space-y-2">
        <Label>Mood <span className="text-muted-foreground text-xs">(optional)</span></Label>
        <div className="flex flex-wrap gap-2">
          {MOOD_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('mood', selectedMood === opt.value ? undefined : opt.value)}
              className={cn(
                'rounded-full px-3 py-1 text-sm font-medium transition-all border-2',
                selectedMood === opt.value
                  ? `${opt.colour} border-transparent`
                  : 'border-border bg-muted text-muted-foreground hover:bg-accent'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags <span className="text-muted-foreground text-xs">(optional — select all that apply)</span></Label>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map(opt => {
            const active = (selectedTags as JournalTag[]).includes(opt.value);
            return (
              <Badge
                key={opt.value}
                variant={active ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer select-none transition-all',
                  active ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
                onClick={() => toggleTag(opt.value)}
              >
                {opt.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? 'Save Changes' : 'Save Entry'}
        </Button>
      </div>
    </form>
  );
}
