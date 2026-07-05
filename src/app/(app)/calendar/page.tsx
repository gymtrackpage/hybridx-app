// src/app/(app)/calendar/page.tsx
'use client';

import { useState, useEffect, useMemo, useCallback, useRef, useLayoutEffect } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getAuthInstance } from '@/lib/firebase';
import { getUserClient } from '@/services/user-service-client';
import { getProgramClient } from '@/services/program-service-client';
import { getWorkoutForDay, formatPlannedRun } from '@/lib/workout-utils';
import { getAllUserSessions, getOrCreateWorkoutSession, updateWorkoutSession } from '@/services/session-service-client';
import { saveScheduleChanges } from '@/services/session-service';
import type { Program, WorkoutDay, WorkoutSession, RunningWorkout, Workout, UnitSystem } from '@/models/types';
import { hasRuns, hasExercises } from '@/lib/type-guards';
import { convertDistance, convertTextWithUnits } from '@/lib/unit-conversion';
import { addDays, format, isSameDay, startOfDay, startOfWeek, endOfWeek } from 'date-fns';
import { RotateCcw, Loader2, CheckCircle2, XCircle, GripVertical } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DaySlot {
  date: Date;
  dateKey: string;
  workouts: WorkoutDay[];
  sessions: WorkoutSession[];
  isToday: boolean;
  isPast: boolean;
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
      isPast: cursor < today0,
    });
    cursor = addDays(cursor, 1);
  }
  return slots;
}

const MAX_FUTURE_WEEKS = 16;
const MAX_PAST_DAYS = 90;

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [programStartDate, setProgramStartDate] = useState<Date | null>(null);
  const [unitSystem, setUnitSystem] = useState<UnitSystem | undefined>(undefined);
  const [allSlots, setAllSlots] = useState<DaySlot[]>([]);
  const [originalByKey, setOriginalByKey] = useState<Map<string, WorkoutDay[]>>(new Map());
  const [changedKeys, setChangedKeys] = useState<Set<string>>(new Set());
  const [visibleFromDate, setVisibleFromDate] = useState<Date>(() => startOfDay(new Date()));
  const [activeDrag, setActiveDrag] = useState<WorkoutDay | null>(null);
  const [detailWorkout, setDetailWorkout] = useState<WorkoutDay | null>(null);
  const [markingDoneKey, setMarkingDoneKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLElement | null>(null);
  const pendingScrollAdjustRef = useRef<number | null>(null);

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
        setAllSlots([]);
        setOriginalByKey(new Map());
        setChangedKeys(new Set());
        return;
      }

      const startDate = startOfDay(new Date(user.startDate));
      setProgramStartDate(startDate);
      const today0 = startOfDay(new Date());
      const rangeStart = addDays(today0, -MAX_PAST_DAYS);
      const cycleLength = Math.max(...userProgram.workouts.map(w => w.day), 0);
      const programEnd = addDays(startDate, Math.max(cycleLength - 1, 0));
      const currentWeekEnd = endOfWeek(today0, { weekStartsOn: 1 });
      const candidateEnd = programEnd > currentWeekEnd ? programEnd : currentWeekEnd;
      const cappedEnd = addDays(today0, MAX_FUTURE_WEEKS * 7 - 1);
      const rangeEnd = candidateEnd < cappedEnd ? candidateEnd : cappedEnd;

      const sessions = await getAllUserSessions(fbUser.uid);
      const slots = buildDaySlots(userProgram, startDate, sessions, rangeStart, rangeEnd);

      setAllSlots(slots);
      setOriginalByKey(new Map(slots.map(s => [s.dateKey, s.workouts])));
      setChangedKeys(new Set());
      setVisibleFromDate(today0);
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

  // Resolve the scrollable ancestor (the app shell's <main>) once mounted.
  useEffect(() => {
    scrollRootRef.current = sentinelRef.current?.closest('main') ?? null;
  }, [allSlots.length]);

  const revealEarlierWeek = useCallback(() => {
    const root = scrollRootRef.current;
    if (root) pendingScrollAdjustRef.current = root.scrollHeight;
    setVisibleFromDate(prev => {
      const earliestLoaded = allSlots[0]?.date;
      const candidate = startOfWeek(addDays(prev, -1), { weekStartsOn: 1 });
      if (earliestLoaded && candidate < earliestLoaded) return earliestLoaded;
      return candidate;
    });
  }, [allSlots]);

  // Watch a sentinel above the list; scrolling near it reveals one more past week.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || allSlots.length === 0) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) revealEarlierWeek();
    }, { root: scrollRootRef.current, rootMargin: '300px 0px 0px 0px' });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [allSlots.length, revealEarlierWeek]);

  // Keep the scroll position anchored when older weeks are prepended above the viewport.
  useLayoutEffect(() => {
    const root = scrollRootRef.current;
    if (root && pendingScrollAdjustRef.current !== null) {
      root.scrollTop += root.scrollHeight - pendingScrollAdjustRef.current;
      pendingScrollAdjustRef.current = null;
    }
  }, [visibleFromDate]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 250, tolerance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const [dateKey, indexStr] = String(event.active.id).split('::');
    const slot = allSlots.find(d => d.dateKey === dateKey);
    const workout = slot?.workouts[Number(indexStr)];
    if (workout) setActiveDrag(workout);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const [sourceDateKey, sourceIndexStr] = String(active.id).split('::');
    const sourceIndex = Number(sourceIndexStr);
    const targetDateKey = String(over.id);
    if (sourceDateKey === targetDateKey) return;

    setAllSlots(prev => {
      const sourceSlot = prev.find(d => d.dateKey === sourceDateKey);
      const targetSlot = prev.find(d => d.dateKey === targetDateKey);
      if (!sourceSlot || !targetSlot || sourceIndex < 0 || sourceIndex >= sourceSlot.workouts.length) return prev;

      const movedWorkout = sourceSlot.workouts[sourceIndex];
      const remainingSource = sourceSlot.workouts.filter((_, i) => i !== sourceIndex);
      // A day whose only content is a "Rest" placeholder is treated as empty — dropping something
      // real there replaces the placeholder instead of sitting alongside it.
      const targetContent = (targetSlot.workouts.length === 1 && isRestDayWorkout(targetSlot.workouts[0]))
        ? []
        : targetSlot.workouts;

      // Straight swap when it's an unambiguous one-for-one trade; otherwise the moved workout
      // just joins the target day without evicting whatever else is already scheduled there.
      const isSimpleSwap = remainingSource.length === 0 && targetContent.length === 1;
      const newSourceWorkouts = isSimpleSwap ? [targetContent[0]] : remainingSource;
      const newTargetWorkouts = isSimpleSwap ? [movedWorkout] : [...targetContent, movedWorkout];

      return prev.map(d => {
        if (d.dateKey === sourceDateKey) return { ...d, workouts: newSourceWorkouts };
        if (d.dateKey === targetDateKey) return { ...d, workouts: newTargetWorkouts };
        return d;
      });
    });
    setChangedKeys(prev => new Set(prev).add(sourceDateKey).add(targetDateKey));
  };

  const handleResetWeek = (weekKeys: string[]) => {
    setAllSlots(prev => prev.map(d => weekKeys.includes(d.dateKey) ? { ...d, workouts: originalByKey.get(d.dateKey) ?? [] } : d));
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
        const slot = allSlots.find(d => d.dateKey === key)!;
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

  const handleMarkDone = async (dateKey: string, index: number, workout: WorkoutDay) => {
    if (!firebaseUser || !program) return;
    const slot = allSlots.find(d => d.dateKey === dateKey);
    if (!slot) return;
    const markKey = `${dateKey}::${index}`;
    setMarkingDoneKey(markKey);
    try {
      const session = await getOrCreateWorkoutSession(
        firebaseUser.uid, program.id, slot.date, workout, false, undefined, index, slot.workouts.length
      );
      const completedAt = new Date(slot.date);
      completedAt.setHours(12, 0, 0, 0);
      await updateWorkoutSession(session.id, { finishedAt: completedAt, workoutTitle: workout.title, skipped: false });

      setAllSlots(prev => prev.map(d => {
        if (d.dateKey !== dateKey) return d;
        const already = d.sessions.some(s => (s.sessionIndex ?? 0) === index);
        const updatedSessions = already
          ? d.sessions.map(s => (s.sessionIndex ?? 0) === index ? { ...s, finishedAt: completedAt, skipped: false } : s)
          : [...d.sessions, { ...session, finishedAt: completedAt, skipped: false }];
        return { ...d, sessions: updatedSessions };
      }));
      toast({ title: 'Marked as completed', description: `${workout.title} logged.` });
    } catch (error) {
      console.error('Failed to mark workout done:', error);
      toast({ title: 'Error', description: 'Could not mark workout as completed.', variant: 'destructive' });
    } finally {
      setMarkingDoneKey(null);
    }
  };

  const visibleSlots = useMemo(() => allSlots.filter(s => s.date >= visibleFromDate), [allSlots, visibleFromDate]);

  const { leadingSlots, weekChunks } = useMemo(() => {
    if (visibleSlots.length === 0) return { leadingSlots: [] as DaySlot[], weekChunks: [] as DaySlot[][] };
    const today0 = startOfDay(new Date());
    const currentWeekEnd = endOfWeek(today0, { weekStartsOn: 1 });
    const leading = visibleSlots.filter(s => s.date >= today0 && s.date <= currentWeekEnd);
    const others = visibleSlots.filter(s => s.date < today0 || s.date > currentWeekEnd);

    const groupsMap = new Map<string, DaySlot[]>();
    others.forEach(s => {
      const weekKey = format(startOfWeek(s.date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      const list = groupsMap.get(weekKey) ?? [];
      list.push(s);
      groupsMap.set(weekKey, list);
    });
    const chunks = Array.from(groupsMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, days]) => days);

    return { leadingSlots: leading, weekChunks: chunks };
  }, [visibleSlots]);

  const canLoadMorePast = allSlots.length > 0 && visibleFromDate > allSlots[0].date;

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

        {allSlots.length === 0 ? (
          <Card><CardContent className="text-center py-12"><p className="text-muted-foreground">No upcoming schedule found.</p></CardContent></Card>
        ) : (
          <>
            <div ref={sentinelRef} className="h-1" />
            {canLoadMorePast && (
              <p className="text-center text-xs text-muted-foreground">Scroll up for earlier weeks</p>
            )}

            {weekChunks.filter(week => week[0].date < startOfDay(new Date())).map((week, wi) => (
              <WeekSection
                key={`past-${wi}`}
                week={week}
                program={program}
                programStartDate={programStartDate}
                unitSystem={unitSystem}
                changedKeys={changedKeys}
                onResetWeek={handleResetWeek}
                onOpenDetail={setDetailWorkout}
                onMarkDone={handleMarkDone}
                markingDoneKey={markingDoneKey}
              />
            ))}

            <div className="rounded-lg border overflow-hidden divide-y">
              {leadingSlots.map(day => (
                <DayRow
                  key={day.dateKey}
                  day={day}
                  unitSystem={unitSystem}
                  onOpenDetail={setDetailWorkout}
                  onMarkDone={handleMarkDone}
                  markingDoneKey={markingDoneKey}
                />
              ))}
            </div>

            {weekChunks.filter(week => week[0].date >= startOfDay(new Date())).map((week, wi) => (
              <WeekSection
                key={`future-${wi}`}
                week={week}
                program={program}
                programStartDate={programStartDate}
                unitSystem={unitSystem}
                changedKeys={changedKeys}
                onResetWeek={handleResetWeek}
                onOpenDetail={setDetailWorkout}
                onMarkDone={handleMarkDone}
                markingDoneKey={markingDoneKey}
              />
            ))}
          </>
        )}
      </div>

      <DragOverlay>
        {activeDrag && (
          <div className={cn('rounded-lg bg-card border-l-4 shadow-lg px-3 py-2 max-w-xs', workoutAccentClass(activeDrag))}>
            <p className="font-semibold text-sm">{activeDrag.title}</p>
            <p className="text-xs text-muted-foreground">{summarizeWorkout(activeDrag, unitSystem)}</p>
          </div>
        )}
      </DragOverlay>

      <WorkoutDetailDialog workout={detailWorkout} unitSystem={unitSystem} onClose={() => setDetailWorkout(null)} />
    </DndContext>
  );
}

function WeekSection({ week, program, programStartDate, unitSystem, changedKeys, onResetWeek, onOpenDetail, onMarkDone, markingDoneKey }: {
  week: DaySlot[];
  program: Program;
  programStartDate: Date | null;
  unitSystem?: UnitSystem;
  changedKeys: Set<string>;
  onResetWeek: (keys: string[]) => void;
  onOpenDetail: (workout: WorkoutDay) => void;
  onMarkDone: (dateKey: string, index: number, workout: WorkoutDay) => void;
  markingDoneKey: string | null;
}) {
  const range = `${format(week[0].date, 'd MMM')} - ${format(week[week.length - 1].date, 'd MMM')}`;
  const dayInfo = programStartDate ? getWorkoutForDay(program, programStartDate, week[0].date) : null;
  const weekNumber = dayInfo && dayInfo.day >= 1 ? Math.ceil(dayInfo.day / 7) : undefined;
  const weekWorkouts = week.flatMap(d => d.workouts).filter(w => !isRestDayWorkout(w));
  const totalRunKm = weekWorkouts.filter(hasRuns).reduce((sum, w) => sum + (w as RunningWorkout).runs.reduce((s, r) => s + (r.distance || 0), 0), 0);
  const weekKeys = week.map(d => d.dateKey);
  const hasWeekChanges = weekKeys.some(k => changedKeys.has(k));

  return (
    <div className="rounded-lg border overflow-hidden">
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
          <Button variant="ghost" size="sm" onClick={() => onResetWeek(weekKeys)}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        )}
      </div>
      <div className="divide-y">
        {week.map(day => (
          <DayRow key={day.dateKey} day={day} unitSystem={unitSystem} onOpenDetail={onOpenDetail} onMarkDone={onMarkDone} markingDoneKey={markingDoneKey} />
        ))}
      </div>
    </div>
  );
}

function DayRow({ day, unitSystem, onOpenDetail, onMarkDone, markingDoneKey }: {
  day: DaySlot;
  unitSystem?: UnitSystem;
  onOpenDetail: (workout: WorkoutDay) => void;
  onMarkDone: (dateKey: string, index: number, workout: WorkoutDay) => void;
  markingDoneKey: string | null;
}) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: day.dateKey,
    disabled: day.isPast,
  });

  return (
    <div
      ref={setDropRef}
      className={cn(
        'flex items-start gap-3 px-4 py-3 bg-card transition-colors',
        isOver && !day.isPast && 'bg-green-100 dark:bg-green-950/40 ring-2 ring-green-500 ring-inset',
        day.isToday && 'bg-accent/10'
      )}
    >
      <div className="w-11 shrink-0 text-center pt-1.5">
        <p className={cn('text-[10px] font-semibold uppercase', day.isToday ? 'text-primary' : 'text-muted-foreground')}>
          {format(day.date, 'EEE')}
        </p>
        <p className="text-sm font-bold">{format(day.date, 'd')}</p>
      </div>

      <div className="flex-1 space-y-2 min-h-[2.5rem] flex flex-col justify-center">
        {day.workouts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Rest</p>
        ) : (
          day.workouts.map((workout, idx) => (
            <WorkoutCard
              key={idx}
              dateKey={day.dateKey}
              index={idx}
              workout={workout}
              unitSystem={unitSystem}
              isToday={day.isToday}
              isPast={day.isPast}
              finishedSession={day.sessions.find(s => (s.sessionIndex ?? 0) === idx)}
              onOpenDetail={() => onOpenDetail(workout)}
              onMarkDone={() => onMarkDone(day.dateKey, idx, workout)}
              isMarkingDone={markingDoneKey === `${day.dateKey}::${idx}`}
            />
          ))
        )}
      </div>
    </div>
  );
}

function WorkoutCard({ dateKey, index, workout, unitSystem, isToday, isPast, finishedSession, onOpenDetail, onMarkDone, isMarkingDone }: {
  dateKey: string;
  index: number;
  workout: WorkoutDay;
  unitSystem?: UnitSystem;
  isToday: boolean;
  isPast: boolean;
  finishedSession?: WorkoutSession;
  onOpenDetail: () => void;
  onMarkDone: () => void;
  isMarkingDone: boolean;
}) {
  const isRest = isRestDayWorkout(workout);
  const isDone = !!finishedSession?.finishedAt && !finishedSession.skipped;
  const isSkipped = !!finishedSession?.skipped;
  const isLocked = !!finishedSession?.finishedAt;
  const isDraggable = !isPast && !isLocked && !isRest;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${dateKey}::${index}`,
    disabled: !isDraggable,
  });

  return (
    <div
      ref={setNodeRef}
      {...(isDraggable ? { ...attributes, ...listeners } : {})}
      onClick={onOpenDetail}
      className={cn(
        'flex items-center justify-between gap-2 rounded-lg border-l-4 bg-muted/60 px-3 py-2 cursor-pointer',
        workoutAccentClass(workout),
        isDraggable && 'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-30'
      )}
    >
      <div className="min-w-0">
        <p className="font-semibold text-sm truncate">{workout.title}</p>
        {!isRest && <p className="text-xs text-muted-foreground">{summarizeWorkout(workout, unitSystem)}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
        {isToday && !isLocked && !isRest && (
          <Button variant="secondary" size="sm" asChild>
            <Link href="/workout/active">Start</Link>
          </Button>
        )}
        {isPast && !isLocked && !isRest && (
          <Button variant="outline" size="sm" onClick={onMarkDone} disabled={isMarkingDone}>
            {isMarkingDone ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          </Button>
        )}
        {isDraggable && <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />}
      </div>
    </div>
  );
}

function WorkoutDetailDialog({ workout, unitSystem, onClose }: { workout: WorkoutDay | null; unitSystem?: UnitSystem; onClose: () => void }) {
  return (
    <Dialog open={!!workout} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        {workout && (
          <>
            <DialogHeader>
              <DialogTitle>{workout.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {hasRuns(workout) ? (
                workout.runs.map((run, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-3">
                    <p className="font-medium text-sm">{formatPlannedRun(run)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {convertDistance(run.distance, unitSystem ?? 'metric')} · {run.paceZone} pace
                    </p>
                  </div>
                ))
              ) : null}
              {hasExercises(workout) ? (
                workout.exercises.map((ex, i) => (
                  <div key={i} className="rounded-lg bg-muted/50 p-3">
                    <p className="font-medium text-sm">{ex.name}</p>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                      {unitSystem ? convertTextWithUnits(ex.details, unitSystem) : ex.details}
                    </p>
                  </div>
                ))
              ) : null}
              {!hasRuns(workout) && !hasExercises(workout) && (
                <p className="text-sm text-muted-foreground">Rest day — nothing scheduled.</p>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
