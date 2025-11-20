'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm } from 'react-hook-form';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import type { Program, Workout, RunningWorkout } from '@/models/types';
import { createProgram, updateProgram } from '@/services/program-service-client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

const exerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required.'),
  details: z.string().min(1, 'Exercise details are required.'),
});

// TODO: Add support for RunningWorkout fields in the form (runs array)
// Currently this form assumes all workouts are 'hyrox' type (Workout interface)
const workoutSchema = z.object({
  day: z.coerce.number().min(1, 'Day must be a positive number.'),
  title: z.string().min(1, 'Workout title is required.'),
  programType: z.literal('hyrox').default('hyrox'),
  exercises: z.array(exerciseSchema).min(1, 'At least one exercise is required.'),
});

const programSchema = z.object({
  name: z.string().min(1, 'Program name is required.'),
  description: z.string().min(1, 'Program description is required.'),
  programType: z.literal('hyrox').default('hyrox'),
  workouts: z.array(workoutSchema).min(1, 'At least one workout is required.'),
});

type ProgramFormData = z.infer<typeof programSchema>;

interface ProgramFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  program: Program | null;
  onSuccess: () => void;
}

export function ProgramForm({ isOpen, setIsOpen, program, onSuccess }: ProgramFormProps) {
  const { toast } = useToast();
  
  // Transform existing program data to match the form schema if needed
  // Specifically handling the discriminated union for workouts
  const defaultValues: Partial<ProgramFormData> = program
    ? {
        name: program.name,
        description: program.description,
        // Ensure programType is 'hyrox' for now as the form doesn't support running programs yet
        programType: 'hyrox', 
        workouts: program.workouts.map(w => {
            if (w.programType === 'running') {
                // Fallback or placeholder for running workouts if we open an existing running program
                // Ideally, the form should be updated to handle running workouts too
                return {
                    day: w.day,
                    title: w.title,
                    programType: 'hyrox',
                    exercises: [{ name: 'Running Workout', details: 'Please update details' }]
                };
            }
            return {
                day: w.day,
                title: w.title,
                programType: 'hyrox',
                exercises: (w as Workout).exercises || []
            };
        }),
      }
    : {
        name: '',
        description: '',
        programType: 'hyrox',
        workouts: [{ day: 1, title: '', programType: 'hyrox', exercises: [{ name: '', details: '' }] }],
      };

  const form = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema),
    defaultValues: defaultValues,
  });
  
  const { fields: workoutFields, append: appendWorkout, remove: removeWorkout } = useFieldArray({
    control: form.control,
    name: 'workouts',
  });

  const onSubmit = async (data: ProgramFormData) => {
    try {
      // Cast the data to satisfy the Program type requirement
      // The form currently only produces hyrox workouts which match the Workout interface
      const programData: any = {
          ...data,
          programType: 'hyrox' as const, // Enforce program type
      };

      if (program) {
        await updateProgram(program.id, programData);
        toast({ title: 'Success', description: 'Program updated successfully.' });
      } else {
        await createProgram(programData);
        toast({ title: 'Success', description: 'Program created successfully.' });
      }
      onSuccess();
      form.reset();
    } catch (error) {
      console.error('Failed to save program:', error);
      toast({
        title: 'Error',
        description: 'Failed to save the program.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{program ? 'Edit Program' : 'Add New Program'}</DialogTitle>
          <DialogDescription>
            {program ? 'Update the details of the training program.' : 'Fill in the details for the new training program.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <ScrollArea className="h-[60vh] pr-6">
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Intermediate Hybrid - 4 Days/Week" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea placeholder="A brief description of the program." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <h3 className="text-lg font-semibold pt-4">Workouts</h3>
                
                {workoutFields.map((workout, workoutIndex) => (
                  <div key={workout.id} className="space-y-3 rounded-md border p-4">
                    <div className="flex items-center justify-between">
                       <h4 className="font-medium">Workout {workoutIndex + 1}</h4>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => removeWorkout(workoutIndex)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                        control={form.control}
                        name={`workouts.${workoutIndex}.day`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Day</FormLabel>
                            <FormControl>
                                <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                        <FormField
                        control={form.control}
                        name={`workouts.${workoutIndex}.title`}
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                                <Input placeholder="e.g., Full Body Strength" {...field} />
                            </FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                    </div>

                    <ExerciseArray workoutIndex={workoutIndex} control={form.control} />
                  </div>
                ))}

                 <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendWorkout({ day: workoutFields.length + 1, title: '', programType: 'hyrox', exercises: [{ name: '', details: '' }] })}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Workout
                </Button>
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {program ? 'Save Changes' : 'Create Program'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function ExerciseArray({ workoutIndex, control }: { workoutIndex: number; control: any }) {
    const { fields, append, remove } = useFieldArray({
      control,
      name: `workouts.${workoutIndex}.exercises`,
    });
  
    return (
      <div className="space-y-2 pl-4 border-l">
        <h5 className="font-medium text-sm">Exercises</h5>
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-end gap-2">
            <FormField
              control={control}
              name={`workouts.${workoutIndex}.exercises.${index}.name`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-xs">Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Back Squat" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`workouts.${workoutIndex}.exercises.${index}.details`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="text-xs">Details</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 5x5 reps" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="mb-2"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => append({ name: '', details: '' })}
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Exercise
        </Button>
      </div>
    );
  }
