// src/app/workout/active/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Check, Flag, Loader2, CalendarDays, Route, AlertTriangle, Timer, X } from 'lucide-react';
import { useDebouncedCallback } from 'use-debounce';

import { workoutSummary } from '@/ai/flows/workout-summary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { StravaUploadButton } from '@/components/strava-upload-button';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getWorkoutForDay } from '@/lib/workout-utils';
import { getOrCreateWorkoutSession, updateWorkoutSession, type WorkoutSession } from '@/services/session-service-client';
import type { Workout, RunningWorkout, User } from '@/models/types';
import { calculateTrainingPaces, formatPace } from '@/lib/pace-utils';
import Link from 'next/link';
import { differenceInSeconds } from 'date-fns';


export default function ActiveWorkoutPage() {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [workoutInfo, setWorkoutInfo] = useState<{ day: number, workout: Workout | RunningWorkout | null } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [trainingPaces, setTrainingPaces] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  
  const today = useMemo(() => {
      const d = new Date();
      d.setHours(0,0,0,0);
      return d;
  }, []);

  useEffect(() => {
    const initialize = async () => {
        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const currentUser = await getUserClient(firebaseUser.uid);
            setUser(currentUser);

            if (currentUser) {
                if (currentUser.runningProfile) {
                    const paces = calculateTrainingPaces(currentUser);
                    setTrainingPaces(paces);
                }
                if (currentUser.programId && currentUser.startDate) {
                    const program = await getProgramClient(currentUser.programId);
                    if (program) {
                        const currentWorkoutInfo = getWorkoutForDay(program, currentUser.startDate, today);
                        setWorkoutInfo(currentWorkoutInfo);
                        if (currentWorkoutInfo.workout) {
                            const workoutSession = await getOrCreateWorkoutSession(firebaseUser.uid, program.id, today, currentWorkoutInfo.workout);
                            setSession(workoutSession);
                            setNotes(workoutSession.notes || '');

                            // Show completion modal if already finished today
                            if (workoutSession.finishedAt) {
                                setIsCompleteModalOpen(true);
                            }

                            const exercisesForSummary = currentWorkoutInfo.workout.programType === 'running'
                                ? (currentWorkoutInfo.workout as RunningWorkout).runs.map(r => r.type).join(', ')
                                : (currentWorkoutInfo.workout as Workout).exercises.map(e => e.name).join(', ');

                            // Fetch AI summary
                            try {
                                const summaryResult = await workoutSummary({
                                userName: currentUser.firstName,
                                workoutTitle: currentWorkoutInfo.workout.title,
                                exercises: exercisesForSummary,
                                });
                                setSummaryText(summaryResult.summary);
                            } catch (error) {
                                console.error("Failed to generate AI workout summary:", error);
                                setSummaryText(currentWorkoutInfo.workout.title); // Fallback
                            } finally {
                                setSummaryLoading(false);
                            }
                        } else {
                            setSummaryLoading(false);
                        }
                    }
                }
            }
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
  
  const handleFinishWorkout = async () => {
      if(!session) return;
      // Final save of notes before finishing
      debouncedSaveNotes.flush();
      const finishedAt = new Date();
      const updatedSession = {...session, finishedAt, notes};
      setSession(updatedSession);
      await updateWorkoutSession(session.id, { finishedAt, notes, workoutTitle: workoutInfo?.workout?.title || 'Workout' });
      setIsCompleteModalOpen(true);
  }

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

  const workoutItems = workout.programType === 'running' 
    ? (workout as RunningWorkout).runs 
    : (workout as Workout).exercises;

  const allItemsCompleted = workoutItems.every(item => {
      if (!session?.completedItems) return false;
      const key = workout.programType === 'running' ? (item as any).description : (item as any).name;
      return session.completedItems[key];
  });
  
  const isRunningProgram = workout.programType === 'running';

  return (
    <>
    <div className="space-y-6 max-w-2xl mx-auto">
        <Card className="bg-accent/20 border-accent">
            <CardHeader>
                <div className="flex-1">
                    <CardTitle className="text-2xl font-bold tracking-tight">{workout.title}</CardTitle>
                    <CardDescription className="font-medium text-foreground/80">
                        {summaryLoading ? <Skeleton className="h-5 w-full mt-1" /> : summaryText}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>Week {week}, Day {dayOfWeek}</span>
                    </div>
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
                        {workoutItems.map((item, index) => {
                            const key = isRunningProgram ? (item as any).description : (item as any).name;
                            return (
                                <Card key={key} className="has-[[data-state=checked]]:bg-muted/50 transition-colors">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="flex-1">
                                            {isRunningProgram ? (
                                                <>
                                                    <p className="font-semibold">{(item as any).description}</p>
                                                    {trainingPaces && (
                                                        <p className="text-sm text-muted-foreground">
                                                            Target Pace: <span className="font-semibold text-primary">{formatPace(trainingPaces[(item as any).paceZone])}</span> / mile
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
                    </div>
                </div>

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
                    <Button className="w-full" onClick={handleFinishWorkout} disabled={!allItemsCompleted || !!session.finishedAt}>
                        {session.finishedAt ? <Check className="mr-2" /> : <Flag className="mr-2" />}
                        {session.finishedAt ? 'Workout Completed' : 'Finish Workout'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>

    {session.finishedAt && (
        <WorkoutCompleteModal
            isOpen={isCompleteModalOpen}
            onClose={() => setIsCompleteModalOpen(false)}
            session={session}
            userHasStrava={!!user?.strava?.accessToken}
        />
    )}
    </>
  );
}


interface WorkoutCompleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    session: WorkoutSession;
    userHasStrava?: boolean;
}

function WorkoutCompleteModal({ isOpen, onClose, session, userHasStrava }: WorkoutCompleteModalProps) {
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const duration = session.finishedAt ? differenceInSeconds(session.finishedAt, session.startedAt) : 0;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
            <DialogHeader>
            <DialogTitle>Workout Complete! 🎉</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
            <div className="text-center">
                <h3 className="font-semibold text-lg">{session.workoutTitle}</h3>
                <div className="text-2xl font-bold text-primary mt-2">
                {formatTime(duration)}
                </div>
            </div>

            {userHasStrava && (
                <>
                <Separator />
                <div className="flex flex-col items-center gap-2">
                    <p className="text-sm text-muted-foreground text-center">
                    Share your achievement with the Strava community
                    </p>
                    <StravaUploadButton
                        sessionId={session.id}
                        activityName={session.workoutTitle}
                        isUploaded={session.uploadedToStrava}
                        stravaId={session.stravaId}
                    />
                </div>
                </>
            )}

            <Button onClick={onClose} className="w-full">
                Done
            </Button>
            </div>
        </DialogContent>
        </Dialog>
    );
}
