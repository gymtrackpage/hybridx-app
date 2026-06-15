/**
 * Adapt the app's Firestore program shapes (Workout / RunningWorkout) into
 * the WorkoutDay shape(s) the mapper expects. Pure functions, no I/O.
 */
import type { Workout, RunningWorkout, PlannedRun, PersonalRecords } from '@/models/types';
import type { WorkoutDay } from './workout-mapper';

import type { WorkoutDayExercise } from './workout-mapper';
import { resolveWeightKg } from './program-enricher';
import type { Workout, RunningWorkout, PlannedRun, Exercise } from '@/models/types';
import type { WorkoutDay, WorkoutDayExercise } from './workout-mapper';

function describePlannedRun(run: PlannedRun): WorkoutDayExercise {
  // Express distance in whole meters when < 1 km to avoid decimal ambiguity in
  // the mapper's regex (e.g. 0.8 km → 800m, giving "5x800m" not "5x 0.8km").
  const distMeters = run.distance ? Math.round(run.distance * 1000) : 0;
  const distStr = distMeters >= 1000
    ? `${run.distance}km`
    : distMeters > 0 ? `${distMeters}m` : '';

  // Produce canonical "5x800m" format that findAllIntervalPatterns expects.
  let name: string;
  if (run.noIntervals && run.noIntervals > 1 && distStr) {
    name = `${run.noIntervals}x${distStr}`;
  } else {
    name = [distStr, run.type].filter(Boolean).join(' ').trim() || 'Run';
  }

  const detailsParts: string[] = [];
  if (run.description) detailsParts.push(run.description);
  if (run.effortLevel) detailsParts.push(`RPE ${run.effortLevel}`);
  if (run.targetPace) {
    const min = Math.floor(run.targetPace / 60);
    const sec = Math.round(run.targetPace % 60).toString().padStart(2, '0');
    detailsParts.push(`Target pace ${min}:${sec}/km`);
  }
  if (run.paceZone) detailsParts.push(`Zone: ${run.paceZone}`);

  // targetPace is seconds/km; Garmin PACE targets use m/s
  const targetPaceMps = run.targetPace ? 1000 / run.targetPace : undefined;

  return { name, details: detailsParts.join('. '), ...(targetPaceMps != null ? { targetPaceMps } : {}) };
}

function adaptExercise(e: Exercise): WorkoutDayExercise {
  return {
    name: e.name,
    details: e.details,
    ...(e.sessionType ? { sessionType: e.sessionType } : {}),
    ...(e.garminSport ? { garminSport: e.garminSport } : {}),
    ...(e.garminExerciseCategory ? { garminExerciseCategory: e.garminExerciseCategory } : {}),
    ...(e.garminExerciseName ? { garminExerciseName: e.garminExerciseName } : {}),
    ...(e.weightKg != null ? { weightKg: e.weightKg } : {}),
    ...(e.restSeconds != null ? { restSeconds: e.restSeconds } : {}),
    ...(e.sets != null ? { sets: e.sets } : {}),
    ...(e.reps != null ? { reps: e.reps } : {}),
  };
}

/**
 * Converts one program day into one or more WorkoutDay sessions for Garmin.
 *
 * A hybrid day (e.g. treadmill run + lower-body strength) produces two
 * WorkoutDay objects so the mapper creates two separate Garmin workouts.
 * Exercise rows are grouped by their (sessionType, garminSport) pair so
 * that e.g. strength and CrossFit conditioning on the same day get distinct
 * sport types on the watch.
 */
export function workoutToDays(w: Workout | RunningWorkout): WorkoutDay[] {
  const result: WorkoutDay[] = [];

  // ── Run session ──────────────────────────────────────────────────────────
  const runs: PlannedRun[] = (w as RunningWorkout).runs ?? [];
  if (runs.length > 0) {
    result.push({
      day: w.day,
      title: w.title,
      exercises: runs.map(describePlannedRun),
      sessionType: 'run',
      garminSport: 'RUNNING',
    });
  }

  // ── Exercise sessions ────────────────────────────────────────────────────
  const rawExercises = (w.exercises as Exercise[]).filter(e => e.name || e.details);
  if (rawExercises.length > 0) {
    // Group by (sessionType, garminSport) to preserve session boundaries.
    // Exercises without sessionType default to 'strength'.
    const order: string[] = [];
    const groups = new Map<string, Exercise[]>();

    for (const ex of rawExercises) {
      const st = ex.sessionType ?? 'strength';
      const gs = ex.garminSport ?? (st === 'cardio' ? 'CARDIO_TRAINING' : 'STRENGTH_TRAINING');
      const key = `${st}|${gs}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push(ex);
    }

    for (const key of order) {
      const [st, gs] = key.split('|') as ['strength' | 'cardio', string];
      result.push({
        day: w.day,
        title: w.title,
        exercises: groups.get(key)!.map(adaptExercise),
        sessionType: st,
        garminSport: gs,
      });
    }
  }

  return result;
}

/**
 * Legacy single-session adapter — kept for call sites that haven't migrated
 * to workoutToDays yet. For hybrid days it only returns the exercise session.
 */
export function workoutToDay(w: Workout | RunningWorkout): WorkoutDay {
  if (w.programType === 'running') {
    return {
      day: w.day,
      title: w.title,
      exercises: (w as RunningWorkout).runs.map(describePlannedRun),
      sessionType: 'run',
      garminSport: 'RUNNING',
    };
  }
  return {
    day: w.day,
    title: w.title,
    exercises: w.exercises.map(adaptExercise),
  };
}
