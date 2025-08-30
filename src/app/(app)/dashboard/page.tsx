// src/app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState }from 'react';
import Link from 'next/link';
import { onAuthStateChanged } from 'firebase/auth';
import { BarChart, Dumbbell, Sparkles, Loader2 } from 'lucide-react';
import { subWeeks, startOfWeek, format, isWithinInterval } from 'date-fns';

import { motivationalCoach } from '@/ai/flows/motivational-coach';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ChartContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, ChartTooltip, CartesianGrid } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { getUser } from '@/services/user-service';
import { getProgram, getWorkoutForDay } from '@/services/program-service';
import { getOrCreateWorkoutSession, getAllUserSessions, type WorkoutSession } from '@/services/session-service';
import type { User, Program, Workout } from '@/models/types';

const chartConfig = {
  workouts: {
    label: "Workouts",
    color: "hsl(var(--primary))",
  },
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [todaysWorkout, setTodaysWorkout] = useState<{ day: number; workout: Workout | null } | null>(null);
  const [todaysSession, setTodaysSession] = useState<WorkoutSession | null>(null);
  const [progressData, setProgressData] = useState<{ week: string, workouts: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [motivation, setMotivation] = useState('');
  const [motivationLoading, setMotivationLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const currentUser = await getUser(firebaseUser.uid);
        setUser(currentUser);
        
        const sessions = await getAllUserSessions(firebaseUser.uid);
        generateProgressData(sessions);

        if (currentUser?.programId && currentUser.startDate) {
          const currentProgram = await getProgram(currentUser.programId);
          setProgram(currentProgram);
          if (currentProgram) {
            const workoutInfo = getWorkoutForDay(currentProgram, currentUser.startDate, new Date());
            setTodaysWorkout(workoutInfo);

            if (workoutInfo.workout) {
                const today = new Date();
                today.setHours(0,0,0,0);
                const session = await getOrCreateWorkoutSession(firebaseUser.uid, currentProgram.id, today, workoutInfo.workout);
                setTodaysSession(session);
            }
          }
        }
      } else {
        setUser(null);
        setProgram(null);
        setTodaysWorkout(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const generateProgressData = (sessions: WorkoutSession[]) => {
      const now = new Date();
      const weeklyData: { week: string, workouts: number }[] = [];
      
      for (let i = 3; i >= 0; i--) {
          const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6);
          
          const completedInWeek = sessions.filter(s => 
              s.finishedAt && isWithinInterval(s.finishedAt, { start: weekStart, end: weekEnd })
          ).length;
          
          weeklyData.push({
              week: `W${4-i}`,
              workouts: completedInWeek
          });
      }
      setProgressData(weeklyData);
  }

  const handleGetMotivation = async () => {
    if (!user || !program) return;
    setMotivationLoading(true);
    try {
      // Create a simple workout history summary for the AI
      const workoutHistory = `User has completed ${todaysWorkout?.day || 0} days of the "${program.name}" program.`;
      const result = await motivationalCoach({
        userName: user.email.split('@')[0], // Use the first part of the email as a name
        workoutHistory,
      });
      setMotivation(result.message);
    } catch (error) {
      console.error("Failed to get motivation:", error);
      setMotivation("There was an error getting your motivation. But you're still awesome!");
    } finally {
      setMotivationLoading(false);
    }
  };
  
  const completedExercises = todaysSession ? Object.values(todaysSession.completedExercises).filter(Boolean).length : 0;
  const totalExercises = todaysWorkout?.workout?.exercises.length || 0;
  const progressPercentage = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;
  
  if (loading) {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-8 w-1/2" />
                <Skeleton className="h-4 w-3/4" />
            </div>
             <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <CardHeader><Skeleton className="h-6 w-3/4" /></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full" /></CardContent>
                    <CardFooter><Skeleton className="h-10 w-full" /></CardFooter>
                </Card>
                <div className="space-y-6">
                    <Card><CardContent className="p-6"><Skeleton className="h-32 w-full" /></CardContent></Card>
                    <Card><CardContent className="p-6"><Skeleton className="h-40 w-full" /></CardContent></Card>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Welcome back, {user ? user.email.split('@')[0] : 'Athlete'}!
        </h1>
        <p className="text-muted-foreground">Here&apos;s your plan for today. Let&apos;s get it done.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="h-6 w-6" />
              {program && todaysWorkout ? `Today's Workout (Day ${todaysWorkout.day})` : 'No Workout Assigned'}
            </CardTitle>
            <CardDescription>
                {todaysWorkout?.workout ? todaysWorkout.workout.title : 'Assign a program to your profile to see your workout.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {todaysWorkout?.workout ? (
                <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium text-muted-foreground w-20">Progress</span>
                  <Progress value={progressPercentage} className="flex-1" />
                  <span className="text-sm font-bold">{Math.round(progressPercentage)}%</span>
                </div>
                <Separator />
                <ul className="space-y-3">
                  {todaysWorkout.workout.exercises.map((ex) => (
                    <li key={ex.name} className="flex items-center justify-between">
                      <span className="font-medium">{ex.name}</span>
                      <span className="text-sm text-muted-foreground">{ex.details}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
                <div className="text-center text-muted-foreground py-10">
                    <p>No workout scheduled for today.</p>
                    <p className="text-sm">Please check your program or contact an administrator.</p>
                </div>
            )}
          </CardContent>
          <CardFooter>
            <Button asChild className="w-full" disabled={!todaysWorkout?.workout}>
              <Link href="/workout/active">Start / Resume Workout</Link>
            </Button>
          </CardFooter>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-yellow-400" />
                Motivational Coach
              </CardTitle>
              <CardDescription>Your AI partner for a mental boost.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Feeling stuck? Get a personalized message from your AI coach based on your recent progress.</p>
            </CardContent>
            <CardFooter>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="secondary" className="w-full" onClick={handleGetMotivation} disabled={!user || !program}>Get Motivation</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Your Daily Boost</DialogTitle>
                    {motivationLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <DialogDescription>
                            {motivation || "Click 'Get Motivation' to see your message."}
                        </DialogDescription>
                    )}
                  </DialogHeader>
                </DialogContent>
              </Dialog>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BarChart className="h-6 w-6" />
                    Weekly Consistency
                </CardTitle>
                <CardDescription>
                    Your completed workouts over the last 4 weeks.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="h-40 w-full">
                    <RechartsBarChart data={progressData} margin={{ top: 20, right: 20, bottom: -10, left: -20 }}>
                        <CartesianGrid vertical={false} />
                        <XAxis dataKey="week" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis hide={true} />
                        <ChartTooltip cursor={false} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Bar dataKey="workouts" fill="hsl(var(--primary))" radius={4} />
                    </RechartsBarChart>
                </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
