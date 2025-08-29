'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Mock data for scheduled/completed workouts
const workoutEvents: { [key: string]: { type: string, completed: boolean } } = {
  '2024-08-05': { type: 'Strength', completed: true },
  '2024-08-07': { type: 'Endurance', completed: true },
  '2024-08-09': { type: 'Hybrid', completed: true },
  '2024-08-12': { type: 'Strength', completed: true },
  '2024-08-14': { type: 'Endurance', completed: false },
  '2024-08-16': { type: 'Hybrid', completed: false },
  '2024-08-19': { type: 'Strength', completed: false },
  '2024-08-21': { type: 'Endurance', completed: false },
};

export default function CalendarPage() {
  const [date, setDate] = useState<Date | undefined>(new Date());

  const getDayKey = (d: Date) => d.toISOString().split('T')[0];

  return (
    <div className="space-y-6">
        <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Workout Calendar</h1>
            <p className="text-muted-foreground">Visualize your active program and track your progress.</p>
        </div>
        <Card>
            <CardContent className="p-2 md:p-6">
                <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    className="rounded-md"
                    components={{
                        DayContent: ({ date }) => {
                            const event = workoutEvents[getDayKey(date)];
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
            </CardContent>
        </Card>
    </div>
  );
}
