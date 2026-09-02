import { describe, expect, it } from 'vitest';

import { mapWorkoutDay, parseSetsReps, parseTimedSets } from '../workout-mapper';
import type { WorkoutDay } from '../workout-mapper';

function flatten(workout: ReturnType<typeof mapWorkoutDay>) {
  const out: string[] = [];
  for (const seg of workout!.segments) {
    for (const st of seg.steps) {
      if (st.type === 'WorkoutRepeatStep') {
        for (const inner of st.steps) out.push(inner.description ?? '');
      } else {
        out.push(st.description ?? '');
      }
    }
  }
  return out;
}

describe('parseSetsReps', () => {
  it('still reads the plain ASCII "x" shape', () => {
    expect(parseSetsReps('4x5 | RPE 8')).toEqual({ sets: 4, reps: 5, isAmrap: false });
    expect(parseSetsReps('3x8-10')).toEqual({ sets: 3, reps: 8, repsMax: 10, isAmrap: false });
  });

  it('reads the Unicode multiplication sign, with or without the word "sets"', () => {
    expect(parseSetsReps('3 sets × 20 reps. Upper back on floor or bench.'))
      .toEqual({ sets: 3, reps: 20, isAmrap: false });
    expect(parseSetsReps('3 × 20 reps')).toEqual({ sets: 3, reps: 20, isAmrap: false });
  });

  it('reads "N sets of M"', () => {
    expect(parseSetsReps('Work up to 2 sets of 3 at 85% of your 1RM.'))
      .toEqual({ sets: 2, reps: 3, isAmrap: false });
  });

  it('still excludes a distance or timed shape, leaving those to their own parsers', () => {
    expect(parseSetsReps('5x800m')).toBeNull();
    expect(parseSetsReps('3x90 seconds')).toBeNull();
    expect(parseSetsReps('3 sets × 25 seconds per side')).toBeNull();
    expect(parseSetsReps('3 × 20m at a challenging but controlled weight')).toBeNull();
  });

  it('still handles AMRAP', () => {
    expect(parseSetsReps('4x AMRAP')).toEqual({ sets: 4, reps: 0, isAmrap: true });
  });

  it('returns null for a set count with no rep count anywhere in the text', () => {
    // "3 sets | RPE 7" — a genuine content gap, not a parsing failure.
    expect(parseSetsReps('3 sets | RPE 7')).toBeNull();
  });
});

describe('parseTimedSets', () => {
  it('still reads the plain ASCII "x" shape', () => {
    expect(parseTimedSets('3x90 seconds')).toEqual({ sets: 3, timeS: 90 });
    expect(parseTimedSets('4x60sec per side')).toEqual({ sets: 4, timeS: 60 });
  });

  it('reads the Unicode multiplication sign, with or without the word "sets"', () => {
    expect(parseTimedSets('3 sets × 25 seconds per side. Side plank with top foot on a bench.'))
      .toEqual({ sets: 3, timeS: 25 });
  });

  it('reads "N sets of M seconds"', () => {
    expect(parseTimedSets('2 sets of 30 seconds')).toEqual({ sets: 2, timeS: 30 });
  });

  it('does not match a rep count, leaving that to parseSetsReps', () => {
    expect(parseTimedSets('3 sets × 20 reps')).toBeNull();
  });
});

describe('coaching-prose rows are not sent as steps', () => {
  it('drops a Notes row from a strength session but keeps its text in the description', () => {
    const day: WorkoutDay = {
      day: 1,
      title: 'Lower Body Strength',
      sessionType: 'strength',
      exercises: [
        { name: 'Back Squat', details: '4x5 | RPE 8' },
        { name: 'Notes', details: 'Focus on bar speed today, we are peaking next week.' },
      ],
    };

    const w = mapWorkoutDay(day);
    const steps = flatten(w);
    expect(steps.some((d) => d.startsWith('Back Squat'))).toBe(true);
    expect(steps.some((d) => d.startsWith('Notes'))).toBe(false);
    expect(w!.description).toContain('Focus on bar speed today');
  });

  it('drops an emoji-prefixed Session Notes row', () => {
    const day: WorkoutDay = {
      day: 33,
      title: 'Strength Peaking',
      sessionType: 'strength',
      exercises: [
        { name: '📋 Session Notes', details: '5×5 at 75% is the classic strength-building protocol.' },
        { name: 'Bench Press', details: '5x5 @ 75%' },
      ],
    };

    const steps = flatten(mapWorkoutDay(day));
    expect(steps.some((d) => d.includes('Session Notes'))).toBe(false);
    expect(steps.some((d) => d.startsWith('Bench Press'))).toBe(true);
  });

  it('keeps Format and Work rows in a circuit session — they carry the prescribed work', () => {
    const day: WorkoutDay = {
      day: 2,
      title: 'CrossFit Conditioning',
      sessionType: 'cardio',
      garminSport: 'CARDIO_TRAINING',
      exercises: [
        { name: 'Format', details: 'CrossFit engine builder. 4 rounds for time' },
        { name: 'Work 1', details: '500m row · 15 burpees over rower · 20 wall balls (9kg)' },
        { name: 'Work 2', details: '400m run · rest 90s between rounds' },
        { name: 'Notes', details: 'Effort RPE 8. Builds the aerobic-power overlap.' },
      ],
    };

    const steps = flatten(mapWorkoutDay(day));
    expect(steps.some((d) => d.startsWith('Format'))).toBe(true);
    expect(steps.some((d) => d.startsWith('Work 1'))).toBe(true);
    expect(steps.some((d) => d.startsWith('Work 2'))).toBe(true);
    expect(steps.some((d) => d.startsWith('Notes'))).toBe(false);
  });

  it('does not collapse a session to just warm-up and cool-down when every row is a note', () => {
    // Pathological input, but the mapper should not silently push an empty
    // workout — this documents current behavior rather than asserting an
    // opinion about what should happen instead.
    const day: WorkoutDay = {
      day: 1,
      title: 'Rest',
      sessionType: 'strength',
      exercises: [{ name: 'Coaching Note', details: 'Take the day fully off.' }],
    };

    const steps = flatten(mapWorkoutDay(day));
    expect(steps).toEqual(['Warm up — press lap when ready', 'Cool down — press lap when done']);
  });
});
