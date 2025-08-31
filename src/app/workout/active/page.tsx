// src/app/workout/active/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Check, Dumbbell, Flag, Loader2, Play, Pause, Square } from 'lucide-react';

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

function Timer({ startTime, isRunning }: { startTime: Date; isRunning: boolean }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isRunning || !startTime) return;

    // Calculate initial elapsed time
    const initialElapsed = new Date().getTime() - startTime.getTime();
    setElapsed(initialElapsed);

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

  return <span className="text-4xl font-bold font-mono">{formatTime(elapsed)}</span>;
}

export default function ActiveWorkoutPage() {
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [workout, setWorkout] = useState<Workout | null>(null);
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
            const { workout: todaysWorkout } = getWorkoutForDay(program, user.startDate, today);
            setWorkout(todaysWorkout);
            if (todaysWorkout) {
              const workoutSession = await getOrCreateWorkoutSession(firebaseUser.uid, program.id, today, todaysWorkout);
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
    return <Skeleton className="h-[600px] w-full" />;
  }
  
  if (!workout || !session) {
      return (
          <div className="text-center">
            <h2 className="text-xl font-semibold">No Workout Today</h2>
            <p className="text-muted-foreground">Enjoy your rest day or check your program schedule.</p>
          </div>
      )
  }

  const allExercisesCompleted = workout.exercises.every(ex => session.completedExercises[ex.name]);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Card>
        <CardHeader className="text-center">
            <CardDescription>{format(today, 'PPP')}</CardDescription>
          <CardTitle className="text-3xl">{workout.title}</CardTitle>
          <div className="pt-4">
            <Timer startTime={session.startedAt} isRunning={session.isRunning} />
          </div>
        </CardHeader>
        <CardContent className="flex justify-center gap-4">
            <Button variant="outline" size="lg" onClick={handleToggleTimer} disabled={!!session.finishedAt}>
                {session.isRunning ? <Pause className="mr-2"/> : <Play className="mr-2"/>}
                {session.isRunning ? 'Pause' : 'Start'}
            </Button>
            <Button size="lg" onClick={handleFinishWorkout} disabled={!allExercisesCompleted || !!session.finishedAt}>
                {session.finishedAt ? <Check className="mr-2" /> : <Flag className="mr-2" />}
                {session.finishedAt ? 'Workout Completed' : 'Finish Workout'}
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell />
            Exercises
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {workout.exercises.map((exercise) => (
              <li key={exercise.name} className="flex items-center gap-4 p-4 rounded-md border bg-card has-[[data-state=checked]]:bg-muted">
                <Checkbox
                  id={exercise.name}
                  checked={!!session.completedExercises[exercise.name]}
                  onCheckedChange={(checked) => handleToggleExercise(exercise.name, !!checked)}
                  className="h-6 w-6"
                  disabled={!!session.finishedAt}
                />
                <label htmlFor={exercise.name} className="flex-1 cursor-pointer">
                  <p className="font-semibold">{exercise.name}</p>
                  <p className="text-sm text-muted-foreground">{exercise.details}</p>
                </label>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
