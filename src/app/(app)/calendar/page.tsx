// src/app/(app)/calendar/page.tsx
'use client';

import { useState, useEffect, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getWorkoutForDay, formatPlannedRun } from '@/lib/workout-utils';
import { getAllUserSessions, getOrCreateWorkoutSession, updateWorkoutSession } from '@/services/session-service-client';
import { swapWorkouts } from '@/services/session-service'; // Import the new server action
import type { User, Program, WorkoutDay, WorkoutSession, RunningWorkout, Workout } from '@/models/types';
import { hasRuns, hasExercises } from '@/lib/type-guards';
import { addDays, format, isSameDay, parseISO, isValid, isToday, isPast, startOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Clock, Forward, Edit, CheckCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatTextWithBullets } from '@/utils/text-formatter';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedCallback } from 'use-debounce';

// Lazy load heavy components
const Calendar = lazy(() => import('@/components/ui/calendar').then(mod => ({ default: mod.Calendar })));
const LinkStravaActivityDialog = lazy(() => import('@/components/link-strava-activity-dialog').then(mod => ({ default: mod.LinkStravaActivityDialog })));

interface WorkoutEvent {
  date: Date;
  /** One entry per sub-workout scheduled for the day (e.g. a Run + a Weight Training session). */
  workouts: WorkoutDay[];
  /** Parallel to `workouts` — the persisted session for that slot, if one has been started/completed. */
  sessions: (WorkoutSession | undefined)[];
  isCompleted: boolean;
  isMissed: boolean;
  isRestDay: boolean;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [workoutEvents, setWorkoutEvents] = useState<WorkoutEvent[]>([]);
  const [isLinkerOpen, setIsLinkerOpen] = useState(false);
  const [sessionToLink, setSessionToLink] = useState<WorkoutSession | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [editingNotesIndex, setEditingNotesIndex] = useState<number | null>(null);
  const [notesByIndex, setNotesByIndex] = useState<Record<number, string>>({});
  const [markingDoneIndex, setMarkingDoneIndex] = useState<number | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const selectedEvent = workoutEvents.find(event =>
    selectedDate && isSameDay(event.date, selectedDate)
  );

  const todaysEvent = workoutEvents.find(event => isToday(event.date));

  // When selectedEvent changes, reset per-row notes drafts
  useEffect(() => {
    const initialNotes: Record<number, string> = {};
    selectedEvent?.sessions.forEach((s, i) => {
      if (s?.notes) initialNotes[i] = s.notes;
    });
    setNotesByIndex(initialNotes);
    setEditingNotesIndex(null);
  }, [selectedEvent]);

  const fetchCalendarData = async (fbUser: FirebaseUser) => {
    try {
      setFirebaseUser(fbUser);
      const user = await getUserClient(fbUser.uid);

      let userProgram: Program | null = null;
      if (user?.programId && user.startDate) {
        userProgram = await getProgramClient(user.programId);
      }
      setProgram(userProgram);

      const sessions = await getAllUserSessions(fbUser.uid);
      generateWorkoutEvents(userProgram, user?.startDate, sessions);
    } catch (error) {
        console.error('❌ Error fetching calendar data:', error);
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        setLoading(true);
        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
          if (fbUser) {
            await fetchCalendarData(fbUser);
          } else {
            setLoading(false);
          }
        });
        return unsubscribe;
      } catch (error) {
        console.error('❌ Calendar initialization error:', error);
        setLoading(false);
      }
      return () => {};
    };

    let unsubscribe: () => void = () => {};
    initialize().then(unsub => unsubscribe = unsub);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

    const getEventColor = (workout: WorkoutDay, isCompleted: boolean, isMissed: boolean): string => {
        if (isCompleted) return 'bg-green-500';
        if (isMissed) return 'bg-red-400';

        const hasR = hasRuns(workout);
        const hasE = hasExercises(workout);

        // Hybrid day (run + strength/cardio)
        if (hasR && hasE) return 'bg-teal-500';

        // Running — shade by intensity
        if (hasR) {
            const primaryRunType = (workout as RunningWorkout).runs[0]?.type;
            switch (primaryRunType) {
                case 'intervals': return 'bg-orange-500';
                case 'tempo':     return 'bg-yellow-500';
                case 'long':      return 'bg-blue-600';
                case 'easy':
                case 'recovery':  return 'bg-blue-400';
                default:          return 'bg-blue-500';
            }
        }

        // Strength or cardio — check the sessionType on exercises
        if (hasE) {
            const firstSessionType = (workout as Workout).exercises[0]?.sessionType;
            if (firstSessionType === 'cardio') return 'bg-pink-500';
            return 'bg-purple-500'; // strength (default)
        }

        return 'bg-gray-400';
    };

  const generateWorkoutEvents = (program: Program | null, startDate: Date | undefined, sessions: WorkoutSession[]) => {
    const events: WorkoutEvent[] = [];

    // Group persisted sessions by calendar day — a day can have multiple sub-workout sessions.
    const sessionsByDate = new Map<string, WorkoutSession[]>();
    sessions.forEach(session => {
        let sessionDate: Date;
        const dateSource = session.finishedAt || session.workoutDate;

        if (dateSource instanceof Date) {
          sessionDate = new Date(dateSource);
        } else if (typeof dateSource === 'string') {
          sessionDate = parseISO(dateSource);
        } else {
          sessionDate = parseISO(String(dateSource));
        }

        if (isValid(sessionDate)) {
            const dateKey = format(startOfDay(sessionDate), 'yyyy-MM-dd');
            const list = sessionsByDate.get(dateKey) ?? [];
            list.push(session);
            sessionsByDate.set(dateKey, list);
        }
    });
    sessionsByDate.forEach(list => list.sort((a, b) => (a.sessionIndex ?? 0) - (b.sessionIndex ?? 0)));

    if (program && startDate) {
      const normalizedStartDate = startOfDay(new Date(startDate));

      const programDuration = Math.max(...program.workouts.map(w => w.day), 0);

      for (let i = 0; i < programDuration + 365; i++) { // Generate events for a year past program end
        const currentDate = addDays(normalizedStartDate, i);
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const { sessions: programmedSessions } = getWorkoutForDay(program, normalizedStartDate, currentDate);
        const daySessions = sessionsByDate.get(dateKey);

        // Planned sub-workouts, using a persisted session's workoutDetails where it exists (reflects swaps).
        const basePlanned = programmedSessions.length > 0
            ? programmedSessions
            : (daySessions?.[0]?.workoutDetails ? [daySessions[0].workoutDetails] : []);
        const workouts: WorkoutDay[] = basePlanned.map((planned, idx) => daySessions?.[idx]?.workoutDetails ?? planned);

        if (workouts.length > 0) {
            const isRestDay = workouts[0].title.toLowerCase().includes('rest') || workouts[0].title.toLowerCase().includes('recover');
            const anyCompleted = !!daySessions?.some(s => s.finishedAt && !s.skipped);
            const anySkipped = !!daySessions?.some(s => s.skipped);
            const isPastDate = isPast(currentDate) && !isToday(currentDate);
            const isMissed = !anyCompleted && !anySkipped && isPastDate && !isRestDay;

            events.push({
                date: currentDate,
                workouts,
                sessions: workouts.map((_, idx) => daySessions?.[idx]),
                isCompleted: anyCompleted,
                isMissed,
                isRestDay,
            });

            if (daySessions) {
                sessionsByDate.delete(dateKey);
            }
        }
      }
    }

    // Leftover persisted sessions with no matching program day (e.g. Strava-linked one-offs).
    sessionsByDate.forEach((daySessions, dateKey) => {
        const withDetails = daySessions.filter(s => s.workoutDetails);
        if (withDetails.length === 0) return;

        const workouts = withDetails.map(s => s.workoutDetails as WorkoutDay);
        const isRestDay = workouts[0].title.toLowerCase().includes('rest') || workouts[0].title.toLowerCase().includes('recover');
        const eventDate = parseISO(`${dateKey}T12:00:00.000Z`);
        const anyCompleted = withDetails.some(s => s.finishedAt && !s.skipped);
        events.push({
            date: eventDate,
            workouts,
            sessions: withDetails,
            isCompleted: anyCompleted,
            isMissed: false,
            isRestDay,
        });
    });

    setWorkoutEvents(events);
  };

  const handleNotesChange = (index: number, value: string) => {
    setNotesByIndex(prev => ({ ...prev, [index]: value }));
    debouncedSaveNotes(index, value);
  };

  const debouncedSaveNotes = useDebouncedCallback(async (index: number, value: string) => {
    const session = selectedEvent?.sessions[index];
    if (!session) return;
    try {
      await updateWorkoutSession(session.id, { notes: value });
    } catch (error) {
      console.error("Failed to save notes:", error);
      toast({ title: "Error", description: "Could not save your notes.", variant: "destructive" });
    }
  }, 1000);

  const handleSaveNotes = (index: number) => {
    debouncedSaveNotes.flush();
    setEditingNotesIndex(null);
    toast({ title: "Notes Saved", description: "Your workout notes have been updated." });
  };

  const handleDoToday = async () => {
      const selectedWorkout = selectedEvent?.workouts[0];
      if (!firebaseUser || !selectedWorkout || !selectedDate || !program) {
          toast({ title: "Error", description: "Cannot swap workout. User or workout data is missing.", variant: "destructive" });
          return;
      }

      try {
          const today = startOfDay(new Date());
          const sourceDate = startOfDay(selectedDate);

          const todaysOriginalWorkout = todaysEvent?.workouts[0] || null;

          await swapWorkouts({
              userId: firebaseUser.uid,
              programId: program.id,
              date1: today,
              workout1: selectedWorkout,
              date2: sourceDate,
              workout2: todaysOriginalWorkout
          });

          toast({ title: "Workouts Swapped!", description: `"${selectedWorkout.title}" is now scheduled for today.` });
          router.push('/workout/active');

      } catch (error) {
          console.error("Failed to swap workouts:", error);
          toast({ title: "Error", description: "Could not swap the workouts. Please try again.", variant: "destructive" });
      }
  };

  const getCompletedExercises = (workout: WorkoutDay | undefined): { name: string, details: string }[] => {
    if (!workout) return [];
    const runs = hasRuns(workout) ? workout.runs.map(r => ({
        name: r.description || r.type,
        details: `${r.distance}km – ${r.type}`,
    })) : [];
    const exercises = (workout.exercises ?? []).map((e: any) => ({
        name: e.name,
        details: e.details || 'Completed',
    }));
    return [...runs, ...exercises];
  };

  const formatSessionDate = (session: WorkoutSession): string => {
    if (!session.finishedAt) return 'Unknown date';

    try {
      let finishedDate: Date;

      if (session.finishedAt instanceof Date) {
        finishedDate = session.finishedAt;
      } else if (typeof session.finishedAt === 'string') {
        finishedDate = parseISO(session.finishedAt);
      } else if (session.finishedAt && typeof (session.finishedAt as any).toDate === 'function') {
        finishedDate = (session.finishedAt as any).toDate();
      } else {
        return 'Invalid date';
      }

      return format(finishedDate, "MMMM do, yyyy 'at' h:mm a");
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Invalid date';
    }
  };

  const handleLinkSuccess = async () => {
    setIsLinkerOpen(false);
    setSessionToLink(null);
    setLoading(true);
    const auth = await getAuthInstance();
    if (auth.currentUser) {
        await fetchCalendarData(auth.currentUser);
    }
    setLoading(false);
  };

  const handleMarkDone = async (index: number) => {
    const workout = selectedEvent?.workouts[index];
    if (!workout || !selectedDate || !firebaseUser || !selectedEvent) return;
    setMarkingDoneIndex(index);
    try {
        const dayStart = startOfDay(selectedDate);
        const programId = program?.id || 'manual';

        // Ensure a session doc exists for this specific sub-workout slot (creates one if not)
        const session = await getOrCreateWorkoutSession(
            firebaseUser.uid,
            programId,
            dayStart,
            workout,
            false,
            undefined,
            index,
            selectedEvent.workouts.length,
        );

        // Mark it completed at noon on the selected day (preserves the date correctly)
        const completedAt = new Date(selectedDate);
        completedAt.setHours(12, 0, 0, 0);

        await updateWorkoutSession(session.id, {
            finishedAt: completedAt,
            workoutTitle: workout.title,
            skipped: false,
        });

        toast({ title: 'Marked as Completed', description: `${workout.title} logged.` });
        await fetchCalendarData(firebaseUser);
    } catch (error) {
        console.error('Failed to mark workout done:', error);
        toast({ title: 'Error', description: 'Could not mark workout as completed.', variant: 'destructive' });
    } finally {
        setMarkingDoneIndex(null);
    }
  };

  const handleOpenLinker = async (index: number) => {
    if (!selectedEvent || !selectedDate || !firebaseUser) return;
    const existing = selectedEvent.sessions[index];
    if (existing) {
        setSessionToLink(existing);
        setIsLinkerOpen(true);
        return;
    }
    // No session doc yet for this slot — create one first so the link targets the right sub-workout.
    try {
        const dayStart = startOfDay(selectedDate);
        const programId = program?.id || 'manual';
        const session = await getOrCreateWorkoutSession(
            firebaseUser.uid,
            programId,
            dayStart,
            selectedEvent.workouts[index],
            false,
            undefined,
            index,
            selectedEvent.workouts.length,
        );
        setSessionToLink(session);
        setIsLinkerOpen(true);
    } catch (error) {
        console.error('Failed to prepare session for Strava link:', error);
        toast({ title: 'Error', description: 'Could not start linking. Please try again.', variant: 'destructive' });
    }
  };

    const formatDuration = (seconds: number) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) {
            return `${h}h ${m}m`;
        }
        return `${m}m`;
    };

    const formatDistance = (meters: number) => {
        if (!meters) return '0 km';
        const km = meters / 1000;
        return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
    };

    const [program, setProgram] = useState<Program | null>(null);

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workout Calendar</h1>
        <p className="text-muted-foreground">Visualize your active program and track your progress.</p>
      </div>

      <Card>
        <CardContent className="p-2 md:p-6 flex justify-center">
          {loading ? (
            <div className="space-y-4 w-full max-w-md">
              <Skeleton className="h-[300px] w-full" />
            </div>
          ) : (
            <Suspense fallback={<Skeleton className="h-[300px] w-full" />}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                className="rounded-md"
                components={{
                  DayContent: ({ date }) => {
                    const event = workoutEvents.find(e => isSameDay(e.date, date));
                    if (event && !event.isRestDay) {
                      // One dot per sub-workout scheduled that day (e.g. Run + Weight Training),
                      // each colored by its own completion status, so multi-session days are
                      // visible at a glance without opening the day.
                      return (
                        <div className="relative h-full w-full flex items-center justify-center">
                          <span className="relative z-10">{date.getDate()}</span>
                          <div className="absolute bottom-1 flex items-center gap-0.5">
                            {event.workouts.map((workout, i) => {
                              const session = event.sessions[i];
                              const isCompleted = !!session?.finishedAt && !session?.skipped;
                              const dotColor = getEventColor(workout, isCompleted, event.isMissed && !isCompleted);
                              return <div key={i} className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />;
                            })}
                          </div>
                        </div>
                      );
                    }
                    return <span>{date.getDate()}</span>;
                  },
                }}
              />
            </Suspense>
          )}
          <div className="flex flex-wrap justify-center gap-4 pt-2 pb-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-green-500 inline-block" /> Completed</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-red-400 inline-block" /> Missed</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-400 inline-block" /> Easy / Recovery Run</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-yellow-500 inline-block" /> Tempo Run</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block" /> Intervals</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-blue-600 inline-block" /> Long Run</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-purple-500 inline-block" /> Strength</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-pink-500 inline-block" /> Conditioning</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-teal-500 inline-block" /> Hybrid</span>
          </div>
        </CardContent>
      </Card>

      {selectedEvent && selectedDate && (
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-accent-foreground">
              {format(selectedDate, "EEEE, MMMM do")}
            </p>
            {selectedEvent.workouts.length > 1 && (
              <CardDescription>{selectedEvent.workouts.length} sessions scheduled today</CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {selectedEvent.workouts.map((workout, index) => {
              const session = selectedEvent.sessions[index];
              const isCompleted = !!session?.finishedAt && !session?.skipped;
              const isPastOrToday = isToday(selectedDate) || isPast(selectedDate);
              const isUnfinished = !!session && !session.finishedAt && !session.skipped;
              const isNotDone = !session || isUnfinished;
              const showMarkDone = isPastOrToday && isNotDone && !selectedEvent.isRestDay;
              // Swapping only handles single-session days cleanly on both ends — guard against
              // corrupting a multi-session day's sub-workout bookkeeping on either side of the swap.
              const showDoToday = index === 0 && selectedEvent.workouts.length === 1 && !isToday(selectedDate) && !session && !!program
                  && (!todaysEvent || todaysEvent.workouts.length <= 1);
              const showLinkStrava = !session || (!session.stravaId && !session.skipped);
              const isEditingNotes = editingNotesIndex === index;

              return (
                <div key={index} className={index > 0 ? 'pt-6 border-t' : ''}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      {selectedEvent.workouts.length > 1 && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session {index + 1} of {selectedEvent.workouts.length}</p>
                      )}
                      <CardTitle className="text-lg">
                        {session?.stravaActivity?.name || workout.title}
                      </CardTitle>
                    </div>
                    {isCompleted ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shrink-0">Completed</Badge>
                    ) : session?.skipped ? (
                      <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 shrink-0">Skipped</Badge>
                    ) : selectedEvent.isMissed ? (
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shrink-0">Missed</Badge>
                    ) : (() => {
                      const hasR = hasRuns(workout);
                      const hasE = hasExercises(workout);
                      if (hasR && hasE) return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 shrink-0">Hybrid</Badge>;
                      if (hasR) {
                        const t = (workout as RunningWorkout).runs[0]?.type;
                        if (t === 'intervals') return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 shrink-0">Intervals</Badge>;
                        if (t === 'tempo') return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 shrink-0">Tempo Run</Badge>;
                        if (t === 'long') return <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 shrink-0">Long Run</Badge>;
                        return <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200 shrink-0">Easy Run</Badge>;
                      }
                      const firstSessionType = hasE ? (workout as Workout).exercises[0]?.sessionType : undefined;
                      if (firstSessionType === 'cardio') return <Badge variant="outline" className="bg-pink-50 text-pink-700 border-pink-200 shrink-0">Conditioning</Badge>;
                      return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 shrink-0">Strength</Badge>;
                    })()}
                  </div>

                  {isCompleted && (
                    <p className="text-xs text-muted-foreground mt-1">{formatSessionDate(session!)}</p>
                  )}

                  <div className="mt-3">
                    {session?.stravaActivity ? (
                        <div className="flex items-center justify-around p-4 border rounded-lg bg-muted/50">
                            <div className="text-center">
                                <div className="text-2xl font-bold">{formatDistance(session.stravaActivity.distance || 0)}</div>
                                <div className="text-xs text-muted-foreground">DISTANCE</div>
                            </div>
                             <div className="text-center">
                                <div className="text-2xl font-bold">{formatDuration(session.stravaActivity.moving_time || 0)}</div>
                                <div className="text-xs text-muted-foreground">TIME</div>
                            </div>
                        </div>
                    ) : session?.finishedAt ? (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Completed Items</h4>
                        {getCompletedExercises(session.workoutDetails ?? workout).length > 0 ? (
                          <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
                            {getCompletedExercises(session.workoutDetails ?? workout).map((exercise, i) => (
                              <li key={i}>
                                <span className="font-medium text-foreground">{exercise.name}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground">No completed items details available for this session.</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        <h4 className="font-semibold mb-2 text-sm">Planned Workout</h4>
                        <div className="space-y-3">
                          {hasRuns(workout) && workout.runs.map((run, i) => (
                              <div key={i} className="space-y-1">
                                <p className="text-sm font-medium text-foreground">{formatPlannedRun(run)}</p>
                              </div>
                          ))}
                          {hasExercises(workout) && (workout.exercises ?? []).map((exercise, i) => {
                              const formattedDetails = formatTextWithBullets(exercise.details);
                              return (
                                <div key={i} className="space-y-1">
                                  <p className="text-sm font-medium text-foreground">{exercise.name}</p>
                                  {formattedDetails.map((line, lineIndex) => (
                                    <p key={lineIndex} className="text-xs text-muted-foreground whitespace-pre-wrap ml-4">
                                      {line}
                                    </p>
                                  ))}
                                </div>
                              );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  {session && (
                    <div className="mt-4 pt-4 border-t">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-semibold text-sm">Your Notes</h4>
                            {!isEditingNotes && (
                                <Button variant="ghost" size="sm" onClick={() => setEditingNotesIndex(index)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                </Button>
                            )}
                        </div>
                        {isEditingNotes ? (
                            <div className="space-y-2">
                                <Textarea
                                    value={notesByIndex[index] ?? ''}
                                    onChange={(e) => handleNotesChange(index, e.target.value)}
                                    placeholder="Add notes about your workout..."
                                    rows={3}
                                />
                                <Button size="sm" onClick={() => handleSaveNotes(index)}>Save Notes</Button>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground border-l-2 pl-4 italic min-h-[32px]">
                                {notesByIndex[index] || 'No notes for this workout.'}
                            </p>
                        )}
                    </div>
                  )}

                  {(showMarkDone || showDoToday || showLinkStrava) && (
                    <div className="pt-4 mt-4 border-t flex flex-col gap-2">
                      {showMarkDone && (
                          <Button
                              variant="default"
                              className="w-full"
                              onClick={() => handleMarkDone(index)}
                              disabled={markingDoneIndex === index}
                          >
                              {markingDoneIndex === index
                                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  : <CheckCircle className="mr-2 h-4 w-4" />
                              }
                              Mark as Completed
                          </Button>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2">
                          {showDoToday && (
                              <Button
                                  variant="accent"
                                  className="w-full"
                                  onClick={handleDoToday}
                              >
                                  <Forward className="mr-2 h-4 w-4" />
                                  Do This Workout Today
                              </Button>
                          )}
                          {showLinkStrava && (
                              <Button
                                  variant="outline"
                                  size={session ? 'sm' : 'default'}
                                  className="w-full"
                                  onClick={() => handleOpenLinker(index)}
                              >
                                  <LinkIcon className="mr-2 h-4 w-4" />
                                  Link Strava Activity
                              </Button>
                          )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {workoutEvents.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              No workout data found. Complete some workouts or start a program to see them here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
    {sessionToLink && (
        <Suspense fallback={null}>
          <LinkStravaActivityDialog
              isOpen={isLinkerOpen}
              setIsOpen={setIsLinkerOpen}
              session={sessionToLink}
              onLinkSuccess={handleLinkSuccess}
          />
        </Suspense>
    )}
    </>
  );
}
