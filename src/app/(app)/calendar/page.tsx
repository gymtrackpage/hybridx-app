
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
import { addDays, format, isSameDay } from 'date-fns';

interface WorkoutEvent {
  date: Date;
  workout: Workout | RunningWorkout;
  session?: WorkoutSession;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [workoutEvents, setWorkoutEvents] = useState<WorkoutEvent[]>([]);
  
  const selectedEvent = workoutEvents.find(event => 
    selectedDate && isSameDay(event.date, selectedDate)
  );

  const selectedWorkout = selectedEvent?.workout;
  const completedSession = selectedEvent?.session;

  useEffect(() => {
    const initialize = async () => {
        const auth = await getAuthInstance();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
            const user = await getUserClient(firebaseUser.uid);
            if (user?.programId && user.startDate) {
            const program = await getProgramClient(user.programId);
            const sessions = await getAllUserSessions(firebaseUser.uid);
            if (program) {
                generateWorkoutEvents(program, user.startDate, sessions);
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
  }, []);

  const generateWorkoutEvents = (program: Program, startDate: Date, sessions: WorkoutSession[]) => {
    const events: WorkoutEvent[] = [];
    
    const normalizedStartDate = new Date(startDate);
    normalizedStartDate.setUTCHours(0, 0, 0, 0);

    const sessionsMap = new Map<string, WorkoutSession>();
    sessions.forEach(session => {
        if (session.finishedAt) {
            const sessionDate = new Date(session.workoutDate);
            sessionDate.setUTCHours(0, 0, 0, 0);
            sessionsMap.set(sessionDate.toISOString(), session);
        }
    });

    for (let i = 0; i < 365; i++) {
        const currentDate = addDays(normalizedStartDate, i);
        currentDate.setUTCHours(0, 0, 0, 0);

        const { workout } = getWorkoutForDay(program, normalizedStartDate, currentDate);
        
        if (workout) {
            const session = sessionsMap.get(currentDate.toISOString());
            events.push({
                date: currentDate,
                workout: workout,
                session: session,
            });
        }
    }
    setWorkoutEvents(events);
  };

  const getCompletedExercises = (session: WorkoutSession): (Exercise | { name: string, details: string })[] => {
      if (!session.completedItems) return [];
      
      const items: (Exercise | { name: string, details: string })[] = [];
      for (const itemName in session.completedItems) {
          if (session.completedItems[itemName]) {
              items.push({ name: itemName, details: 'Completed' });
          }
      }
      return items;
  }


  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workout Calendar</h1>
            <p className="text-muted-foreground">Visualize your active program and track your progress.</p>
        </div>
        <Card>
            <CardContent className="p-2 md:p-6 flex justify-center">
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-[250px] w-full" />
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
                                    return (
                                    <div className="relative h-full w-full flex items-center justify-center">
                                        <span className="relative z-10">{date.getDate()}</span>
                                        <Badge
                                            variant={event.session?.finishedAt ? "default" : "secondary"}
                                            className="absolute bottom-1 h-1.5 w-1.5 p-0 rounded-full bg-primary"
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
                    <p className="text-sm font-medium text-accent-foreground">{format(selectedDate, "EEEE, MMMM do")}</p>
                    <CardTitle>{completedSession?.workoutTitle || selectedWorkout?.title}</CardTitle>
                    {completedSession && (
                        <CardDescription>
                            Workout completed on {format(completedSession.finishedAt!, "MMMM do, yyyy 'at' h:mm a")}
                        </CardDescription>
                    )}
                </CardHeader>
                <CardContent>
                     {completedSession ? (
                         <div className="space-y-4">
                             <div>
                                 <h4 className="font-semibold mb-2">Completed Exercises</h4>
                                 <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                                     {getCompletedExercises(completedSession).map((exercise, index) => (
                                         <li key={index}>
                                             <span className="font-medium text-foreground">{exercise.name}</span>
                                         </li>
                                     ))}
                                 </ul>
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
                     ) : null}
                </CardContent>
            </Card>
        )}
    </div>
  );
}
