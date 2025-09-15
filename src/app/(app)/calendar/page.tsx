// src/app/(app)/calendar/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getWorkoutForDay } from '@/lib/workout-utils';
import { getAllUserSessions } from '@/services/session-service-client';
import type { User, Program, Workout, WorkoutSession, RunningWorkout, Exercise } from '@/models/types';
import { addDays, format, isSameDay, parseISO, isValid } from 'date-fns';
import { LinkStravaActivityDialog } from '@/components/link-strava-activity-dialog';
import { Button } from '@/components/ui/button';
import { Link as LinkIcon, Activity, Clock, MapPin } from 'lucide-react';

interface WorkoutEvent {
  date: Date;
  workout?: Workout | RunningWorkout;
  session?: WorkoutSession;
  type: 'programmed' | 'completed' | 'both';
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [workoutEvents, setWorkoutEvents] = useState<WorkoutEvent[]>([]);
  const [isLinkerOpen, setIsLinkerOpen] = useState(false);
  const [sessionToLink, setSessionToLink] = useState<WorkoutSession | null>(null);

  const selectedEvent = workoutEvents.find(event => 
    selectedDate && isSameDay(event.date, selectedDate)
  );

  const selectedWorkout = selectedEvent?.workout;
  const completedSession = selectedEvent?.session;

  const fetchCalendarData = async (firebaseUser: any) => {
    try {
      const user = await getUserClient(firebaseUser.uid);
      const sessions = await getAllUserSessions(firebaseUser.uid);
      
      let program = null;
      if (user?.programId && user.startDate) {
        program = await getProgramClient(user.programId);
      }
      
      generateWorkoutEvents(program, user?.startDate, sessions);
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
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            await fetchCalendarData(firebaseUser);
          } else {
            setLoading(false);
          }
        });
        return unsubscribe;
      } catch (error) {
        console.error('❌ Calendar initialization error:', error);
        setLoading(false);
      }
    };

    let unsubscribe: () => void;
    initialize().then(unsub => unsubscribe = unsub);

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  const generateWorkoutEvents = (program: Program | null, startDate: Date | undefined, sessions: WorkoutSession[]) => {
    const events: WorkoutEvent[] = [];
    
    // Create a map of sessions by date for quick lookup
    const sessionsMap = new Map<string, WorkoutSession>();
    sessions.forEach(session => {
        let sessionDate: Date;
        // Use finishedAt for completed workouts, otherwise workoutDate
        const dateSource = session.finishedAt || session.workoutDate;

        if (dateSource instanceof Date) {
          sessionDate = new Date(dateSource);
        } else {
          sessionDate = parseISO(dateSource.toString());
        }

        if (isValid(sessionDate)) {
            const dateKey = format(sessionDate, 'yyyy-MM-dd');
            sessionsMap.set(dateKey, session);
        }
    });

    // Add programmed workouts if a program is active
    if (program && startDate) {
      const normalizedStartDate = new Date(startDate);
      normalizedStartDate.setHours(0, 0, 0, 0);
      
      const programDuration = Math.max(...program.workouts.map(w => w.day), 0);

      // We generate events for the whole duration of the program
      for (let i = 0; i < programDuration; i++) {
        const currentDate = addDays(normalizedStartDate, i);
        const dateKey = format(currentDate, 'yyyy-MM-dd');
        const { workout } = getWorkoutForDay(program, normalizedStartDate, currentDate);
        const session = sessionsMap.get(dateKey);
        
        if (workout || session) {
          events.push({
            date: currentDate,
            workout: workout || session?.workoutDetails || undefined,
            session: session,
            type: workout && session?.finishedAt ? 'both' : (session?.finishedAt ? 'completed' : 'programmed')
          });
          // Remove from map to avoid duplication
          if (session) {
            sessionsMap.delete(dateKey);
          }
        }
      }
    }
    
    // Add any remaining completed sessions that were not part of the active program
    sessionsMap.forEach((session, dateKey) => {
        // Use an ISO date string with a time component to avoid timezone issues
        const eventDate = parseISO(`${dateKey}T12:00:00.000Z`);
        events.push({
            date: eventDate,
            session: session,
            workout: session.workoutDetails,
            type: 'completed'
        });
    });

    setWorkoutEvents(events);
  };

  const getCompletedExercises = (session: WorkoutSession): { name: string, details: string }[] => {
    if (session.workoutDetails) {
        const items = session.workoutDetails.programType === 'running' ? session.workoutDetails.runs : session.workoutDetails.exercises;
        return items.map((item: any) => ({
            name: item.name || item.description,
            details: item.details || 'Completed'
        }));
    }
    
    if (!session.completedItems) return [];
    const items: { name: string, details: string }[] = [];
    for (const itemName in session.completedItems) {
      if (session.completedItems[itemName]) {
        items.push({ name: itemName, details: 'Completed' });
      }
    }
    return items;
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
  
    // Helper to format duration from seconds to HH:MM
    const formatDuration = (seconds: number) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) {
            return `${h}h ${m}m`;
        }
        return `${m}m`;
    };

    // Helper to format distance from meters to km or m
    const formatDistance = (meters: number) => {
        if (!meters) return '0 km';
        const km = meters / 1000;
        return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
    };


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
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md"
              components={{
                DayContent: ({ date }) => {
                  const event = workoutEvents.find(e => isSameDay(e.date, date));
                  if (event) {
                    let badgeColor = "bg-gray-400";
                    
                    switch (event.type) {
                      case 'completed': badgeColor = "bg-green-500"; break;
                      case 'programmed': badgeColor = "bg-blue-500"; break;
                      case 'both': badgeColor = "bg-primary"; break;
                    }
                    
                    return (
                      <div className="relative h-full w-full flex items-center justify-center">
                        <span className="relative z-10">{date.getDate()}</span>
                        <div
                          className={`absolute bottom-1 h-1.5 w-1.5 rounded-full ${badgeColor}`}
                        />
                      </div>
                    );
                  }
                  return <span>{date.getDate()}</span>;
                },
              }}
            />
          )}
        </CardContent>
      </Card>

      {selectedEvent && selectedDate && (
        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-accent-foreground">
              {format(selectedDate, "EEEE, MMMM do")}
            </p>
            <CardTitle>
              {completedSession?.stravaActivity?.name || completedSession?.workoutTitle || selectedWorkout?.title || 'Workout Details'}
            </CardTitle>
            {completedSession?.finishedAt ? (
              <div className="space-y-2 mt-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Completed
                </Badge>
                <CardDescription>
                  {formatSessionDate(completedSession)}
                </CardDescription>
              </div>
            ) : (
               <div className="mt-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 w-fit">
                    Planned
                </Badge>
               </div>
            )}
          </CardHeader>
          <CardContent>
            {completedSession?.stravaActivity ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-around p-4 border rounded-lg bg-muted/50">
                        <div className="text-center">
                            <div className="text-2xl font-bold">{formatDistance(completedSession.stravaActivity.distance || 0)}</div>
                            <div className="text-xs text-muted-foreground">DISTANCE</div>
                        </div>
                         <div className="text-center">
                            <div className="text-2xl font-bold">{formatDuration(completedSession.stravaActivity.moving_time || 0)}</div>
                            <div className="text-xs text-muted-foreground">TIME</div>
                        </div>
                    </div>
                     {completedSession.notes && (
                        <div>
                            <h4 className="font-semibold mb-2">Your Notes</h4>
                            <p className="text-sm text-muted-foreground border-l-2 pl-4 italic">
                            {completedSession.notes}
                            </p>
                        </div>
                    )}
                </div>
            ) : completedSession?.finishedAt ? (
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Completed Items</h4>
                  {getCompletedExercises(completedSession).length > 0 ? (
                    <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                      {getCompletedExercises(completedSession).map((exercise, index) => (
                        <li key={index}>
                          <span className="font-medium text-foreground">{exercise.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No completed items details available for this session.</p>
                  )}
                </div>
                {completedSession.notes && (
                  <div>
                    <h4 className="font-semibold mb-2">Your Notes</h4>
                    <p className="text-sm text-muted-foreground border-l-2 pl-4 italic">
                      {completedSession.notes}
                    </p>
                  </div>
                )}
              </div>
            ) : selectedWorkout ? (
              <div>
                <h4 className="font-semibold mb-2">Planned Workout</h4>
                <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                  {selectedWorkout.programType === 'running' 
                    ? (selectedWorkout as RunningWorkout).runs.map((run, index) => (
                        <li key={index}>
                          <span className="font-medium text-foreground">{run.description}</span>
                        </li>
                      ))
                    : (selectedWorkout as Workout).exercises.map((exercise, index) => (
                        <li key={index}>
                          <span className="font-medium text-foreground">{exercise.name}:</span> {exercise.details}
                        </li>
                      ))
                  }
                </ul>
              </div>
            ) : null}

             {selectedWorkout && !completedSession && (
                <div className="pt-4 mt-4 border-t">
                    <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                            // Create a temporary session object to pass to the linker
                            const tempSession = {
                                id: '', // No ID yet, it's just for context
                                userId: '',
                                programId: (selectedEvent as any)?.program?.id || '',
                                workoutDate: selectedDate,
                                workoutTitle: selectedWorkout.title,
                                programType: selectedWorkout.programType,
                                startedAt: new Date(),
                                completedItems: {},
                            };
                            setSessionToLink(tempSession as WorkoutSession);
                            setIsLinkerOpen(true);
                        }}>
                        <LinkIcon className="mr-2" />
                        Link Strava Activity
                    </Button>
                </div>
             )}

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
        <LinkStravaActivityDialog
            isOpen={isLinkerOpen}
            setIsOpen={setIsLinkerOpen}
            session={sessionToLink}
            onLinkSuccess={handleLinkSuccess}
        />
    )}
    </>
  );
}
