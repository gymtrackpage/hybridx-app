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
  const [debugInfo, setDebugInfo] = useState<any>(null);
  
  const selectedEvent = workoutEvents.find(event => 
    selectedDate && isSameDay(event.date, selectedDate)
  );

  const selectedWorkout = selectedEvent?.workout;
  const completedSession = selectedEvent?.session;

  useEffect(() => {
    const initialize = async () => {
      try {
        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            console.log('📅 Loading calendar data for user:', firebaseUser.uid);
            
            const user = await getUserClient(firebaseUser.uid);
            console.log('👤 User data:', user);
            
            const sessions = await getAllUserSessions(firebaseUser.uid);
            console.log('📊 Found sessions:', sessions.length, sessions);
            
            let program = null;
            if (user?.programId && user.startDate) {
              program = await getProgramClient(user.programId);
              console.log('📋 Program data:', program);
            }
            
            generateWorkoutEvents(program, user?.startDate, sessions);
          } else {
            console.log('❌ No authenticated user');
          }
          setLoading(false);
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
    console.log('🔄 Generating workout events...');
    const events: WorkoutEvent[] = [];
    
    // Create a map of completed sessions by date
    const sessionsMap = new Map<string, WorkoutSession>();
    
    sessions.forEach(session => {
      if (session.finishedAt) {
        // Handle different date formats
        let sessionDate: Date;
        
        if (session.workoutDate instanceof Date) {
          sessionDate = new Date(session.workoutDate);
        } else if (typeof session.workoutDate === 'string') {
          sessionDate = parseISO(session.workoutDate);
        } else if (session.workoutDate && typeof (session.workoutDate as any).toDate === 'function') {
          // Firestore Timestamp
          sessionDate = (session.workoutDate as any).toDate();
        } else {
          console.warn('⚠️ Invalid session date format:', session.workoutDate);
          return;
        }

        if (!isValid(sessionDate)) {
          console.warn('⚠️ Invalid session date:', session.workoutDate);
          return;
        }

        // Normalize to start of day in local timezone
        const normalizedDate = new Date(sessionDate.getFullYear(), sessionDate.getMonth(), sessionDate.getDate());
        const dateKey = normalizedDate.toISOString().split('T')[0];
        
        console.log('📅 Adding session for date:', dateKey, session);
        sessionsMap.set(dateKey, session);
      }
    });

    // Add programmed workouts if available
    if (program && startDate) {
      const normalizedStartDate = new Date(startDate);
      normalizedStartDate.setHours(0, 0, 0, 0);

      for (let i = 0; i < 365; i++) {
        const currentDate = addDays(normalizedStartDate, i);
        currentDate.setHours(0, 0, 0, 0);
        
        const dateKey = currentDate.toISOString().split('T')[0];
        const { workout } = getWorkoutForDay(program, normalizedStartDate, currentDate);
        const session = sessionsMap.get(dateKey);
        
        if (workout || session) {
          const eventType: 'programmed' | 'completed' | 'both' = 
            workout && session ? 'both' : 
            workout ? 'programmed' : 'completed';
            
          events.push({
            date: currentDate,
            workout: workout || undefined,
            session: session,
            type: eventType
          });
          // Remove the session from the map so it's not added twice
          if (session) {
            sessionsMap.delete(dateKey);
          }
        }
      }
    }
    
    // Add any remaining completed sessions that were not part of the program
    console.log('📝 Adding non-programmed completed sessions');
    sessionsMap.forEach((session, dateKey) => {
        const eventDate = new Date(dateKey + 'T00:00:00');
        events.push({
            date: eventDate,
            session: session,
            type: 'completed'
        });
    });


    console.log('✅ Generated events:', events.length, events);
    setWorkoutEvents(events);
    
    // Debug info
    setDebugInfo({
      sessionsCount: sessions.length,
      eventsCount: events.length,
      hasProgram: !!program,
      hasStartDate: !!startDate,
      sessionsMapSize: sessionsMap.size,
      sampleSession: sessions[0]
    });
  };

  const getCompletedExercises = (session: WorkoutSession): { name: string, details: string }[] => {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workout Calendar</h1>
        <p className="text-muted-foreground">Visualize your active program and track your progress.</p>
      </div>

      {/* Debug Info (remove in production) */}
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader>
            <CardTitle className="text-sm">Debug Info</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs overflow-auto max-h-48">{JSON.stringify(debugInfo, null, 2)}</pre>
          </CardContent>
        </Card>
      )}

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
                    let badgeColor = "bg-gray-400"; // default
                    
                    switch (event.type) {
                      case 'completed':
                        badgeColor = "bg-green-500"; // Completed sessions
                        break;
                      case 'programmed':
                        badgeColor = "bg-blue-500"; // Planned workouts
                        break;
                      case 'both':
                        badgeColor = "bg-primary"; // Both planned and completed
                        break;
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
              {completedSession?.workoutTitle || selectedWorkout?.title || 'Completed Workout'}
            </CardTitle>
            {completedSession && (
              <div className="space-y-2 mt-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  Completed
                </Badge>
                <CardDescription>
                  {formatSessionDate(completedSession)}
                </CardDescription>
              </div>
            )}
            {!completedSession && selectedWorkout && (
               <div className="mt-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 w-fit">
                    Planned
                </Badge>
               </div>
            )}
          </CardHeader>
          <CardContent>
            {completedSession ? (
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
  );
}
