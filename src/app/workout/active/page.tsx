// src/app/workout/active/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Check, Flag, Loader2, Play, Pause, CalendarDays, Clock, Target } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { getUser } from '@/services/user-service';
import { getProgram, getWorkoutForDay } from '@/services/program-service';
import { getOrCreateWorkoutSession, updateWorkoutSession, type WorkoutSession } from '@/services/session-service';
import type { User, Program, Workout } from '@/models/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

function Timer({ startTime, isRunning }: { startTime: Date; isRunning: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;

    if (!isRunning) {
        setElapsed(new Date().getTime() - startTime.getTime());
        return;
    };

    const interval = setInterval(() => {
      setElapsed(new Date().getTime() - startTime.getTime());
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isRunning]);
  
  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return <span className="font-mono text-lg">{formatTime(elapsed || 0)}</span>;
}

export default function ActiveWorkoutPage() {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [workoutInfo, setWorkoutInfo] = useState<{ day: number, workout: Workout | null } | null>(null);
  const [loading, setLoading] = useState(true);
  
  const today = useMemo(() => {
      const d = new Date();
      d.setHours(0,0,0,0);
      return d;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await getUser(firebaseUser.uid);
        if (user?.programId && user.startDate) {
          const program = await getProgram(user.programId);
          if (program) {
            const currentWorkoutInfo = getWorkoutForDay(program, user.startDate, today);
            setWorkoutInfo(currentWorkoutInfo);
            if (currentWorkoutInfo.workout) {
              const workoutSession = await getOrCreateWorkoutSession(firebaseUser.uid, program.id, today, currentWorkoutInfo.workout);
              setSession(workoutSession);
            }
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [today]);

  const handleToggleExercise = async (exerciseName: string, completed: boolean) => {
    if (!session) return;
    const updatedCompleted = { ...session.completedExercises, [exerciseName]: completed };
    const updatedSession = { ...session, completedExercises: updatedCompleted };
    setSession(updatedSession);
    await updateWorkoutSession(session.id, { completedExercises: updatedCompleted });
  };
  
  const handleToggleTimer = async () => {
    if (!session) return;
    const isRunning = !session.isRunning;
    const updatedSession = { ...session, isRunning };
    setSession(updatedSession);
    await updateWorkoutSession(session.id, { isRunning });
  }
  
  const handleFinishWorkout = async () => {
      if(!session) return;
      const finishedAt = new Date();
      const isRunning = false;
      const updatedSession = {...session, isRunning, finishedAt};
      setSession(updatedSession);
      await updateWorkoutSession(session.id, { isRunning, finishedAt });
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
  const allExercisesCompleted = workout.exercises.every(ex => session.completedExercises[ex.name]);

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
        <Card className="bg-accent/20 border-accent">
            <CardHeader>
                <div className="flex items-center gap-3">
                    <Target className="h-8 w-8 text-foreground" />
                    <div>
                        <CardTitle className="text-2xl font-bold tracking-tight">Today&apos;s Workout</CardTitle>
                        <CardDescription className="font-medium text-foreground/80">{workout.title}</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex items-center gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <Timer startTime={session.startedAt} isRunning={session.isRunning} />
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>Week {week}, Day {dayOfWeek}</span>
                    </div>
                </div>
                <p className="text-sm text-foreground/90">
                    Build foundational strength. Light introduction to a Hyrox skill. RPE 6-7 for strength.
                </p>
                
                <div>
                    <h3 className="text-base font-semibold mb-3">Exercises:</h3>
                    <div className="space-y-3">
                        {workout.exercises.map((exercise) => (
                        <Card key={exercise.name} className="has-[[data-state=checked]]:bg-muted/50 transition-colors">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="flex-1">
                                <p className="font-semibold">{exercise.name}</p>
                                <p className="text-sm text-muted-foreground">{exercise.details}</p>
                                </div>
                                <Checkbox
                                    id={exercise.name}
                                    checked={!!session.completedExercises[exercise.name]}
                                    onCheckedChange={(checked) => handleToggleExercise(exercise.name, !!checked)}
                                    className="h-6 w-6"
                                    disabled={!!session.finishedAt}
                                    aria-label={`Mark ${exercise.name} as complete`}
                                />
                            </CardContent>
                        </Card>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                    <Button variant="secondary" className="flex-1" onClick={handleToggleTimer} disabled={!!session.finishedAt}>
                        {session.isRunning ? <Pause className="mr-2"/> : <Play className="mr-2"/>}
                        {session.isRunning ? 'Pause Timer' : 'Start Timer'}
                    </Button>
                    <Button className="flex-1" onClick={handleFinishWorkout} disabled={!allExercisesCompleted || !!session.finishedAt}>
                        {session.finishedAt ? <Check className="mr-2" /> : <Flag className="mr-2" />}
                        {session.finishedAt ? 'Workout Completed' : 'Finish Workout'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    </div>
  );
}
