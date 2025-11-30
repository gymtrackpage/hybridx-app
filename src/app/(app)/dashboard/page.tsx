// src/app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Target, Loader2, Route, Zap, PlusSquare, Link as LinkIcon, CheckCircle, History } from 'lucide-react';
import { subWeeks, startOfWeek, isWithinInterval, isFuture } from 'date-fns';

import { dashboardSummary } from '@/ai/flows/dashboard-summary';
import { workoutSummary } from '@/ai/flows/workout-summary';
import { generateWorkout } from '@/ai/flows/generate-workout';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ChartContainer, BarChart as RechartsBarChart, Bar, XAxis, ChartTooltip, CartesianGrid, ChartTooltipContent } from '@/components/ui/chart';
import { Skeleton } from '@/components/ui/skeleton';
import { getOrCreateWorkoutSession, type WorkoutSession } from '@/services/session-service-client';
import type { Workout, RunningWorkout, PlannedRun } from '@/models/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatPace } from '@/lib/pace-utils';
import { useToast } from '@/hooks/use-toast';
import { checkAndScheduleNotification } from '@/utils/notification-scheduler';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { StatsWidget } from '@/components/stats-widget';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/user-context';
import { isRunningWorkout } from '@/lib/type-guards';
import { AndroidBetaBanner } from '@/components/android-beta-banner';

// Lazy load heavy AI-powered components
const WeeklyAnalysisDialog = lazy(() => import('@/components/weekly-analysis-dialog').then(mod => ({ default: mod.WeeklyAnalysisDialog })));
const CustomWorkoutDialog = lazy(() => import('@/components/custom-workout-dialog').then(mod => ({ default: mod.CustomWorkoutDialog })));

const chartConfig = {
  workouts: {
    label: "Workouts",
    color: "hsl(var(--primary))",
  },
};

export default function DashboardPage() {
  const { user, program, todaysWorkout, todaysSession, allSessions, streakData, trainingPaces, loading } = useUser();
  const [progressData, setProgressData] = useState<{ week: string, workouts: number }[]>([]);
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [isCustomWorkoutDialogOpen, setIsCustomWorkoutDialogOpen] = useState(false);
  const [summary, setSummary] = useState("Here's your plan for today. Let's get it done.");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [workoutSummaryText, setWorkoutSummaryText] = useState("Assign a program to your profile to see your workout.");
  const [workoutSummaryLoading, setWorkoutSummaryLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { isGranted } = useNotificationPermission();
  
  // Calculate progress data when allSessions changes
  useEffect(() => {
    if (allSessions.length > 0) {
        const weeklyProgress = generateProgressData(allSessions);
        setProgressData(weeklyProgress);
    }
  }, [allSessions]);

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
    if (user && todaysWorkout?.workout && todaysSession) {
      setWorkoutSummaryLoading(true);
      const exercisesForSummary = isRunningWorkout(todaysWorkout.workout)
        ? (todaysWorkout.workout as RunningWorkout).runs.map(r => r.type).join(', ')
        : (todaysWorkout.workout as Workout).exercises.map(e => e.name).join(', ');

      workoutSummary({
        userName: user.firstName,
        workoutTitle: todaysWorkout.workout.title,
        exercises: exercisesForSummary,
        userNotes: todaysSession.notes,
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
  }, [user, todaysWorkout, todaysSession]);

  // Effect to schedule daily notifications
  useEffect(() => {
    if (isGranted && todaysWorkout?.workout && user) {
      const exercisesForNotification = isRunningWorkout(todaysWorkout.workout)
        ? (todaysWorkout.workout as RunningWorkout).runs.map(r => r.type).join(', ')
        : (todaysWorkout.workout as Workout).exercises.map(e => e.name).join(', ');

      checkAndScheduleNotification({
        workoutTitle: todaysWorkout.workout.title,
        exercises: exercisesForNotification,
      }, user.notificationTime).catch(error => {
        console.error('Error scheduling notification:', error);
      });
    }
  }, [isGranted, todaysWorkout, user]);

  
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
  
  const handleStartWorkout = () => {
      if (todaysWorkout?.workout) {
          router.push('/workout/active');
      }
  }
  
  const handleGenerateWorkout = async () => {
    if (!user) return;
    setIsGeneratingWorkout(true);
    toast({ title: 'Generating your workout...', description: 'The AI is building a custom session for you.' });
    try {
        const generated = await generateWorkout({
            userName: user.firstName,
            experience: user.experience,
        });

        // The AI output matches the structure of a Workout object
        const oneOffWorkout: Workout = {
            ...generated,
            day: 0, // Day 0 can represent a non-program workout
            programType: 'hyrox' // Explicitly set programType
        };
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // We create a session with a special programId to denote it's a one-off and overwrite any existing session for today
        await getOrCreateWorkoutSession(user.id, 'one-off-ai', today, oneOffWorkout, true);
        
        toast({ title: 'Workout Generated!', description: 'Redirecting you to start your session.' });
        router.push('/workout/active');

    } catch (error) {
        console.error("Failed to generate AI workout:", error);
        toast({ title: 'Error', description: 'Could not generate a workout. Please try again.', variant: 'destructive' });
        setIsGeneratingWorkout(false);
    }
  };

  const programStartsInFuture = user?.startDate && isFuture(user.startDate);
  const showGenerateWorkoutButton = !program || programStartsInFuture || !todaysWorkout?.workout;
  const isWorkoutCompleted = !!todaysSession?.finishedAt;
  
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

  const isProgramRunning = isRunningWorkout(todaysWorkout?.workout as any);
  const isStravaConnected = user?.strava?.accessToken;

  return (
    <>
      <div className="space-y-6">
        <div className="space-y-1 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Welcome back, {user?.firstName || 'Athlete'}
              </h1>
              {summaryLoading ? (
                  <Skeleton className="h-5 w-2/3" />
              ) : (
                  <p className="text-muted-foreground">{summary}</p>
              )}
            </div>

            {user && (
              <Suspense fallback={null}>
                <WeeklyAnalysisDialog userId={user.id} />
              </Suspense>
            )}
        </div>

        {/* Android Beta Testing Banner */}
        <AndroidBetaBanner
          userEmail={user?.email}
          userName={user?.firstName}
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className={cn("lg:col-span-2", isWorkoutCompleted && "bg-muted/30")}>
            <CardHeader>
              <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {isProgramRunning ? <Route className="h-6 w-6" /> : <Target className="h-6 w-6" />}
                      {program && todaysWorkout?.workout && !programStartsInFuture ? `Today's Workout (Day ${todaysWorkout.day})` : "Today's Plan"}
                      {user?.customProgram && user.customProgram.length > 0 && (
                        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 ml-2">
                          <Zap className="mr-1 h-3 w-3" />
                          Personalized
                        </Badge>
                      )}
                    </CardTitle>
                  </div>
                  {isWorkoutCompleted && (
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Completed
                      </Badge>
                  )}
              </div>
              <CardDescription asChild>
                  <div className={cn("mt-2 p-3 bg-accent/20 border border-accent/50 rounded-md transform -rotate-1 shadow-sm", {
                      "animate-pulse": workoutSummaryLoading,
                      "hidden": !todaysWorkout?.workout || programStartsInFuture
                  })}>
                      <p className="rotate-1 text-foreground/90 italic">
                          {workoutSummaryLoading ? "Generating your daily tip..." : workoutSummaryText}
                      </p>
                  </div>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isWorkoutCompleted ? (
                 <div className="text-center text-muted-foreground py-10">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                    <p className="font-semibold text-foreground">Great job! You've completed today's workout.</p>
                    <p className="text-sm">Check your progress in the calendar or history.</p>
                 </div>
              ) : todaysWorkout?.workout && !programStartsInFuture ? (
                  <div className="space-y-4">
                      <Separator />
                      <ul className="space-y-4 pt-4">
                        {isProgramRunning ? (
                            (todaysWorkout.workout as RunningWorkout).runs.map((run: PlannedRun) => (
                                <li key={run.description}>
                                  <p className="font-medium">{run.description}</p>
                                  {trainingPaces ? (
                                      <p className="text-sm text-muted-foreground">
                                          Target Pace: <span className="font-semibold text-primary">{formatPace(trainingPaces[run.paceZone])}</span> / km
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
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ex.details}</p>
                                </li>
                            ))
                        )}
                      </ul>
                  </div>
              ) : (
                  <div className="text-center text-muted-foreground py-10">
                      {programStartsInFuture ? (
                          <>
                              <p>Your program <span className="font-semibold text-foreground">{program?.name}</span> is scheduled to start in the future.</p>
                              <p className="text-sm">In the meantime, why not generate or log a workout for today?</p>
                          </>
                      ) : (
                          <>
                              <p>No workout scheduled for today.</p>
                              <p className="text-sm">Assign a program in your profile, generate one with AI, or log a custom activity.</p>
                          </>
                      )}
                  </div>
              )}
            </CardContent>
            <CardFooter className="flex-col md:flex-row gap-2">
              {isWorkoutCompleted ? (
                <Button variant="outline" className="w-full" asChild>
                    <Link href="/history">
                        <History className="mr-2 h-4 w-4" />
                        View Workout History
                    </Link>
                </Button>
              ) : showGenerateWorkoutButton ? (
                  <div className="w-full flex flex-col md:flex-row gap-2">
                      <Button variant="accent" className="w-full" onClick={handleGenerateWorkout} disabled={isGeneratingWorkout}>
                          {isGeneratingWorkout ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                          {isGeneratingWorkout ? 'Generating...' : 'Generate AI Workout'}
                      </Button>
                      <Button variant="outline" className="w-full" onClick={() => setIsCustomWorkoutDialogOpen(true)}>
                           <PlusSquare className="mr-2 h-4 w-4" />
                           Log Custom Workout
                      </Button>
                  </div>
              ) : (
                  <Button variant="accent" className="w-full" onClick={handleStartWorkout} disabled={!todaysWorkout?.workout}>Start / Resume Workout</Button>
              )}
            </CardFooter>
          </Card>

          <div className="space-y-6">
            {!isStravaConnected && (
              <Card className="bg-orange-50 border-orange-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <LinkIcon className="h-5 w-5" />
                    Connect to Strava
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-orange-700">
                    Automatically sync your activities to track progress and get personalized insights.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full border-orange-300 text-orange-800 hover:bg-orange-100 hover:text-orange-900">
                    <Link href="/profile">Connect Account</Link>
                  </Button>
                </CardFooter>
              </Card>
            )}

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

        <StatsWidget streakData={streakData} loading={loading} />
      </div>
      {user && (
        <Suspense fallback={null}>
          <CustomWorkoutDialog
            isOpen={isCustomWorkoutDialogOpen}
            setIsOpen={setIsCustomWorkoutDialogOpen}
            userId={user.id}
         />
        </Suspense>
      )}
    </>
  );
}
