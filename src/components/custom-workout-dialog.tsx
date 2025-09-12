'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createCustomWorkoutSession } from '@/services/session-service-client';
import type { ProgramType } from '@/models/types';

const customWorkoutSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters.'),
  type: z.enum(['hyrox', 'running']),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  duration: z.string().optional(),
});

type CustomWorkoutFormData = z.infer<typeof customWorkoutSchema>;

interface CustomWorkoutDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userId: string;
}

export function CustomWorkoutDialog({ isOpen, setIsOpen, userId }: CustomWorkoutDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<CustomWorkoutFormData>({
    resolver: zodResolver(customWorkoutSchema),
    defaultValues: {
      title: '',
      type: 'hyrox',
      description: '',
      duration: '',
    },
  });

  const onSubmit = async (data: CustomWorkoutFormData) => {
    setIsSubmitting(true);
    toast({ title: 'Logging your custom workout...' });
    try {
      await createCustomWorkoutSession(
        userId,
        data.title,
        data.type as ProgramType,
        data.description,
        data.duration
      );
      toast({ title: 'Workout Logged!', description: 'Redirecting you to start your session.' });
      setIsOpen(false);
      form.reset();
      router.push('/workout/active');
    } catch (error) {
      console.error('Failed to create custom workout:', error);
      toast({
        title: 'Error',
        description: 'Could not log your custom workout. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log a Custom Workout</DialogTitle>
          <DialogDescription>
            Record an activity that's not part of your program. It will be added to your calendar for today.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workout Title</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Evening Run, Full Body Gym Session" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <div className="grid grid-cols-2 gap-4">
                 <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Workout Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                            <SelectTrigger>
                            <SelectValue placeholder="Select a workout type" />
                            </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                            <SelectItem value="hyrox">Hybrid / Strength</SelectItem>
                            <SelectItem value="running">Running</SelectItem>
                        </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Duration (Optional)</FormLabel>
                        <FormControl>
                            <Input placeholder="e.g., 45 mins" {...field} />
                        </FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
             </div>
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description & Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the exercises, distances, times, or any notes about your workout."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log and Start Workout
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
