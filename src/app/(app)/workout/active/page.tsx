'use client';

import { useEffect, useState, useMemo, lazy, Suspense, useCallback } from 'react';
import { Flag, Loader2, CalendarDays, AlertTriangle, Timer, X, Share2, Sparkles, Clock, Link as LinkIcon, CheckSquare, Square, WifiOff } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { workoutSummary } from '@/ai/flows/workout-summary';
import { extendWorkout } from '@/ai/flows/extend-workout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { updateWorkoutSession, type WorkoutSession } from '@/services/session-service-client';
import type { Workout, RunningWorkout, Exercise, PlannedRun } from '@/models/types';
import { formatPace } from '@/lib/pace-utils';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { LinkStravaActivityDialog } from '@/components/link-strava-activity-dialog';
import { useUser } from '@/contexts/user-context';
import { useToast } from '@/hooks/use-toast';
import { isRunningWorkout } from '@/lib/type-guards';
import { ExerciseHistory } from '@/components/exercise-history';
import { convertDistanceInText, convertTextWithUnits } from '@/lib/unit-conversion';
import { WorkoutTimer } from '@/components/workout-timer';

// Lazy load the modal component
const WorkoutCompleteModal = lazy(() => import('@/components/workout-complete-modal'));

export default function ActiveWorkoutPage() {
  const { user, todaysWorkout, todaysSession, trainingPaces, loading, refreshData } = useUser();
  const { toast } = useToast();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [workoutInfo, setWorkoutInfo] = useState<{ day: number; workout: Workout | RunningWorkout | null } | null>(null);
  const [extendedExercises, setExtendedExercises] = useState<Exercise[]>([]);
  const [isExtending, setIsExtending] = useState(false);
  const [notes, setNotes] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isLinkerOpen, setIsLinkerOpen] = useState(false);
  const [exerciseChecklist, setExerciseChecklist] = useState<Record<string, boolean>>({});
  const [isOnline, setIsOnline] = useState(true);
  const [showTimer, setShowTimer] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync context state to local state
  useEffect(() => {
      if (!loading) {
          setWorkoutInfo(todaysWorkout);
          setSession(todaysSession);
          if (todaysSession) {
             setNotes(todaysSession.notes || '');
             setExerciseChecklist(todaysSession.exerciseChecklist || {});
             if (!['one-off-ai', 'custom-workout'].includes(todaysSession.programId)) {
                  setExtendedExercises(todaysSession.extendedExercises || []);
             }
          }
      }
  }, [todaysWorkout, todaysSession, loading]);


  const loadWorkoutSummary = async () => {
    if (!user || !workoutInfo?.workout || summaryText || summaryLoading) return;

    setSummaryLoading(true);

    try {
      let exercisesForSummary = '';
      if (isRunningWorkout(workoutInfo.workout)) {
          exercisesForSummary = (workoutInfo.workout as RunningWorkout).runs.map(r => r.type).join(', ');
      } else {
          exercisesForSummary = [...(workoutInfo.workout as Workout).exercises, ...extendedExercises].map(e => e.name).join(', ');
      }

      const summaryPromise = workoutSummary({
        userName: user.firstName,
        workoutTitle: workoutInfo.workout.title,
        exercises: exercisesForSummary,
      });

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('AI summary timeout')), 15000)
      );

      const summaryResult = await Promise.race([summaryPromise, timeoutPromise]) as any;
      setSummaryText(summaryResult.summary);
    } catch (error) {
      console.error("Failed to generate AI workout summary:", error);
      setSummaryText(workoutInfo?.workout?.title ?? '');
    } finally {
      setSummaryLoading(false);
    }
  };


  useEffect(() => {
    if (user && workoutInfo && session && !loading) {
      const timer = setTimeout(() => {
        loadWorkoutSummary();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [user, workoutInfo, session, loading]);

  const debouncedSaveNotes = useDebouncedCallback(async (value: string) => {
    if (!session) return;
    await updateWorkoutSession(session.id, { notes: value });
  }, 1500);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    debouncedSaveNotes(e.target.value);
  };

  const debouncedSaveChecklist = useDebouncedCallback(async (checklist: Record<string, boolean>) => {
    if (!session) return;
    await updateWorkoutSession(session.id, { exerciseChecklist: checklist });
  }, 800);

  const handleToggleExercise = (key: string) => {
    if (session?.finishedAt) return;
    const updated = { ...exerciseChecklist, [key]: !exerciseChecklist[key] };
    setExerciseChecklist(updated);
    debouncedSaveChecklist(updated);
  };

  const handleExtendWorkout = async () => {
    if (!workoutInfo?.workout) return;

    setIsExtending(true);
    try {
        let originalExercises: Exercise[] = [];
        if (!isRunningWorkout(workoutInfo.workout)) {
            originalExercises = (workoutInfo.workout as Workout).exercises || [];
        }

        const result = await extendWorkout({
            workoutTitle: workoutInfo.workout.title,
            workoutType: workoutInfo.workout.programType,
            exercises: JSON.stringify([...originalExercises, ...extendedExercises]),
        });

        const newExercises = result.newExercises;
        const allExtended = [...extendedExercises, ...newExercises];
        setExtendedExercises(allExtended);

        if (session) {
            await updateWorkoutSession(session.id, { extendedExercises: allExtended });
        }

    } catch (error) {
        console.error("Failed to extend workout:", error);
        toast({ title: 'Could not extend workout', description: 'AI extension failed. Please try again.', variant: 'destructive' });
    } finally {
        setIsExtending(false);
    }
  };

  const handleFinishWorkout = async () => {
      if(!session || !workoutInfo?.workout) return;
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
      refreshData();
  }

  const handleSkipWorkout = async () => {
      if(!session || !workoutInfo?.workout) return;
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
      refreshData();
  }

  const handleLinkSuccess = async () => {
    setIsLinkerOpen(false);
    await refreshData();
    setIsCompleteModalOpen(true);
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

  const isRunning = isRunningWorkout(workout);
  const isOneOffWorkout = ['one-off-ai', 'custom-workout'].includes(session.programId);
  const canExtendWorkout = workout.programType === 'hyrox' || isOneOffWorkout;

  // Progress calculation
  const allExerciseKeys: string[] = isRunning
    ? (workout as RunningWorkout).runs.map((_, i) => `run-${i}`)
    : [
        ...(workout as Workout).exercises.map((_, i) => `ex-${i}`),
        ...extendedExercises.map((_, i) => `ext-${i}`),
      ];
  const checkedCount = allExerciseKeys.filter(k => exerciseChecklist[k]).length;
  const totalCount = allExerciseKeys.length;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;


  return (
    <>
    <div className="space-y-6 max-w-2xl mx-auto">
        {!isOnline && (
          <div className="flex items-center gap-2 rounded-md border border-yellow-400 bg-yellow-50 px-4 py-2 text-sm text-yellow-800">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>You&apos;re offline — your progress is saved locally and will sync when reconnected.</span>
          </div>
        )}
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
                                {workout.title}
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

                {isRunning && !trainingPaces && (
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

                <Button
                    variant="secondary"
                    className="w-full"
                    onClick={() => setShowTimer((prev) => !prev)}
                >
                    <Timer className="mr-2" />
                    {showTimer ? 'Hide Timer' : 'Use the Timer'}
                </Button>

                {showTimer && (
                    <div className="rounded-lg border border-border bg-muted/20 p-4">
                        <WorkoutTimer />
                    </div>
                )}

                {!session.finishedAt && totalCount > 0 && (
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{checkedCount} / {totalCount} completed</span>
                            <span>{progressPct}%</span>
                        </div>
                        <Progress value={progressPct} className="h-2" />
                    </div>
                )}

                <div>
                    <h3 className="text-base font-semibold mb-3">{isRunning ? 'Runs:' : 'Exercises:'}</h3>
                    <div className="space-y-3">
                        {isRunning ? (
                             (workout as RunningWorkout).runs.map((run: PlannedRun, index) => {
                                 const key = `run-${index}`;
                                 const isDone = !!exerciseChecklist[key];
                                 const description = user?.unitSystem === 'imperial'
                                    ? convertDistanceInText(run.description, 'imperial')
                                    : run.description;

                                 return (
                                    <Card key={`${run.description}-${index}`} className={isDone ? 'opacity-60' : ''}>
                                        <CardContent className="py-4 px-2 flex items-center gap-4">
                                            {!session.finishedAt && (
                                                <button
                                                    onClick={() => handleToggleExercise(key)}
                                                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                                    aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    {isDone
                                                        ? <CheckSquare className="h-6 w-6 text-primary" />
                                                        : <Square className="h-6 w-6" />
                                                    }
                                                </button>
                                            )}
                                            <div className="flex-1">
                                                <p className={`font-semibold ${isDone ? 'line-through text-muted-foreground' : ''}`}>{description}</p>
                                                {trainingPaces && (
                                                    <p className="text-sm text-muted-foreground">
                                                        Target Pace: <span className="font-semibold text-primary">{formatPace(trainingPaces[run.paceZone])}</span> / km
                                                    </p>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                 );
                             })
                        ) : (
                             (workout as Workout).exercises.map((ex: Exercise, index) => {
                                 const key = `ex-${index}`;
                                 const isDone = !!exerciseChecklist[key];
                                 const details = user?.unitSystem ? convertTextWithUnits(ex.details, user.unitSystem) : ex.details;
                                 return (
                                    <Card key={`${ex.name}-${index}`} className={isDone ? 'opacity-60' : ''}>
                                        <CardContent className="py-4 px-2 flex items-center gap-4">
                                            {!session.finishedAt && (
                                                <button
                                                    onClick={() => handleToggleExercise(key)}
                                                    className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                                    aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                                                >
                                                    {isDone
                                                        ? <CheckSquare className="h-6 w-6 text-primary" />
                                                        : <Square className="h-6 w-6" />
                                                    }
                                                </button>
                                            )}
                                            <div className="flex-1">
                                                <p className={`font-semibold ${isDone ? 'line-through text-muted-foreground' : ''}`}>{ex.name}</p>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{details}</p>
                                                {user && <ExerciseHistory userId={user.id} exerciseName={ex.name} />}
                                            </div>
                                        </CardContent>
                                    </Card>
                                 );
                            })
                        )}

                        {extendedExercises.length > 0 && (
                            <>
                                <Separator />
                                <h3 className="text-base font-semibold !mt-6">Workout Extension:</h3>
                            </>
                        )}

                        {extendedExercises.map((item, index) => {
                            const key = `ext-${index}`;
                            const isDone = !!exerciseChecklist[key];
                            const details = user?.unitSystem ? convertTextWithUnits(item.details, user.unitSystem) : item.details;
                            return (
                                <Card key={`${item.name}-${index}`} className={`border-dashed border-primary/50 ${isDone ? 'opacity-60' : ''}`}>
                                    <CardContent className="py-4 px-2 flex items-center gap-4">
                                        {!session.finishedAt && (
                                            <button
                                                onClick={() => handleToggleExercise(key)}
                                                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                                                aria-label={isDone ? 'Mark incomplete' : 'Mark complete'}
                                            >
                                                {isDone
                                                    ? <CheckSquare className="h-6 w-6 text-primary" />
                                                    : <Square className="h-6 w-6" />
                                                }
                                            </button>
                                        )}
                                        <div className="flex-1">
                                            <p className={`font-semibold ${isDone ? 'line-through text-muted-foreground' : ''}`}>{item.name}</p>
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{details}</p>
                                            {user && <ExerciseHistory userId={user.id} exerciseName={item.name} />}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>

                 {canExtendWorkout && !session.finishedAt && (
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
