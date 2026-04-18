/**
 * Adapt the app's Firestore program shapes (Workout / RunningWorkout) into
 * the WorkoutDay shape the mapper expects. Pure functions, no I/O.
 */
import type { Workout, RunningWorkout, PlannedRun } from '@/models/types';
import type { WorkoutDay } from './workout-mapper';

function describePlannedRun(run: PlannedRun): { name: string; details: string } {
  const reps =
    run.noIntervals && run.noIntervals > 1 ? `${run.noIntervals}x ` : '';
  const dist = run.distance ? `${run.distance}km` : '';
  const name = [reps + dist, run.type].filter(Boolean).join(' ').trim() || 'Run';

  const detailsParts: string[] = [];
  if (run.description) detailsParts.push(run.description);
  if (run.effortLevel) detailsParts.push(`RPE ${run.effortLevel}`);
  if (run.targetPace) {
    const min = Math.floor(run.targetPace / 60);
    const sec = Math.round(run.targetPace % 60).toString().padStart(2, '0');
    detailsParts.push(`Target pace ${min}:${sec}/km`);
  }
  if (run.paceZone) detailsParts.push(`Zone: ${run.paceZone}`);

  return { name, details: detailsParts.join('. ') };
}

export function workoutToDay(w: Workout | RunningWorkout): WorkoutDay {
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
    exercises: w.exercises.map((e) => ({ name: e.name, details: e.details })),
  };
}
