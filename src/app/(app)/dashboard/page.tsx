// src/app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { BarChart, Target, Sparkles, Loader2, Route } from 'lucide-react';
import { subWeeks, startOfWeek, isWithinInterval } from 'date-fns';

import { motivationalCoach } from '@/ai/flows/motivational-coach';
import { dashboardSummary } from '@/ai/flows/dashboard-summary';
import { workoutSummary } from '@/ai/flows/workout-summary';
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
import { ChartContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, ChartTooltip, CartesianGrid, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getWorkoutForDay } from '@/lib/workout-utils';
import { getOrCreateWorkoutSession, getAllUserSessions, type WorkoutSession } from '@/services/session-service-client';
import type { User, Program, Workout, RunningWorkout, PlannedRun } from '@/models/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { calculateTrainingPaces, formatPace } from '@/lib/pace-utils';

const chartConfig = {
  workouts: {
    label: "Workouts",
    color: "hsl(var(--primary))",
  },
};

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [todaysWorkout, setTodaysWorkout] = useState<{ day: number; workout: Workout | RunningWorkout | null } | null>(null);
  const [todaysSession, setTodaysSession] = useState<WorkoutSession | null>(null);
  const [progressData, setProgressData] = useState<{ week: string, workouts: number }[]>([]);
  const [trainingPaces, setTrainingPaces] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [motivation, setMotivation] = useState('');
  const [motivationLoading, setMotivationLoading] = useState(false);
  const [summary, setSummary] = useState("Here's your plan for today. Let's get it done.");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [workoutSummaryText, setWorkoutSummaryText] = useState("Assign a program to your profile to see your workout.");
  const [workoutSummaryLoading, setWorkoutSummaryLoading] = useState(false);
  const router = useRouter();
  
  const fetchCoreData = async (userId: string) => {
    setLoading(true);
    try {
      const currentUser = await getUserClient(userId);
      setUser(currentUser);

      if (!currentUser) return;

      if (currentUser.runningProfile) {
          const paces = calculateTrainingPaces(currentUser);
          setTrainingPaces(paces);
      }

      const sessions = await getAllUserSessions(userId);
      const weeklyProgress = generateProgressData(sessions);
      setProgressData(weeklyProgress);

      if (currentUser.programId && currentUser.startDate) {
        const currentProgram = await getProgramClient(currentUser.programId);
        setProgram(currentProgram);

        if (currentProgram) {
          const workoutInfo = getWorkoutForDay(currentProgram, currentUser.startDate, new Date());
          setTodaysWorkout(workoutInfo);

          if (workoutInfo.workout) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const session = await getOrCreateWorkoutSession(userId, currentProgram.id, today, workoutInfo.workout);
            setTodaysSession(session);
          }
        }
      }
    } catch (error) {
        console.error("Error fetching core dashboard data:", error);
    } finally {
        setLoading(false);
    }
  };
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        fetchCoreData(firebaseUser.uid);
      } else {
        setUser(null);
        setProgram(null);
        setTodaysWorkout(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Effect for AI Dashboard Summary
  useEffect(() => {
    if (user && program && todaysWorkout && progressData.length > 0) {
      setSummaryLoading(true);
      dashboardSummary({
        userName: user.firstName,
        programName: program.name,
        daysCompleted: todaysWorkout.day > 0 ? todaysWorkout.day : 0,
        weeklyConsistency: `${progressData[3]?.workouts || 0} workouts completed in the last week.`
      }).then(result => {
        setSummary(result.summary);
      }).catch(aiError => {
        console.error("Failed to generate AI dashboard summary:", aiError);
        setSummary("Here's your plan for today. Let's get it done."); // Fallback
      }).finally(() => {
        setSummaryLoading(false);
      });
    }
  }, [user, program, todaysWorkout, progressData]);

  // Effect for AI Workout Summary
  useEffect(() => {
    if (user && todaysWorkout?.workout) {
      setWorkoutSummaryLoading(true);
      const exercisesForSummary = todaysWorkout.workout.programType === 'running'
        ? (todaysWorkout.workout as RunningWorkout).runs.map(r => r.type).join(', ')
        : (todaysWorkout.workout as Workout).exercises.map(e => e.name).join(', ');

      workoutSummary({
        userName: user.firstName,
        workoutTitle: todaysWorkout.workout.title,
        exercises: exercisesForSummary,
      }).then(result => {
        setWorkoutSummaryText(result.summary);
      }).catch(aiError => {
        console.error("Failed to generate AI workout summary:", aiError);
        setWorkoutSummaryText(todaysWorkout.workout!.title); // Fallback
      }).finally(() => {
        setWorkoutSummaryLoading(false);
      });
    } else {
      setWorkoutSummaryLoading(false);
    }
  }, [user, todaysWorkout]);

  
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
      return weeklyData;
  }

  const handleGetMotivation = async () => {
    if (!user || !program) return;
    setMotivationLoading(true);
    try {
      // Create a simple workout history summary for the AI
      const workoutHistory = `User has completed ${todaysWorkout?.day || 0} days of the "${program.name}" program.`;
      const result = await motivationalCoach({
        userName: user.firstName,
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
  
  const handleStartWorkout = () => {
      if (todaysWorkout?.workout) {
          router.push('/workout/active');
      }
  }

  const workoutItems = useMemo(() => {
    if (!todaysWorkout?.workout) return [];
    if (todaysWorkout.workout.programType === 'running') {
      return (todaysWorkout.workout as RunningWorkout).runs;
    }
    return (todaysWorkout.workout as Workout).exercises;
  }, [todaysWorkout]);

  const completedItems = todaysSession && todaysSession.completedItems ? Object.values(todaysSession.completedItems).filter(Boolean).length : 0;
  const totalItems = workoutItems.length;
  const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  
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

  const isRunningProgram = todaysWorkout?.workout?.programType === 'running';

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
          Welcome back, {user?.firstName || 'Athlete'}!
        </h1>
        {summaryLoading ? (
            <Skeleton className="h-5 w-2/3" />
        ) : (
            <p className="text-muted-foreground">{summary}</p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {isRunningProgram ? <Route className="h-6 w-6" /> : <Target className="h-6 w-6" />}
              {program && todaysWorkout?.workout ? `Today's Workout (Day ${todaysWorkout.day})` : 'No Workout Assigned'}
            </CardTitle>
            <CardDescription asChild>
                <div className={cn("mt-2 p-3 bg-accent/20 border border-accent/50 rounded-md transform -rotate-1 shadow-sm", {
                    "animate-pulse": workoutSummaryLoading
                })}>
                     <p className="rotate-1 text-accent-foreground/90 italic">
                        {workoutSummaryLoading ? "Generating your daily tip..." : workoutSummaryText}
                    </p>
                </div>
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
                    <ul className="space-y-4">
                      {isRunningProgram ? (
                          (todaysWorkout.workout as RunningWorkout).runs.map((run: PlannedRun) => (
                              <li key={run.description}>
                                <p className="font-medium">{run.description}</p>
                                {trainingPaces ? (
                                    <p className="text-sm text-muted-foreground">
                                        Target Pace: <span className="font-semibold text-primary">{formatPace(trainingPaces[run.paceZone])}</span> / mile
                                    </p>
                                ) : (
                                    <p className="text-sm text-yellow-600">Enter benchmark times in your profile to see target paces.</p>
                                )}
                              </li>
                          ))
                      ) : (
                          (todaysWorkout.workout as Workout).exercises.map((ex) => (
                              <li key={ex.name}>
                                  <p className="font-medium">{ex.name}</p>
                                  <p className="text-sm text-muted-foreground">{ex.details}</p>
                              </li>
                          ))
                      )}
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
            <Button variant="accent" className="w-full" onClick={handleStartWorkout} disabled={!todaysWorkout?.workout}>Start / Resume Workout</Button>
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
                    <RechartsBarChart 
                        accessibilityLayer
                        data={progressData} 
                        margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                    >
                        <CartesianGrid vertical={false} />
                        <XAxis 
                            dataKey="week" 
                            tickLine={false} 
                            axisLine={false} 
                            tickMargin={8}
                            tickFormatter={(value) => value.slice(0, 3)}
                        />
                        <ChartTooltip 
                            cursor={false} 
                            content={<ChartTooltipContent indicator="dot" />} 
                        />
                        <Bar 
                            dataKey="workouts" 
                            fill="hsl(var(--primary))" 
                            radius={8} 
                        />
                    </RechartsBarChart>
                </ChartContainer>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
