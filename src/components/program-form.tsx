'use client';
import { logger } from '@/lib/logger';

import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, PlusCircle, Trash2 } from 'lucide-react';
import type { Program } from '@/models/types';
import { createProgram, updateProgram } from '@/services/program-service-client';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from './ui/scroll-area';

// ─── Schemas ────────────────────────────────────────────────────────────────

const exerciseSchema = z.object({
  name: z.string().min(1, 'Exercise name is required.'),
  details: z.string().min(1, 'Exercise details are required.'),
  // Optional Garmin sync fields
  garminExerciseCategory: z.string().optional(),
  garminExerciseName: z.string().optional(),
  weightKg: z.coerce.number().positive().optional().or(z.literal('')),
  restSeconds: z.coerce.number().int().positive().optional().or(z.literal('')),
  sets: z.coerce.number().int().positive().optional().or(z.literal('')),
  reps: z.coerce.number().int().positive().optional().or(z.literal('')),
});

const runSchema = z.object({
  type: z.enum(['easy', 'tempo', 'intervals', 'long', 'recovery']),
  description: z.string().min(1, 'Run description is required.'),
  distance: z.coerce.number().min(0.1, 'Distance must be greater than 0.'),
  paceZone: z.enum(['recovery', 'easy', 'marathon', 'threshold', 'interval', 'repetition']),
  effortLevel: z.coerce.number().min(1).max(10),
});

// A single workout row; exercises XOR runs are required depending on programType.
// Using superRefine instead of discriminatedUnion for react-hook-form compatibility.
const workoutSchema = z.object({
  day: z.coerce.number().min(1, 'Day must be a positive number.'),
  title: z.string().min(1, 'Workout title is required.'),
  programType: z.enum(['hyrox', 'running']),
  exercises: z.array(exerciseSchema).default([]),
  runs: z.array(runSchema).default([]),
}).superRefine((data, ctx) => {
  if (data.programType === 'hyrox' && data.exercises.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['exercises'], message: 'At least one exercise is required.' });
  }
  if (data.programType === 'running' && data.runs.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['runs'], message: 'At least one run segment is required.' });
  }
});

const programSchema = z.object({
  name: z.string().min(1, 'Program name is required.'),
  description: z.string().min(1, 'Program description is required.'),
  programType: z.enum(['hyrox', 'running', 'hybrid']),
  workouts: z.array(workoutSchema).min(1, 'At least one workout is required.'),
});

type ProgramFormData = z.infer<typeof programSchema>;

// ─── Default values ──────────────────────────────────────────────────────────

const defaultHyroxWorkout = (day: number) => ({
  day,
  title: '',
  programType: 'hyrox' as const,
  exercises: [{ name: '', details: '' }],
  runs: [],
});

const defaultRunningWorkout = (day: number) => ({
  day,
  title: '',
  programType: 'running' as const,
  exercises: [],
  runs: [{ type: 'easy' as const, description: '', distance: 5, paceZone: 'easy' as const, effortLevel: 6 }],
});

function buildDefaultValues(program: Program | null): Partial<ProgramFormData> {
  if (!program) {
    return {
      name: '',
      description: '',
      programType: 'hyrox',
      workouts: [defaultHyroxWorkout(1)],
    };
  }

  const programType = program.programType ?? 'hyrox';
  return {
    name: program.name,
    description: program.description,
    programType,
    workouts: program.workouts.map(w => {
      // Infer per-workout form type from content: if it has runs (and no exercises) → 'running', else 'hyrox'
      const formType: 'hyrox' | 'running' = (w.runs?.length ?? 0) > 0 && !(w.exercises?.length ?? 0) ? 'running' : 'hyrox';
      return {
        day: w.day,
        title: w.title,
        programType: formType,
        exercises: w.exercises ?? [],
        runs: (w.runs ?? []).map(r => ({
          type: r.type,
          description: r.description,
          distance: r.distance,
          paceZone: r.paceZone,
          effortLevel: r.effortLevel,
        })),
      };
    }),
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface ProgramFormProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  program: Program | null;
  onSuccess: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ProgramForm({ isOpen, setIsOpen, program, onSuccess }: ProgramFormProps) {
  const { toast } = useToast();

  const form = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema),
    defaultValues: buildDefaultValues(program),
  });

  const { fields: workoutFields, append: appendWorkout, remove: removeWorkout, replace: replaceWorkouts } = useFieldArray({
    control: form.control,
    name: 'workouts',
  });

  // Watch the top-level programType so we can react to changes
  const programType = useWatch({ control: form.control, name: 'programType' });

  const handleProgramTypeChange = (value: 'hyrox' | 'running' | 'hybrid') => {
    form.setValue('programType', value);
    // Reset all workouts to a sensible default for the chosen program type
    replaceWorkouts([value === 'running' ? defaultRunningWorkout(1) : defaultHyroxWorkout(1)]);
  };

  const onSubmit = async (data: ProgramFormData) => {
    try {
      const programData: any = {
        name: data.name,
        description: data.description,
        programType: data.programType,
        workouts: data.workouts.map(w => ({
          day: w.day,
          title: w.title,
          exercises: w.exercises ?? [],
          runs: w.runs ?? [],
        })),
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
      logger.error('Failed to save program:', error);
      toast({ title: 'Error', description: 'Failed to save the program.', variant: 'destructive' });
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

                {/* Program name */}
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

                {/* Program description */}
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

                {/* Program type — changing this resets all workouts */}
                <FormField
                  control={form.control}
                  name="programType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Program Type</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => handleProgramTypeChange(v as 'hyrox' | 'running')}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hyrox">HYROX / Strength</SelectItem>
                          <SelectItem value="running">Running</SelectItem>
                          <SelectItem value="hybrid">Hybrid (Run + Strength)</SelectItem>
                        </SelectContent>
                      </Select>
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

                    {programType === 'running' ? (
                      <RunArray workoutIndex={workoutIndex} control={form.control} />
                    ) : (
                      <ExerciseArray workoutIndex={workoutIndex} control={form.control} />
                    )}
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendWorkout(
                    programType === 'running'
                      ? defaultRunningWorkout(workoutFields.length + 1)
                      : defaultHyroxWorkout(workoutFields.length + 1)
                  )}
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

// ─── Sub-components ──────────────────────────────────────────────────────────

function ExerciseArray({ workoutIndex, control }: { workoutIndex: number; control: any }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `workouts.${workoutIndex}.exercises`,
  });

  return (
    <div className="space-y-2 pl-4 border-l">
      <h5 className="font-medium text-sm">Exercises</h5>
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-2 pb-2 border-b last:border-0">
          <div className="flex items-end gap-2">
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
            <Button type="button" variant="ghost" size="icon" className="mb-2" onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <details className="group">
            <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground list-none flex items-center gap-1 select-none w-fit">
              <span className="transition-transform group-open:rotate-90">▶</span>
              Garmin sync fields (optional)
            </summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 pl-4">
              <FormField
                control={control}
                name={`workouts.${workoutIndex}.exercises.${index}.garminExerciseCategory`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Category</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. SQUAT" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`workouts.${workoutIndex}.exercises.${index}.garminExerciseName`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Exercise Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. BARBELL_SQUAT" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`workouts.${workoutIndex}.exercises.${index}.weightKg`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Weight (kg)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 80" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`workouts.${workoutIndex}.exercises.${index}.sets`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Sets</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 4" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`workouts.${workoutIndex}.exercises.${index}.reps`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Reps</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 8" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={control}
                name={`workouts.${workoutIndex}.exercises.${index}.restSeconds`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Rest (seconds)</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="e.g. 90" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>
          </details>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => append({ name: '', details: '' })}>
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Exercise
      </Button>
    </div>
  );
}

function RunArray({ workoutIndex, control }: { workoutIndex: number; control: any }) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `workouts.${workoutIndex}.runs`,
  });

  return (
    <div className="space-y-3 pl-4 border-l">
      <h5 className="font-medium text-sm">Run Segments</h5>
      {fields.map((field, index) => (
        <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 relative">
          <FormField
            control={control}
            name={`workouts.${workoutIndex}.runs.${index}.type`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Type</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {(['easy', 'tempo', 'intervals', 'long', 'recovery'] as const).map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`workouts.${workoutIndex}.runs.${index}.paceZone`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Pace Zone</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    {(['recovery', 'easy', 'marathon', 'threshold', 'interval', 'repetition'] as const).map(z => (
                      <SelectItem key={z} value={z} className="capitalize">{z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`workouts.${workoutIndex}.runs.${index}.distance`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Distance (km)</FormLabel>
                <FormControl><Input type="number" step="0.1" min="0.1" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`workouts.${workoutIndex}.runs.${index}.effortLevel`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Effort (1–10)</FormLabel>
                <FormControl><Input type="number" min="1" max="10" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name={`workouts.${workoutIndex}.runs.${index}.description`}
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel className="text-xs">Description</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., 3x1km at threshold with 90s rest" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="md:col-span-2 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4 text-destructive mr-1" /> Remove
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => append({ type: 'easy', description: '', distance: 5, paceZone: 'easy', effortLevel: 6 })}
      >
        <PlusCircle className="mr-2 h-4 w-4" />
        Add Run Segment
      </Button>
    </div>
  );
}
