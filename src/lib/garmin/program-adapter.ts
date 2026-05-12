/**
 * Adapt the app's Firestore program shapes (Workout / RunningWorkout) into
 * the WorkoutDay shape the mapper expects. Pure functions, no I/O.
 */
import type { Workout, RunningWorkout, PlannedRun, PersonalRecords } from '@/models/types';
import type { WorkoutDay } from './workout-mapper';

import type { WorkoutDayExercise } from './workout-mapper';
import { resolveWeightKg } from './program-enricher';

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

export function workoutToDay(
  w: Workout | RunningWorkout,
  personalRecords?: PersonalRecords,
): WorkoutDay {
  if (w.programType === 'running') {
    return {
      day: w.day,
      title: w.title,
      exercises: w.runs.map(describePlannedRun),
    };
  }
  return {
    day: w.day,
    title: w.title,
    exercises: w.exercises.map((e): WorkoutDayExercise => {
      // Prefer explicitly-set weight; fall back to 1RM-derived value when PRs are available.
      let weightKg = e.weightKg;
      if (weightKg == null && personalRecords) {
        const inferred = resolveWeightKg(e.name, e.details, e.reps, personalRecords);
        if (inferred != null) weightKg = inferred;
      }
      return {
        name: e.name,
        details: e.details,
        ...(e.garminExerciseCategory ? { garminExerciseCategory: e.garminExerciseCategory } : {}),
        ...(e.garminExerciseName ? { garminExerciseName: e.garminExerciseName } : {}),
        ...(weightKg != null ? { weightKg } : {}),
        ...(e.restSeconds != null ? { restSeconds: e.restSeconds } : {}),
        ...(e.sets != null ? { sets: e.sets } : {}),
        ...(e.reps != null ? { reps: e.reps } : {}),
      };
    }),
  };
}
