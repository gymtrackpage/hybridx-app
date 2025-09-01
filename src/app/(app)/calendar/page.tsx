// src/app/(app)/calendar/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { getUser } from '@/services/user-service';
import { getProgram, getWorkoutForDay } from '@/services/program-service';
import { getAllUserSessions } from '@/services/session-service';
import type { User, Program, Workout, WorkoutSession } from '@/models/types';
import { addDays, format, isSameDay } from 'date-fns';

interface WorkoutEvent {
  date: Date;
  workout: Workout;
  completed: boolean;
}

export default function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [workoutEvents, setWorkoutEvents] = useState<WorkoutEvent[]>([]);
  
  const selectedWorkout = workoutEvents.find(event => 
    selectedDate && isSameDay(event.date, selectedDate)
  )?.workout;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await getUser(firebaseUser.uid);
        if (user?.programId && user.startDate) {
          const program = await getProgram(user.programId);
          const sessions = await getAllUserSessions(firebaseUser.uid);
          if (program) {
            generateWorkoutEvents(program, user.startDate, sessions);
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const generateWorkoutEvents = (program: Program, startDate: Date, sessions: WorkoutSession[]) => {
    const events: WorkoutEvent[] = [];
    
    // Normalize start date to avoid timezone issues
    const normalizedStartDate = new Date(startDate);
    normalizedStartDate.setUTCHours(0, 0, 0, 0);

    // Create a lookup map for completed sessions for efficient access
    const completedSessionsMap = new Map<string, boolean>();
    sessions.forEach(session => {
        if (session.finishedAt) {
            const sessionDate = new Date(session.workoutDate);
            sessionDate.setUTCHours(0, 0, 0, 0);
            completedSessionsMap.set(sessionDate.toISOString(), true);
        }
    });

    // Generate events for a full year
    for (let i = 0; i < 365; i++) {
        const currentDate = addDays(normalizedStartDate, i);
        currentDate.setUTCHours(0, 0, 0, 0);

        const { workout } = getWorkoutForDay(program, normalizedStartDate, currentDate);
        
        if (workout) {
            const isCompleted = completedSessionsMap.has(currentDate.toISOString());
            events.push({
                date: currentDate,
                workout: workout,
                completed: isCompleted,
            });
        }
    }
    setWorkoutEvents(events);
  };


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
                                            variant={event.completed ? "default" : "secondary"}
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

        {selectedWorkout && selectedDate && (
             <Card>
                <CardHeader>
                    <p className="text-sm font-medium text-accent-foreground">{format(selectedDate, "EEEE, MMMM do")}</p>
                    <CardTitle>{selectedWorkout.title}</CardTitle>
                </CardHeader>
                <CardContent>
                     <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
                        {selectedWorkout.exercises.map((exercise, index) => (
                            <li key={index}>
                                <span className="font-medium text-foreground">{exercise.name}:</span> {exercise.details}
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        )}
    </div>
  );
}
