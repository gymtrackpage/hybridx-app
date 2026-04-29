// src/app/(app)/dashboard/page.tsx
'use client';

import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Target, Loader2, Route, Zap, PlusSquare, Link as LinkIcon, CheckCircle, History, Calendar, Bell, CheckSquare } from 'lucide-react';
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
import { getOrCreateWorkoutSession, updateWorkoutSession, type WorkoutSession } from '@/services/session-service-client';
import type { WorkoutDay, RunningWorkout, PlannedRun } from '@/models/types';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatPace } from '@/lib/pace-utils';
import { useToast } from '@/hooks/use-toast';
import { checkAndScheduleNotification } from '@/utils/notification-scheduler';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { StatsWidget } from '@/components/stats-widget';
import { Badge } from '@/components/ui/badge';
import { useUser } from '@/contexts/user-context';
import { logger } from '@/lib/logger';
import { hasRuns, hasExercises } from '@/lib/type-guards';
import { AndroidBetaBanner } from '@/components/android-beta-banner';
import { RacePrepDialog } from '@/components/race-prep-dialog';
import type { StravaLoadError } from '@/components/today-strava-feed';

// Lazy load heavy AI-powered components
// const WeeklyAnalysisDialog = lazy(() => import('@/components/weekly-analysis-dialog').then(mod => ({ default: mod.WeeklyAnalysisDialog })));
const CustomWorkoutDialog = lazy(() => import('@/components/custom-workout-dialog').then(mod => ({ default: mod.CustomWorkoutDialog })));
const TrainingLoadCard = lazy(() => import('@/components/training-load-card').then(mod => ({ default: mod.TrainingLoadCard })));
const TodayStravaFeed = lazy(() => import('@/components/today-strava-feed').then(mod => ({ default: mod.TodayStravaFeed })));

const chartConfig = {
  workouts: {
    label: "Workouts",
    color: "hsl(var(--primary))",
  },
};

export default function DashboardPage() {
  const { user, program, todaysWorkout, todaysSession, allSessions, streakData, trainingPaces, loading, refreshData } = useUser();
  const [progressData, setProgressData] = useState<{ week: string, workouts: number }[]>([]);
  const [todayStravaSummary, setTodayStravaSummary] = useState<string | null>(null);
  // True once TodayStravaFeed has resolved (success OR no Strava connection) — gates the AI summary
  const [todayStravaLoaded, setTodayStravaLoaded] = useState(false);
  const [stravaLoadError, setStravaLoadError] = useState<StravaLoadError | null>(null);
  // Prevent the dashboard summary from firing more than once per mount
  const summaryFiredRef = useRef(false);
  const [isGeneratingWorkout, setIsGeneratingWorkout] = useState(false);
  const [isMarkingDone, setIsMarkingDone] = useState(false);
  const [isCustomWorkoutDialogOpen, setIsCustomWorkoutDialogOpen] = useState(false);
  const [summary, setSummary] = useState("Here's your plan for today. Let's get it done.");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [workoutSummaryText, setWorkoutSummaryText] = useState("Assign a program to your profile to see your workout.");
  const [workoutSummaryLoading, setWorkoutSummaryLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { isGranted } = useNotificationPermission();
  
  // New User Detection
  const isNewUser = !loading && allSessions.length === 0;

  // Calculate progress data when allSessions changes
  useEffect(() => {
    if (allSessions.length > 0) {
        const weeklyProgress = generateProgressData(allSessions);
        setProgressData(weeklyProgress);
    }
  }, [allSessions]);

  // Mark Strava as "not needed" for non-connected users so the summary doesn't wait forever
  useEffect(() => {
    if (!loading && user && !user.strava?.accessToken) {
      setTodayStravaLoaded(true);
    }
  }, [loading, user]);

  // Effect for AI Dashboard Summary — fires ONCE after all data including Strava is ready.
  // Using summaryFiredRef to prevent double-firing when todayStravaLoaded flips to true.
  useEffect(() => {
    if (!user || !program || !todaysWorkout || progressData.length === 0) return;
    if (!todayStravaLoaded) return; // Wait until we know whether there are Strava activities today
    if (summaryFiredRef.current) return; // Don't fire more than once per mount

    summaryFiredRef.current = true;
    setSummaryLoading(true);
    dashboardSummary({
      userName: user.firstName,
      programName: program.name,
      daysCompleted: todaysWorkout.day > 0 ? todaysWorkout.day : 0,
      weeklyConsistency: [
        `3 weeks ago: ${progressData[0]?.workouts ?? 0} workouts`,
        `2 weeks ago: ${progressData[1]?.workouts ?? 0} workouts`,
        `last week: ${progressData[2]?.workouts ?? 0} workouts`,
        `this week so far: ${progressData[3]?.workouts ?? 0} workouts`,
      ].join(', '),
      // Only pass Strava activity when it loaded successfully (not when errored)
      todayStravaActivity: stravaLoadError ? undefined : (todayStravaSummary ?? undefined),
    }).then(result => {
      setSummary(result.summary);
    }).catch(aiError => {
      logger.error("Failed to generate AI dashboard summary:", aiError);
      setSummary("Here's your plan for today. Let's get it done.");
    }).finally(() => {
      setSummaryLoading(false);
    });
  }, [user, program, todaysWorkout, progressData, todayStravaLoaded, stravaLoadError]); // todayStravaSummary intentionally excluded — read via closure after todayStravaLoaded is true

  // Effect for AI Workout Summary — staggered 1s after mount to avoid concurrent Gemini calls
  useEffect(() => {
    if (!user || !todaysWorkout?.workout || !todaysSession) {
      setWorkoutSummaryLoading(false);
      return;
    }

    setWorkoutSummaryLoading(true);
    const runParts = hasRuns(todaysWorkout.workout) ? todaysWorkout.workout.runs.map(r => r.type) : [];
    const exParts = hasExercises(todaysWorkout.workout) ? todaysWorkout.workout.exercises.map(e => e.name) : [];
    const exercisesForSummary = [...runParts, ...exParts].join(', ');

    // Delay slightly so dashboard summary fires first, avoiding concurrent API calls
    const timer = setTimeout(() => {
      workoutSummary({
        userName: user.firstName,
        workoutTitle: todaysWorkout.workout!.title,
        exercises: exercisesForSummary,
        userNotes: todaysSession.notes,
      }).then(result => {
        setWorkoutSummaryText(result.summary);
      }).catch(aiError => {
        logger.error("Failed to generate AI workout summary:", aiError);
        setWorkoutSummaryText(todaysWorkout.workout!.title);
      }).finally(() => {
        setWorkoutSummaryLoading(false);
      });
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, todaysWorkout, todaysSession]);

  // Effect to schedule daily notifications
  useEffect(() => {
    if (isGranted && todaysWorkout?.workout && user) {
      const notifRunParts = hasRuns(todaysWorkout.workout) ? (todaysWorkout.workout).runs.map(r => r.type) : [];
      const notifExParts = hasExercises(todaysWorkout.workout) ? todaysWorkout.workout.exercises.map(e => e.name) : [];
      const exercisesForNotification = [...notifRunParts, ...notifExParts].join(', ');

      checkAndScheduleNotification({
        workoutTitle: todaysWorkout.workout.title,
        exercises: exercisesForNotification,
      }, user.notificationTime).catch(error => {
        logger.error('Error scheduling notification:', error);
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

        const oneOffWorkout: WorkoutDay = {
            ...generated,
            day: 0,
            programType: 'hyrox',
        } as WorkoutDay;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await getOrCreateWorkoutSession(user.id, 'one-off-ai', today, oneOffWorkout, true);
        
        toast({ title: 'Workout Generated!', description: 'Redirecting you to start your session.' });
        router.push('/workout/active');

    } catch (error) {
        logger.error("Failed to generate AI workout:", error);
        toast({ title: 'Error', description: 'Could not generate a workout. Please try again.', variant: 'destructive' });
        setIsGeneratingWorkout(false);
    }
  };

  const handleCommitTomorrow = () => {
      // In a real app, this would use the Notification API
      toast({
          title: "Session Committed!",
          description: "We'll remind you tomorrow morning. Get your kit ready!",
      });
  };

  const handleMarkDone = async () => {
      if (!todaysSession || !todaysWorkout?.workout) return;
      setIsMarkingDone(true);
      try {
          await updateWorkoutSession(todaysSession.id, {
              finishedAt: new Date(),
              workoutTitle: todaysWorkout.workout.title,
          });
          await refreshData();
          toast({ title: 'Workout Completed!', description: 'Nice work. Keep the streak alive!' });
      } catch (error) {
          logger.error('Failed to mark workout done:', error);
          toast({ title: 'Error', description: 'Could not mark workout as done.', variant: 'destructive' });
      } finally {
          setIsMarkingDone(false);
      }
  };

  // Stable callback — prevents TodayStravaFeed from re-fetching on every parent render
  const handleStravaActivitiesLoaded = useCallback((s: string | null, error?: StravaLoadError) => {
    setTodayStravaSummary(s);
    setStravaLoadError(error ?? null);
    setTodayStravaLoaded(true);
  }, []);

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

  const workoutHasRuns = hasRuns(todaysWorkout?.workout);
  const workoutHasExercises = hasExercises(todaysWorkout?.workout);
  const isStravaConnected = user?.strava?.accessToken;

  // === NEW USER ONBOARDING DASHBOARD ===
  if (isNewUser) {
      return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="space-y-1">
                <h1 className="text-3xl font-bold tracking-tight text-primary">
                    Welcome to Week 1, {user?.firstName}!
                </h1>
                <p className="text-muted-foreground text-lg">
                    The hardest step is the first one. Let's make it easy.
                </p>
            </div>

            <AndroidBetaBanner userEmail={user?.email} userName={user?.firstName} />

            <div className="grid gap-6 md:grid-cols-2">
                {/* HERO CARD: TODAY'S WORKOUT */}
                <Card className="border-2 border-primary/20 bg-gradient-to-br from-card to-primary/5 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Target className="h-6 w-6 text-primary" />
                            Your First Mission
                        </CardTitle>
                        <CardDescription>
                            Complete just 1 workout this week to build momentum.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {todaysWorkout?.workout ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-background/80 rounded-lg border">
                                    <h3 className="font-bold text-lg">{todaysWorkout.workout.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Day {todaysWorkout.day} • {workoutHasRuns && workoutHasExercises ? 'Hybrid' : workoutHasRuns ? 'Running' : 'Strength'}
                                    </p>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Can't do it today? No problem. Commit to tomorrow and we'll hold you accountable.
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-6">
                                <p>No workout scheduled today.</p>
                                <Button variant="link" onClick={handleGenerateWorkout}>
                                    Generate a Quick Start Session
                                </Button>
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex flex-col sm:flex-row gap-3">
                        <Button 
                            variant="default" 
                            size="lg" 
                            className="w-full font-bold shadow-md hover:shadow-xl transition-all"
                            onClick={handleStartWorkout}
                            disabled={!todaysWorkout?.workout}
                        >
                            <Zap className="mr-2 h-5 w-5 fill-yellow-400 text-yellow-400" />
                            Start First Workout
                        </Button>
                        <Button 
                            variant="outline" 
                            size="lg" 
                            className="w-full"
                            onClick={handleCommitTomorrow}
                        >
                            <Calendar className="mr-2 h-4 w-4" />
                            Do It Tomorrow
                        </Button>
                    </CardFooter>
                </Card>

                {/* SIDEBAR: WHY HYBRIDX */}
                <div className="space-y-6">
                    <Card className="bg-muted/30">
                        <CardHeader>
                            <CardTitle className="text-lg">Why HybridX?</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 text-sm">
                            <div className="flex gap-3">
                                <div className="bg-primary/10 p-2 rounded-full h-fit">
                                    <Zap className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold">AI Adaptability</p>
                                    <p className="text-muted-foreground">If you miss a day, just tell the AI. It re-plans your week instantly.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <div className="bg-primary/10 p-2 rounded-full h-fit">
                                    <Target className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                    <p className="font-semibold">Event Prep</p>
                                    <p className="text-muted-foreground">Training for Hyrox or a Marathon? Use our "Train for an Event" tool.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* SETUP STEPS */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Setup</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {!isStravaConnected && (
                                <Link href="/profile" className="flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors border border-dashed">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <LinkIcon className="h-4 w-4" /> Connect Strava
                                    </span>
                                    <Badge variant="secondary">Recommended</Badge>
                                </Link>
                            )}
                            <div className="flex items-center justify-between p-3 rounded-md bg-muted/20 border">
                                <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <CheckCircle className="h-4 w-4 text-green-500" /> Account Created
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
      );
  }

  // === EXISTING DASHBOARD (Standard) ===
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

            {/* Hiding Weekly Analysis for now 
            {user && (
              <Suspense fallback={null}>
                <WeeklyAnalysisDialog userId={user.id} />
              </Suspense>
            )}
            */}
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
                      {workoutHasRuns && !workoutHasExercises ? <Route className="h-6 w-6" /> : <Target className="h-6 w-6" />}
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
                        {workoutHasRuns && (todaysWorkout.workout as RunningWorkout).runs.map((run: PlannedRun) => (
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
                        ))}
                        {workoutHasRuns && workoutHasExercises && (
                            <li><Separator /></li>
                        )}
                        {workoutHasExercises && todaysWorkout.workout.exercises.map((ex) => (
                            <li key={ex.name}>
                                <p className="font-medium">{ex.name}</p>
                                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{ex.details}</p>
                            </li>
                        ))}
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
                  <div className="w-full flex flex-col md:flex-row gap-2">
                      <Button variant="accent" className="w-full" onClick={handleStartWorkout} disabled={!todaysWorkout?.workout}>
                          <Zap className="mr-2 h-4 w-4" />
                          Start / Resume Workout
                      </Button>
                      {todaysSession && (
                          <Button variant="outline" className="w-full" onClick={handleMarkDone} disabled={isMarkingDone}>
                              {isMarkingDone
                                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  : <CheckSquare className="mr-2 h-4 w-4" />
                              }
                              Mark as Done
                          </Button>
                      )}
                  </div>
              )}
            </CardFooter>
          </Card>

          <div className="space-y-6">

            {/* ADDED RACE PREP DIALOG HERE */}
            <RacePrepDialog />

            {/* Training Load Card — shown when Strava is connected */}
            {isStravaConnected && user && (
              <Suspense fallback={<Skeleton className="h-48 w-full rounded-xl" />}>
                <TrainingLoadCard />
              </Suspense>
            )}

            {stravaLoadError === 'reconnect_required' && (
              <Card className="bg-red-50 border-red-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-red-800">
                    <LinkIcon className="h-5 w-5" />
                    Strava Disconnected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-red-700">
                    Your Strava connection has expired. Reconnect to resume activity syncing and personalised insights.
                  </p>
                </CardContent>
                <CardFooter>
                  <Button asChild variant="outline" className="w-full border-red-300 text-red-800 hover:bg-red-100 hover:text-red-900">
                    <Link href="/profile">Reconnect Strava</Link>
                  </Button>
                </CardFooter>
              </Card>
            )}

            {!isStravaConnected && !stravaLoadError && (
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

        {/* Today's Strava Activity Feed — only rendered when Strava is connected */}
        {isStravaConnected && user && (
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Today&apos;s Activity
            </h2>
            <Suspense fallback={
              <div className="flex gap-3">
                <Skeleton className="h-16 flex-1 rounded-xl" />
                <Skeleton className="h-16 flex-1 rounded-xl" />
              </div>
            }>
              <TodayStravaFeed onActivitiesLoaded={handleStravaActivitiesLoaded} />
            </Suspense>
          </div>
        )}

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
