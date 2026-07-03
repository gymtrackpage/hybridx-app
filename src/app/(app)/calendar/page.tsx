// src/app/(app)/calendar/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getWorkoutForDay } from '@/lib/workout-utils';
import { getAllUserSessions } from '@/services/session-service-client';
import { saveScheduleChanges } from '@/services/session-service';
import type { Program, WorkoutDay, WorkoutSession, RunningWorkout, Workout, UnitSystem } from '@/models/types';
import { hasRuns, hasExercises } from '@/lib/type-guards';
import { convertDistance } from '@/lib/unit-conversion';
import { addDays, format, isSameDay, startOfDay, endOfWeek } from 'date-fns';
import { RotateCcw, Loader2, CheckCircle2, XCircle, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DaySlot {
  date: Date;
  dateKey: string;
  workouts: WorkoutDay[];
  sessions: WorkoutSession[];
  isToday: boolean;
}

function isRestDayWorkout(workout: WorkoutDay): boolean {
  const t = workout.title.toLowerCase();
  return t.includes('rest') || t.includes('recover');
}

function workoutAccentClass(workout: WorkoutDay): string {
  if (hasRuns(workout) && hasExercises(workout)) return 'border-l-teal-500';
  if (hasRuns(workout)) {
    switch ((workout as RunningWorkout).runs[0]?.type) {
      case 'intervals': return 'border-l-orange-500';
      case 'tempo': return 'border-l-yellow-500';
      case 'long': return 'border-l-blue-600';
      case 'easy':
      case 'recovery': return 'border-l-blue-400';
      default: return 'border-l-blue-500';
    }
  }
  if (hasExercises(workout)) {
    return (workout as Workout).exercises[0]?.sessionType === 'cardio' ? 'border-l-pink-500' : 'border-l-purple-500';
  }
  return 'border-l-gray-400';
}

function summarizeWorkout(workout: WorkoutDay, unitSystem?: UnitSystem): string {
  if (hasRuns(workout)) {
    const totalKm = (workout as RunningWorkout).runs.reduce((sum, r) => sum + (r.distance || 0), 0);
    return convertDistance(totalKm, unitSystem ?? 'metric');
  }
  if (hasExercises(workout)) {
    const n = (workout as Workout).exercises.length;
    return `${n} exercise${n === 1 ? '' : 's'}`;
  }
  return '';
}

function buildDaySlots(program: Program, startDate: Date, sessions: WorkoutSession[], rangeStart: Date, rangeEnd: Date): DaySlot[] {
  const sessionsByDate = new Map<string, WorkoutSession[]>();
  sessions.forEach(s => {
    const key = format(startOfDay(s.workoutDate), 'yyyy-MM-dd');
    const list = sessionsByDate.get(key) ?? [];
    list.push(s);
    sessionsByDate.set(key, list);
  });
  sessionsByDate.forEach(list => list.sort((a, b) => (a.sessionIndex ?? 0) - (b.sessionIndex ?? 0)));

  const today0 = startOfDay(new Date());
  const slots: DaySlot[] = [];
  let cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const dateKey = format(cursor, 'yyyy-MM-dd');
    const persisted = sessionsByDate.get(dateKey);
    // A persisted doc for the date (even a content-less "cleared" one) is fully authoritative —
    // it never partially falls back to the program's original schedule for that date.
    const workouts = persisted
      ? persisted.map(s => s.workoutDetails).filter((w): w is WorkoutDay => !!w)
      : getWorkoutForDay(program, startDate, cursor).sessions;

    slots.push({
      date: new Date(cursor),
      dateKey,
      workouts,
      sessions: persisted ?? [],
      isToday: isSameDay(cursor, today0),
    });
    cursor = addDays(cursor, 1);
  }
  return slots;
}

const MAX_WEEKS = 16;

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | undefined>(undefined);
  const [programStartDate, setProgramStartDate] = useState<Date | null>(null);
  const [daySlots, setDaySlots] = useState<DaySlot[]>([]);
  const [originalByKey, setOriginalByKey] = useState<Map<string, WorkoutDay[]>>(new Map());
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [activeDrag, setActiveDrag] = useState<{ dateKey: string; workout: WorkoutDay } | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const loadCalendarData = useCallback(async (fbUser: FirebaseUser) => {
    try {
      const user = await getUserClient(fbUser.uid);
      setUnitSystem(user?.unitSystem);

      let userProgram: Program | null = null;
      if (user?.programId && user.startDate) {
        userProgram = user.customProgram
          ? ({ id: user.programId, workouts: user.customProgram } as Program)
          : await getProgramClient(user.programId);
      }
      setProgram(userProgram);

      if (!userProgram || !user?.startDate) {
        setDaySlots([]);
        setOriginalByKey(new Map());
        setChangedKeys(new Set());
        return;
      }

      const startDate = startOfDay(new Date(user.startDate));
      setProgramStartDate(startDate);
      const today0 = startOfDay(new Date());
      const rangeStart = today0;
      const cycleLength = Math.max(...userProgram.workouts.map(w => w.day), 0);
      const programEnd = addDays(startDate, Math.max(cycleLength - 1, 0));
      const currentWeekEnd = endOfWeek(today0, { weekStartsOn: 1 });
      const candidateEnd = programEnd > currentWeekEnd ? programEnd : currentWeekEnd;
      const cappedEnd = addDays(rangeStart, MAX_WEEKS * 7 - 1);
      const rangeEnd = candidateEnd < cappedEnd ? candidateEnd : cappedEnd;

      const sessions = await getAllUserSessions(fbUser.uid);
      const slots = buildDaySlots(userProgram, startDate, sessions, rangeStart, rangeEnd);

      setDaySlots(slots);
      setOriginalByKey(new Map(slots.map(s => [s.dateKey, s.workouts])));
      setChangedKeys(new Set());
    } catch (error) {
      console.error('Error fetching calendar data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let unsubscribe: () => void = () => {};
    const initialize = async () => {
      const auth = await getAuthInstance();
      unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
        if (fbUser) {
          setFirebaseUser(fbUser);
          setLoading(true);
          await loadCalendarData(fbUser);
        } else {
          setLoading(false);
        }
      });
    };
    initialize();
    return () => unsubscribe();
  }, [loadCalendarData]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const slot = daySlots.find(d => d.dateKey === event.active.id);
    if (slot && slot.workouts.length === 1) {
      setActiveDrag({ dateKey: slot.dateKey, workout: slot.workouts[0] });
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const sourceKey = String(active.id);
    const targetKey = String(over.id);

    setDaySlots(prev => {
      const sourceSlot = prev.find(d => d.dateKey === sourceKey);
      const targetSlot = prev.find(d => d.dateKey === targetKey);
      if (!sourceSlot || !targetSlot) return prev;
      const sourceWorkouts = sourceSlot.workouts;
      const targetWorkouts = targetSlot.workouts;
      return prev.map(d => {
        if (d.dateKey === sourceKey) return { ...d, workouts: targetWorkouts };
        if (d.dateKey === targetKey) return { ...d, workouts: sourceWorkouts };
        return d;
      });
    });
    setChangedKeys(prev => {
      const next = new Set(prev);
      next.add(sourceKey);
      next.add(targetKey);
      return next;
    });
  };

  const handleResetWeek = (weekKeys: string[]) => {
    setDaySlots(prev => prev.map(d => weekKeys.includes(d.dateKey) ? { ...d, workouts: originalByKey.get(d.dateKey) ?? [] } : d));
    setChangedKeys(prev => {
      const next = new Set(prev);
      weekKeys.forEach(k => next.delete(k));
      return next;
    });
  };

  const handleSave = async () => {
    if (!firebaseUser || !program || changedKeys.size === 0) return;
    setSaving(true);
    try {
      const days = Array.from(changedKeys).map(key => {
        const slot = daySlots.find(d => d.dateKey === key)!;
        return { date: slot.date, workouts: slot.workouts };
      });
      await saveScheduleChanges({ userId: firebaseUser.uid, programId: program.id, days });
      toast({ title: 'Schedule updated', description: 'Your training calendar has been saved.' });
      await loadCalendarData(firebaseUser);
    } catch (error) {
      console.error('Failed to save schedule changes:', error);
      toast({ title: 'Error', description: 'Could not save your changes. Please try again.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const { leadingSlots, weekChunks } = useMemo(() => {
    if (daySlots.length === 0) return { leadingSlots: [] as DaySlot[], weekChunks: [] as DaySlot[][] };
    const leadingEnd = endOfWeek(daySlots[0].date, { weekStartsOn: 1 });
    const leading = daySlots.filter(d => d.date <= leadingEnd);
    const rest = daySlots.filter(d => d.date > leadingEnd);
    const chunks: DaySlot[][] = [];
    for (let i = 0; i < rest.length; i += 7) {
      chunks.push(rest.slice(i, i + 7));
    }
    return { leadingSlots: leading, weekChunks: chunks };
  }, [daySlots]);

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Training Calendar</h1>
          <p className="text-muted-foreground">Drag workouts between days to rearrange your week.</p>
        </div>
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">Assign a program in your profile to see and rearrange your training calendar.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-6 max-w-2xl mx-auto pb-24">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Training Calendar</h1>
            <p className="text-muted-foreground">Long-press and drag a workout onto another day to reschedule it.</p>
          </div>
          <Button onClick={handleSave} disabled={changedKeys.size === 0 || saving} className={cn(changedKeys.size === 0 && 'opacity-50')}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save{changedKeys.size > 0 ? ` (${changedKeys.size})` : ''}
          </Button>
        </div>

        {daySlots.length === 0 ? (
          <Card><CardContent className="text-center py-12"><p className="text-muted-foreground">No upcoming schedule found.</p></CardContent></Card>
        ) : (
          <>
            <div className="rounded-lg border overflow-hidden divide-y">
              {leadingSlots.map(day => (
                <DayRow key={day.dateKey} day={day} unitSystem={unitSystem} />
              ))}
            </div>

            {weekChunks.map((week, wi) => {
              const range = `${format(week[0].date, 'd MMM')} - ${format(week[week.length - 1].date, 'd MMM')}`;
              const firstDayInfo = programStartDate ? getWorkoutForDay(program, programStartDate, week[0].date) : null;
              const weekNumber = firstDayInfo && firstDayInfo.day >= 1 ? Math.ceil(firstDayInfo.day / 7) : undefined;
              const weekWorkouts = week.flatMap(d => d.workouts).filter(w => !isRestDayWorkout(w));
              const totalRunKm = weekWorkouts.filter(hasRuns).reduce((sum, w) => sum + (w as RunningWorkout).runs.reduce((s, r) => s + (r.distance || 0), 0), 0);
              const weekKeys = week.map(d => d.dateKey);
              const hasWeekChanges = weekKeys.some(k => changedKeys.has(k));

              return (
                <div key={wi} className="rounded-lg border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/40">
                    <div>
                      <p className="font-bold flex items-center gap-2">
                        {range}
                        {weekNumber !== undefined && <Badge variant="secondary">Week {weekNumber}</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {weekWorkouts.length} session{weekWorkouts.length === 1 ? '' : 's'}
                        {totalRunKm > 0 ? ` • ${convertDistance(totalRunKm, unitSystem ?? 'metric')} running` : ''}
                      </p>
                    </div>
                    {hasWeekChanges && (
                      <Button variant="ghost" size="sm" onClick={() => handleResetWeek(weekKeys)}>
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Reset
                      </Button>
                    )}
                  </div>
                  <div className="divide-y">
                    {week.map(day => (
                      <DayRow key={day.dateKey} day={day} unitSystem={unitSystem} />
                    ))}
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      <DragOverlay>
        {activeDrag && (
          <div className={cn('rounded-lg bg-card border-l-4 shadow-lg px-3 py-2 max-w-xs', workoutAccentClass(activeDrag.workout))}>
            <p className="font-semibold text-sm">{activeDrag.workout.title}</p>
            <p className="text-xs text-muted-foreground">{summarizeWorkout(activeDrag.workout, unitSystem)}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function DayRow({ day, unitSystem }: { day: DaySlot; unitSystem?: UnitSystem }) {
  const finishedSession = day.sessions.find(s => s.finishedAt);
  const isDone = !!finishedSession && !finishedSession.skipped;
  const isSkipped = !!finishedSession?.skipped;
  const isLocked = !!finishedSession; // completed/skipped — not editable
  const workout = day.workouts[0];
  const isEmpty = day.workouts.length === 0;
  const isMulti = day.workouts.length > 1;
  const isRest = !isEmpty && !isMulti && isRestDayWorkout(workout);

  const isDraggable = !isLocked && day.workouts.length === 1 && !isRest;
  const isDroppable = !isLocked && day.workouts.length <= 1;

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: day.dateKey,
    disabled: !isDraggable,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: day.dateKey,
    disabled: !isDroppable,
  });

  return (
    <div
      ref={(node) => { setDragRef(node); setDropRef(node); }}
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-card transition-colors',
        isOver && isDroppable && 'bg-green-100 dark:bg-green-950/40 ring-2 ring-green-500 ring-inset',
        isDragging && 'opacity-30',
        day.isToday && 'bg-accent/10'
      )}
    >
      <div className="w-11 shrink-0 text-center">
        <p className={cn('text-[10px] font-semibold uppercase', day.isToday ? 'text-primary' : 'text-muted-foreground')}>
          {format(day.date, 'EEE')}
        </p>
        <p className="text-sm font-bold">{format(day.date, 'd')}</p>
      </div>

      {isEmpty || isRest ? (
        <div className="flex-1 flex items-center justify-between min-h-[2.5rem]">
          <p className="text-sm text-muted-foreground">{isRest ? workout.title : 'Rest'}</p>
        </div>
      ) : isMulti ? (
        <div className="flex-1 flex items-center justify-between min-h-[2.5rem]">
          <div>
            <p className="text-sm font-medium">{day.workouts.length} sessions scheduled</p>
            <p className="text-xs text-muted-foreground">{day.workouts.map(w => w.title).join(' + ')}</p>
          </div>
          {day.isToday && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/workout/active">View</Link>
            </Button>
          )}
        </div>
      ) : (
        <div
          {...(isDraggable ? { ...attributes, ...listeners } : {})}
          className={cn(
            'flex-1 flex items-center justify-between gap-2 rounded-lg border-l-4 bg-muted/60 px-3 py-2',
            workoutAccentClass(workout),
            isDraggable && 'cursor-grab active:cursor-grabbing touch-none'
          )}
        >
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{workout.title}</p>
            <p className="text-xs text-muted-foreground">{summarizeWorkout(workout, unitSystem)}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDone && (
              <Badge variant="outline" className="bg-green-500/10 text-green-700 border-green-500/50">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Done
              </Badge>
            )}
            {isSkipped && (
              <Badge variant="outline" className="bg-orange-500/10 text-orange-700 border-orange-500/50">
                <XCircle className="h-3 w-3 mr-1" />
                Skipped
              </Badge>
            )}
            {day.isToday && !isLocked && (
              <Button variant="secondary" size="sm" asChild>
                <Link href="/workout/active">Start</Link>
              </Button>
            )}
            {isDraggable && <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />}
          </div>
        </div>
      )}
    </div>
  );
}
