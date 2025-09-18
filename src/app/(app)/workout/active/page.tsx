// src/app/workout/active/page.tsx
'use client';

import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Flag, Loader2, CalendarDays, AlertTriangle, Timer, X, Share2, Sparkles, Clock, Link as LinkIcon } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { workoutSummary } from '@/ai/flows/workout-summary';
import { extendWorkout } from '@/ai/flows/extend-workout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getWorkoutForDay } from '@/lib/workout-utils';
import { getTodaysOneOffSession, getOrCreateWorkoutSession, updateWorkoutSession, type WorkoutSession } from '@/services/session-service-client';
import type { Workout, RunningWorkout, User, Exercise } from '@/models/types';
import { calculateTrainingPaces, formatPace } from '@/lib/pace-utils';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { LinkStravaActivityDialog } from '@/components/link-strava-activity-dialog';

// Lazy load the modal component
const WorkoutCompleteModal = lazy(() => import('@/components/workout-complete-modal'));

export default function ActiveWorkoutPage() {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [workoutInfo, setWorkoutInfo] = useState<{ day: number, workout: Workout | RunningWorkout | null } | null>(null);
  const [extendedExercises, setExtendedExercises] = useState<Exercise[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [trainingPaces, setTrainingPaces] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExtending, setIsExtending] = useState(false);
  const [notes, setNotes] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isLinkerOpen, setIsLinkerOpen] = useState(false);
  
  const today = useMemo(() => {
      const d = new Date();
      d.setHours(0,0,0,0);
      return d;
  }, []);

  const fetchWorkoutData = async (firebaseUser: any) => {
    const currentUser = await getUserClient(firebaseUser.uid);
    setUser(currentUser);

    if (currentUser) {
        if (currentUser.runningProfile) {
            const paces = calculateTrainingPaces(currentUser);
            setTrainingPaces(paces);
        }

        let workoutSession;
        let currentWorkoutInfo;

        // First, check for a one-off or custom workout for today
        const oneOffSession = await getTodaysOneOffSession(firebaseUser.uid, today);

        if (oneOffSession) {
            workoutSession = oneOffSession;
            // Reconstruct a temporary workout object for display from the session data
            currentWorkoutInfo = {
                day: 0,
                workout: {
                    title: oneOffSession.workoutTitle,
                    programType: oneOffSession.programType,
                    day: 0,
                    exercises: oneOffSession.extendedExercises || [], 
                    runs: [] // Custom/AI runs not supported yet
                } as Workout
            };
            setExtendedExercises([]); 
        } else if (currentUser.programId && currentUser.startDate) {
            // If no one-off workout, look for a scheduled program workout
            const program = await getProgramClient(currentUser.programId);
            if (program) {
                currentWorkoutInfo = getWorkoutForDay(program, currentUser.startDate, today);
                if (currentWorkoutInfo.workout) {
                   workoutSession = await getOrCreateWorkoutSession(firebaseUser.uid, program.id, today, currentWorkoutInfo.workout);
                }
            }
        }
        
        setWorkoutInfo(currentWorkoutInfo);

        if (workoutSession) {
            setSession(workoutSession);
            setNotes(workoutSession.notes || '');
            // Only set extended exercises if it's NOT a one-off/custom workout
            if (!['one-off-ai', 'custom-workout'].includes(workoutSession.programId)) {
                 setExtendedExercises(workoutSession.extendedExercises || []);
            }

        }
        // Note: AI summary will be loaded separately to improve initial page load speed
    }
  };

  const loadWorkoutSummary = async (currentUser: User, workoutInfo: { workout: Workout | RunningWorkout }, session: WorkoutSession) => {
    if (!workoutInfo?.workout || summaryText) return; // Don't reload if already loaded

    // Show that we're enhancing the summary
    setSummaryLoading(true);

    try {
      const exercisesForSummary = workoutInfo.workout.programType === 'running'
        ? (workoutInfo.workout as RunningWorkout).runs.map(r => r.type).join(', ')
        : [...(workoutInfo.workout as Workout).exercises, ...(session.extendedExercises || [])].map(e => e.name).join(', ');

      // Add a timeout to prevent the AI call from hanging indefinitely
      const summaryPromise = workoutSummary({
        userName: currentUser.firstName,
        workoutTitle: workoutInfo.workout.title,
        exercises: exercisesForSummary,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI summary timeout')), 10000) // 10 second timeout
      );

      const summaryResult = await Promise.race([summaryPromise, timeoutPromise]) as any;
      setSummaryText(summaryResult.summary);
    } catch (error) {
      console.error("Failed to generate AI workout summary:", error);
      // Silently fall back - the UI will continue showing the workout title
      // which is already visible, so no jarring experience for the user
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
        setLoading(true);
        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
           await fetchWorkoutData(firebaseUser);
        }
        setLoading(false);
        });
        return unsubscribe;
    };
    
    let unsubscribe: () => void;
    initialize().then(unsub => unsubscribe = unsub);

    return () => {
        if (unsubscribe) {
            unsubscribe();
        }
    };
  }, [today]);

  // Separate effect to load AI summary after main data is ready (lazy loading)
  useEffect(() => {
    if (user && workoutInfo && session && !loading) {
      // Add a small delay to ensure the UI renders first
      const timer = setTimeout(() => {
        loadWorkoutSummary(user, workoutInfo, session);
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [user, workoutInfo, session, loading, summaryText]);

  const debouncedSaveNotes = useDebouncedCallback(async (value: string) => {
    if (!session) return;
    await updateWorkoutSession(session.id, { notes: value });
  }, 1500); // Save 1.5 seconds after user stops typing

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    debouncedSaveNotes(e.target.value);
  };

  const handleToggleItem = async (itemName: string, completed: boolean) => {
    if (!session) return;
    const updatedCompleted = { ...session.completedItems, [itemName]: completed };
    const updatedSession = { ...session, completedItems: updatedCompleted };
    setSession(updatedSession);
    await updateWorkoutSession(session.id, { completedItems: updatedCompleted });
  };

  const handleExtendWorkout = async () => {
    if (!workoutInfo?.workout) return;

    setIsExtending(true);
    try {
        const originalExercises = (workoutInfo.workout as Workout).exercises || [];
        const result = await extendWorkout({
            workoutTitle: workoutInfo.workout.title,
            workoutType: workoutInfo.workout.programType,
            exercises: JSON.stringify([...originalExercises, ...extendedExercises]),
        });

        const newExercises = result.newExercises;
        const allExtended = [...extendedExercises, ...newExercises];
        setExtendedExercises(allExtended);

        // Update the session in Firestore with the new exercises
        if (session) {
            await updateWorkoutSession(session.id, { extendedExercises: allExtended });
        }

    } catch (error) {
        console.error("Failed to extend workout:", error);
    } finally {
        setIsExtending(false);
    }
  };
  
  const handleFinishWorkout = async () => {
      if(!session || !workoutInfo?.workout) return;
      // Final save of notes before finishing
      debouncedSaveNotes.flush();
      const finishedAt = new Date();
      const updatedSessionData = {
          ...session,
          finishedAt,
          notes,
          workoutTitle: workoutInfo.workout.title,
          programType: workoutInfo.workout.programType
      };
      setSession(updatedSessionData);
      await updateWorkoutSession(session.id, {
          finishedAt,
          notes,
          workoutTitle: workoutInfo.workout.title,
          programType: workoutInfo.workout.programType
      });
      setIsCompleteModalOpen(true);
  }

  const handleSkipWorkout = async () => {
      if(!session || !workoutInfo?.workout) return;
      // Final save of notes before skipping
      debouncedSaveNotes.flush();
      const finishedAt = new Date();
      const skipNotes = notes ? `${notes}\n\n[WORKOUT SKIPPED]` : '[WORKOUT SKIPPED]';
      const updatedSessionData = {
          ...session,
          finishedAt,
          notes: skipNotes,
          workoutTitle: workoutInfo.workout.title,
          programType: workoutInfo.workout.programType,
          skipped: true
      };
      setSession(updatedSessionData);
      await updateWorkoutSession(session.id, {
          finishedAt,
          notes: skipNotes,
          workoutTitle: workoutInfo.workout.title,
          programType: workoutInfo.workout.programType,
          skipped: true
      });
      setIsCompleteModalOpen(true);
  }

  const handleLinkSuccess = async () => {
    setIsLinkerOpen(false);
    setLoading(true);
    const auth = await getAuthInstance();
    if (auth.currentUser) {
        await fetchWorkoutData(auth.currentUser);
    }
    setLoading(false);
    setIsCompleteModalOpen(true); // Show completion modal after successful link
  };


  if (loading) {
    return (
        <div className="space-y-4 max-w-2xl mx-auto">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
        </div>
    );
  }
  
  if (!workoutInfo?.workout || !session) {
      return (
          <div className="text-center max-w-2xl mx-auto">
            <Card>
                <CardHeader>
                    <CardTitle>No Workout Today</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Enjoy your rest day or check your program schedule.</p>
                </CardContent>
            </Card>
          </div>
      )
  }

  const { workout, day } = workoutInfo;
  const week = Math.ceil(day / 7);
  const dayOfWeek = day % 7 === 0 ? 7 : day % 7;

  const originalWorkoutItems = workout.programType === 'running' 
    ? (workout as RunningWorkout).runs 
    : (workout as Workout).exercises;
  
  const isRunningProgram = workout.programType === 'running';
  const isOneOffWorkout = ['one-off-ai', 'custom-workout'].includes(session.programId);

  return (
    <>
    <div className="space-y-6 max-w-2xl mx-auto">
        <Card className="bg-accent/20 border-accent">
            <CardHeader>
                <div className="flex-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">{workout.title}</CardTitle>
                    <CardDescription className="font-medium text-foreground/80">
                        {summaryLoading ? (
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-full" />
                                <Skeleton className="h-4 w-3/4" />
                            </div>
                        ) : summaryText ? (
                            <div className="relative">
                                {summaryText}
                            </div>
                        ) : (
                            <div className="relative">
                                {workoutInfo.workout.title}
                                <span className="text-xs text-muted-foreground/60 ml-2">⏳ Enhancing...</span>
                            </div>
                        )}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    {!isOneOffWorkout && (
                        <div className="flex items-center gap-2">
                            <CalendarDays className="h-4 w-4" />
                            <span>Week {week}, Day {dayOfWeek}</span>
                        </div>
                    )}
                    {isOneOffWorkout && session.duration && (
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>{session.duration}</span>
                        </div>
                    )}
                </div>
                
                {isRunningProgram && !trainingPaces && (
                    <div className="p-4 border border-yellow-400 bg-yellow-50 rounded-md text-yellow-800 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 mt-0.5" />
                        <div>
                            <h4 className="font-semibold">Paces Not Calculated</h4>
                            <p className="text-sm">To see your personalized training paces, please add at least one benchmark race time to your profile.</p>
                            <Button variant="link" className="p-0 h-auto mt-1 text-sm text-yellow-800" asChild>
                            <Link href="/profile">Update Your Profile</Link>
                            </Button>
                        </div>
                    </div>
                )}

                <Button asChild variant="secondary" className="w-full">
                    <Link href="https://timer.hybridx.club/" target="_blank">
                        <Timer className="mr-2" />
                        Use the Timer
                    </Link>
                </Button>
                
                <div>
                    <h3 className="text-base font-semibold mb-3">{isRunningProgram ? 'Runs:' : 'Exercises:'}</h3>
                    <div className="space-y-3">
                        {originalWorkoutItems.map((item, index) => {
                            const key = isRunningProgram ? (item as any).description : (item as any).name;
                            return (
                                <Card key={`${key}-${index}`} className="has-[[data-state=checked]]:bg-muted/50 transition-colors">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="flex-1">
                                            {isRunningProgram ? (
                                                <>
                                                    <p className="font-semibold">{(item as any).description}</p>
                                                    {trainingPaces && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Target Pace: <span className="font-semibold text-primary">{formatPace(trainingPaces[(item as any).paceZone])}</span> / km
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <p className="font-semibold">{(item as any).name}</p>
                                                    <p className="text-sm text-muted-foreground">{(item as any).details}</p>
                                                </>
                                            )}
                                        </div>
                                        <Checkbox
                                            id={key}
                                            checked={!!session.completedItems?.[key]}
                                            onCheckedChange={(checked) => handleToggleItem(key, !!checked)}
                                            className="h-6 w-6"
                                            disabled={!!session.finishedAt}
                                            aria-label={`Mark ${key} as complete`}
                                        />
                                    </CardContent>
                                </Card>
                            );
                        })}
                        
                        {extendedExercises.length > 0 && (
                            <>
                                <Separator />
                                <h3 className="text-base font-semibold !mt-6">Workout Extension:</h3>
                            </>
                        )}
                        
                        {extendedExercises.map((item, index) => {
                            const key = (item as any).name;
                            return (
                                <Card key={`${key}-${index}`} className="has-[[data-state=checked]]:bg-muted/50 transition-colors border-dashed border-primary/50">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="flex-1">
                                            <p className="font-semibold">{(item as any).name}</p>
                                            <p className="text-sm text-muted-foreground">{(item as any).details}</p>
                                        </div>
                                        <Checkbox
                                            id={key}
                                            checked={!!session.completedItems?.[key]}
                                            onCheckedChange={(checked) => handleToggleItem(key, !!checked)}
                                            className="h-6 w-6"
                                            disabled={!!session.finishedAt}
                                            aria-label={`Mark ${key} as complete`}
                                        />
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                 {!isRunningProgram && !session.finishedAt && (
                    <div className="pt-2">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={handleExtendWorkout}
                            disabled={isExtending}
                        >
                            {isExtending ? (
                                <Loader2 className="mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="mr-2 text-yellow-400" />
                            )}
                            {isExtending ? 'Generating...' : 'Extend Workout with AI'}
                        </Button>
                    </div>
                 )}


                <div className="space-y-2">
                    <Label htmlFor="workout-notes" className="text-base font-semibold">Workout Notes</Label>
                    <Textarea
                        id="workout-notes"
                        placeholder="How did the workout feel? Any PRs? Aches or pains?"
                        value={notes}
                        onChange={handleNotesChange}
                        disabled={!!session.finishedAt}
                        rows={4}
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                    {!session.finishedAt ? (
                        <>
                        <Button className="w-full" onClick={handleFinishWorkout}>
                            <Flag className="mr-2" />
                            Finish Workout
                        </Button>
                        <Button variant="outline" className="w-full" onClick={() => setIsLinkerOpen(true)}>
                            <LinkIcon className="mr-2" />
                            Link Strava Activity
                        </Button>
                        <Button variant="outline" className="w-full" onClick={handleSkipWorkout}>
                            <X className="mr-2" />
                            Skip Workout
                        </Button>
                        </>
                    ) : (
                        <Button className="w-full" variant="secondary" onClick={() => setIsCompleteModalOpen(true)}>
                            <Share2 className="mr-2" />
                            Share Workout
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    </div>

    {session && workout && (
        <>
        {session.finishedAt && (
             <Suspense fallback={
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                </div>
            }>
                <WorkoutCompleteModal
                    isOpen={isCompleteModalOpen}
                    onClose={() => setIsCompleteModalOpen(false)}
                    session={session}
                    userHasStrava={!!user?.strava?.accessToken}
                    workout={workout}
                />
            </Suspense>
        )}
        <LinkStravaActivityDialog
            isOpen={isLinkerOpen}
            setIsOpen={setIsLinkerOpen}
            session={session}
            onLinkSuccess={handleLinkSuccess}
        />
        </>
    )}
    </>
  );
}
