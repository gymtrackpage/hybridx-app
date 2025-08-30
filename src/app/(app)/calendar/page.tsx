'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { auth } from '@/lib/firebase';
import { getUser } from '@/services/user-service';
import { getProgram } from '@/services/program-service';
import type { User, Program } from '@/models/types';
import { addDays, format } from 'date-fns';

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [loading, setLoading] = useState(true);
  const [workoutEvents, setWorkoutEvents] = useState<{ [key: string]: { type: string, completed: boolean } }>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const user = await getUser(firebaseUser.uid);
        if (user?.programId && user.startDate) {
          const program = await getProgram(user.programId);
          if (program) {
            generateWorkoutEvents(program, user.startDate);
          }
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const generateWorkoutEvents = (program: Program, startDate: Date) => {
    const events: { [key: string]: { type: string, completed: boolean } } = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    program.workouts.forEach(workout => {
      // Assuming program runs for a year for simplicity. In a real app, you might have an end date.
      for (let i = 0; i < 365; i++) {
        if ((i + 1) % program.workouts.length === workout.day % program.workouts.length) {
            const workoutDate = addDays(startDate, i);
            const dateKey = format(workoutDate, 'yyyy-MM-dd');
            
            // For now, mark as completed if the date is in the past.
            const completed = workoutDate < today;

            events[dateKey] = {
                type: workout.title,
                completed: completed,
            };
        }
      }
    });
    setWorkoutEvents(events);
  };


  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workout Calendar</h1>
            <p className="text-muted-foreground">Visualize your active program and track your progress.</p>
        </div>
        <Card>
            <CardContent className="p-2 md:p-6">
                {loading ? (
                    <div className="space-y-4">
                        <Skeleton className="h-[250px] w-full" />
                    </div>
                ) : (
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={setDate}
                        className="rounded-md"
                        components={{
                            DayContent: ({ date }) => {
                                const event = workoutEvents[format(date, 'yyyy-MM-dd')];
                                if (event) {
                                    return (
                                    <div className="relative h-full w-full flex items-center justify-center">
                                        <span className="relative z-10">{date.getDate()}</span>
                                        <Badge
                                        variant={event.completed ? "secondary" : "default"}
                                        className="absolute bottom-1 h-2 w-2 p-0 rounded-full"
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
    </div>
  );
}
