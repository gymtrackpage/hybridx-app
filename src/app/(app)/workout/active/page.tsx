// src/app/(app)/workout/active/page.tsx
'use client';

import { useEffect, useState, useMemo, lazy, Suspense } from 'react';
import { Flag, Loader2, CalendarDays, AlertTriangle, Timer, X, Share2, Sparkles, Clock, Link as LinkIcon } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { workoutSummary } from '@/ai/flows/workout-summary';
import { extendWorkout } from '@/ai/flows/extend-workout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { isRunningWorkout, isRunningProgram as isRunningProgramGuard } from '@/lib/type-guards';
import { ExerciseHistory } from '@/components/exercise-history';
import { convertDistanceInText, convertTextWithUnits } from '@/lib/unit-conversion';

// Lazy load the modal component
const WorkoutCompleteModal = lazy(() => import('@/components/workout-complete-modal'));

export default function ActiveWorkoutPage() {
  const { user, todaysWorkout, todaysSession, trainingPaces, loading, refreshData } = useUser();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [workoutInfo, setWorkoutInfo] = useState<{ day: number, workout: Workout | RunningWorkout | null } | null>(null);
  const [extendedExercises, setExtendedExercises] = useState<Exercise[]>([]);
  const [isExtending, setIsExtending] = useState(false);
  const [notes, setNotes] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isLinkerOpen, setIsLinkerOpen] = useState(false);
  
  // Sync context state to local state
  useEffect(() => {
      if (!loading) {
          setWorkoutInfo(todaysWorkout);
          setSession(todaysSession);
          if (todaysSession) {
             setNotes(todaysSession.notes || '');
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
        setTimeout(() => reject(new Error('AI summary timeout')), 10000)
      );

      const summaryResult = await Promise.race([summaryPromise, timeoutPromise]) as any;
      setSummaryText(summaryResult.summary);
    } catch (error) {
      console.error("Failed to generate AI workout summary:", error);
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
  }, [user, workoutInfo, session, loading]); // Remove summaryText dependency to prevent loops, checks internal state

  const debouncedSaveNotes = useDebouncedCallback(async (value: string) => {
    if (!session) return;
    await updateWorkoutSession(session.id, { notes: value });
  }, 1500);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setNotes(e.target.value);
    debouncedSaveNotes(e.target.value);
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

                <Button asChild variant="secondary" className="w-full">
                    <Link href="https://timer.hybridx.club/" target="_blank">
                        <Timer className="mr-2" />
                        Use the Timer
                    </Link>
                </Button>
                
                <div>
                    <h3 className="text-base font-semibold mb-3">{isRunning ? 'Runs:' : 'Exercises:'}</h3>
                    <div className="space-y-3">
                        {isRunning ? (
                             (workout as RunningWorkout).runs.map((run: PlannedRun, index) => {
                                 const description = user?.unitSystem === 'imperial' 
                                    ? convertDistanceInText(run.description, 'imperial')
                                    : run.description;

                                 return (
                                    <Card key={`${run.description}-${index}`}>
                                        <CardContent className="py-4 px-2 flex items-center gap-4">
                                            <div className="flex-1">
                                                <p className="font-semibold">{description}</p>
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
                                 const details = user?.unitSystem ? convertTextWithUnits(ex.details, user.unitSystem) : ex.details;
                                 return (
                                    <Card key={`${ex.name}-${index}`}>
                                        <CardContent className="py-4 px-2 flex items-center gap-4">
                                            <div className="flex-1">
                                                <p className="font-semibold">{ex.name}</p>
                                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{details}</p>
                                                
                                                {/* Exercise History Component */}
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
                            const details = user?.unitSystem ? convertTextWithUnits(item.details, user.unitSystem) : item.details;
                            return (
                                <Card key={`${item.name}-${index}`} className="border-dashed border-primary/50">
                                    <CardContent className="py-4 px-2 flex items-center gap-4">
                                        <div className="flex-1">
                                            <p className="font-semibold">{item.name}</p>
                                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{details}</p>
                                            {/* History for extended exercises too */}
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
