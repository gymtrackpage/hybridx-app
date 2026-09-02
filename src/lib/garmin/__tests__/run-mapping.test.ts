import { describe, expect, it } from 'vitest';

import { workoutToDays } from '../program-adapter';
import {
  mapWorkoutDay,
  parseStatedRunDistanceMeters,
  parseStatedDuration,
  parseStatedRecovery,
  type WorkoutStepItem,
} from '../workout-mapper';
import type { PlannedRun, RunningWorkout } from '@/models/types';

function run(partial: Partial<PlannedRun>): PlannedRun {
  return {
    type: 'easy',
    distance: 0,
    paceZone: 'easy',
    description: '',
    effortLevel: 3,
    ...partial,
  } as PlannedRun;
}

function day(title: string, runs: PlannedRun[]): RunningWorkout {
  return { day: 1, title, runs, programType: 'running', exercises: [] };
}

/** The single run session a day produces, mapped. */
function mapRunDay(w: RunningWorkout) {
  const sessions = workoutToDays(w);
  const runSession = sessions.find((s) => s.sessionType === 'run');
  expect(runSession).toBeDefined();
  return mapWorkoutDay(runSession!);
}

/** Steps in order, with the repeat count of the block each one sits in. */
function flatten(workout: ReturnType<typeof mapWorkoutDay>) {
  const out: Array<{ repeat: number | null; step: WorkoutStepItem }> = [];
  for (const seg of workout!.segments) {
    for (const st of seg.steps) {
      if (st.type === 'WorkoutRepeatStep') {
        for (const inner of st.steps) out.push({ repeat: st.repeatValue, step: inner });
      } else {
        out.push({ repeat: null, step: st });
      }
    }
  }
  return out;
}

describe('parseStatedDuration', () => {
  it('reads hours and minutes together rather than the trailing minutes', () => {
    expect(parseStatedDuration('1 hr 45 min easy on hilly trail')).toBe(6300);
    expect(parseStatedDuration('4 hr 30 min at ultra effort')).toBe(16200);
  });

  it('reads bare hours and bare minutes', () => {
    expect(parseStatedDuration('2 hrs steady')).toBe(7200);
    expect(parseStatedDuration('55 min easy trail run')).toBe(3300);
  });

  it('takes the midpoint of a range', () => {
    expect(parseStatedDuration("Goal is 'Time on Feet' (~75-80 mins), not pace")).toBe(4650);
  });

  it('ignores a time that describes an effort rather than the session', () => {
    expect(
      parseStatedDuration('5km continuous run at Threshold pace (a pace you could hold for approx. 1 hour)'),
    ).toBeNull();
  });

  it('ignores a fuelling note', () => {
    expect(parseStatedDuration('Long trail effort. Carry kit and fuel every 30-40 min.')).toBeNull();
  });
});

describe('parseStatedRunDistanceMeters', () => {
  it('reads a distance given in kilometres', () => {
    expect(parseStatedRunDistanceMeters('25.8km long run')).toBe(25800);
  });

  it('ignores a bare metre figure, which is never the session itself', () => {
    // Strides, a hill length and vertical gain all read as "<n>m" in this prose.
    expect(parseStatedRunDistanceMeters('Very easy jog with a few 100m strides')).toBeNull();
    expect(parseStatedRunDistanceMeters('race terrain. 800m+ vert. Full kit')).toBeNull();
  });
});

describe('parseStatedRecovery', () => {
  it('keeps a recovery stated as a distance', () => {
    expect(parseStatedRecovery('8x600m at Interval pace, with 400m easy jog recovery between each'))
      .toEqual({ durationType: 'DISTANCE', durationValue: 400 });
  });

  it('keeps a recovery stated as a time', () => {
    expect(parseStatedRecovery('5x1.2km at Threshold pace, with 90 seconds easy jog recovery'))
      .toEqual({ durationType: 'TIME', durationValue: 90 });
    expect(parseStatedRecovery('with 2 minutes easy jog recovery'))
      .toEqual({ durationType: 'TIME', durationValue: 120 });
  });

  it('reads through a "full" qualifier', () => {
    expect(parseStatedRecovery('8x400m (faster than 5k pace), with full 400m jog recovery'))
      .toEqual({ durationType: 'DISTANCE', durationValue: 400 });
  });

  it('returns null when the row only gestures at recovery', () => {
    expect(parseStatedRecovery('3x1200m uphill, with easy jog back down for recovery')).toBeNull();
    expect(parseStatedRecovery('with full recovery')).toBeNull();
  });

  it('does not read the rep itself as its own recovery', () => {
    expect(parseStatedRecovery('run 4x1 minute at race effort with full recovery')).toBeNull();
    expect(parseStatedRecovery('8x600m at Interval pace, with 400m easy jog recovery between each'))
      .toEqual({ durationType: 'DISTANCE', durationValue: 400 });
  });

  it('ignores a recovery run description, which is a session not a rep gap', () => {
    expect(parseStatedRecovery('50-60 min easy recovery run')).toBeNull();
  });
});

describe('run sessions built from stored rows', () => {
  it('keeps a threshold run on its distance despite the pace descriptor', () => {
    const w = mapRunDay(day('Threshold Run', [
      run({ type: 'tempo', distance: 2, description: '2km easy jog warm-up.', effortLevel: 7 }),
      run({
        type: 'tempo', distance: 5, effortLevel: 7,
        description: '5km continuous run at Threshold pace (comfortably hard, a pace you could hold for approx. 1 hour).',
      }),
      run({ type: 'tempo', distance: 1.5, description: '1.5km easy jog cool-down.', effortLevel: 7 }),
    ]));

    const steps = flatten(w);
    expect(steps.map((s) => [s.step.intensity, s.step.durationType, s.step.durationValue])).toEqual([
      ['WARMUP', 'DISTANCE', 2000],
      ['ACTIVE', 'DISTANCE', 5000],
      ['COOLDOWN', 'DISTANCE', 1500],
    ]);
  });

  it('builds intervals with the recovery the row states', () => {
    const w = mapRunDay(day('VO2 Max Intervals', [
      run({ type: 'intervals', distance: 1.5, description: '1.5km easy jog warm-up.', effortLevel: 8 }),
      run({
        type: 'intervals', distance: 0.6, noIntervals: 8, effortLevel: 8,
        description: '8x600m at Interval pace, with 400m easy jog recovery between each.',
      }),
      run({ type: 'intervals', distance: 1.5, description: '1.5km easy jog cool-down.', effortLevel: 8 }),
    ]));

    expect(flatten(w).map((s) => [s.repeat, s.step.intensity, s.step.durationType, s.step.durationValue]))
      .toEqual([
        [null, 'WARMUP', 'DISTANCE', 1500],
        [8, 'INTERVAL', 'DISTANCE', 600],
        [8, 'RECOVERY', 'DISTANCE', 400],
        [null, 'COOLDOWN', 'DISTANCE', 1500],
      ]);
  });

  it('never leaves a rep recovery open, defaulting by rep length', () => {
    const long = mapRunDay(day('Hill Repeats: Long Climbs', [
      run({ type: 'tempo', distance: 2, description: '2km easy jog warm-up.', effortLevel: 7 }),
      run({
        type: 'tempo', distance: 1.2, noIntervals: 3, effortLevel: 7,
        description: '3x1200m uphill at Threshold effort, with easy jog back down for recovery.',
      }),
      run({ type: 'tempo', distance: 2, description: '2km easy jog cool-down.', effortLevel: 7 }),
    ]));
    const longRec = flatten(long).find((s) => s.step.intensity === 'RECOVERY')!.step;
    expect([longRec.durationType, longRec.durationValue]).toEqual(['TIME', 120]);

    const short = mapRunDay(day('Hill Repeats: Short & Steep', [
      run({ type: 'intervals', distance: 2, description: '2km easy jog warm-up.', effortLevel: 8 }),
      run({
        type: 'intervals', distance: 0.25, noIntervals: 8, effortLevel: 8,
        description: '8x250m hard uphill repeats, with easy jog back down for recovery.',
      }),
      run({ type: 'intervals', distance: 2, description: '2km easy jog cool-down.', effortLevel: 8 }),
    ]));
    const shortRec = flatten(short).find((s) => s.step.intensity === 'RECOVERY')!.step;
    expect([shortRec.durationType, shortRec.durationValue]).toEqual(['TIME', 90]);
  });

  it('bookends a structured session that stores no warm-up or cool-down', () => {
    const w = mapRunDay(day('Treadmill Incline Session', [
      run({
        type: 'intervals', distance: 0.7, noIntervals: 5, effortLevel: 8,
        description: '3 min at VO2 effort at 6% incline',
      }),
    ]));

    const steps = flatten(w);
    expect([steps[0].step.intensity, steps[0].step.durationType, steps[0].step.durationValue])
      .toEqual(['WARMUP', 'TIME', 900]);
    expect([steps.at(-1)!.step.intensity, steps.at(-1)!.step.durationType])
      .toEqual(['COOLDOWN', 'OPEN']);
  });

  it('sends a steady run as time when the description states one', () => {
    const w = mapRunDay(day('Long Run', [
      run({ type: 'long', distance: 16.4, effortLevel: 4,
            description: '1 hr 45 min easy on hilly trail. Carry kit + fuel every 30-40 min.' }),
    ]));

    const steps = flatten(w);
    expect(steps).toHaveLength(1);
    expect([steps[0].step.durationType, steps[0].step.durationValue]).toEqual(['TIME', 6300]);
  });

  it('falls back to the stored distance when the description states no unit', () => {
    const w = mapRunDay(day('Easy Run', [
      run({ distance: 8, description: 'Conversational pace to build aerobic base.', effortLevel: 3 }),
    ]));

    const steps = flatten(w);
    expect([steps[0].step.durationType, steps[0].step.durationValue]).toEqual(['DISTANCE', 8000]);
  });

  it('uses the stored distance rather than a stride length mentioned in passing', () => {
    const w = mapRunDay(day('Final Shakeout Run', [
      run({ type: 'recovery', distance: 3, effortLevel: 2,
            description: 'Very easy jog with a few 100m strides to prime the system. No effort.' }),
    ]));

    const steps = flatten(w);
    expect([steps[0].step.durationType, steps[0].step.durationValue]).toEqual(['DISTANCE', 3000]);
  });

  it('targets work with the HR zone from RPE and leaves the bookends open', () => {
    const w = mapRunDay(day('VO2 Max Intervals', [
      run({ type: 'intervals', distance: 1.5, description: '1.5km easy jog warm-up.', effortLevel: 8 }),
      run({ type: 'intervals', distance: 0.8, noIntervals: 6, effortLevel: 8,
            description: '6x800m at Interval pace, with 400m easy jog recovery between each.' }),
      run({ type: 'intervals', distance: 1.5, description: '1.5km easy jog cool-down.', effortLevel: 8 }),
    ]));

    const steps = flatten(w);
    const work = steps.find((s) => s.step.intensity === 'INTERVAL')!.step;
    expect([work.targetType, work.targetValue]).toEqual(['HEART_RATE', 4]);

    for (const intensity of ['WARMUP', 'COOLDOWN', 'RECOVERY'] as const) {
      const step = steps.find((s) => s.step.intensity === intensity)!.step;
      expect([step.targetType, step.targetValue]).toEqual(['OPEN', null]);
    }
  });

  it('keeps a stored warm-up and cool-down on a day that is not interval work', () => {
    // A race day stores all three rows but matches no structured-session title.
    const w = mapRunDay(day('RACE DAY', [
      run({ distance: 2, description: '2km easy jog warm-up, drills, and strides.', effortLevel: 3 }),
      run({ distance: 10, description: 'Execute your race plan and give it your best effort!', effortLevel: 9 }),
      run({ distance: 1.5, description: '1.5km easy jog/walk cool-down.', effortLevel: 2 }),
    ]));

    expect(flatten(w).map((s) => [s.step.intensity, s.step.durationType, s.step.durationValue]))
      .toEqual([
        ['WARMUP', 'DISTANCE', 2000],
        ['ACTIVE', 'DISTANCE', 10000],
        ['COOLDOWN', 'DISTANCE', 1500],
      ]);
  });

  it('uses the row distance rather than a split described inside it', () => {
    const w = mapRunDay(day('Long Run', [
      run({ type: 'long', distance: 10, effortLevel: 4,
            description: 'Long run with a race-pace finish. Run the first 7km at a comfortable easy '
                       + 'pace, then push the final 3km.' }),
    ]));

    const steps = flatten(w);
    expect(steps).toHaveLength(1);
    expect([steps[0].step.durationType, steps[0].step.durationValue]).toEqual(['DISTANCE', 10000]);
  });

  it('rejects a duration that could not cover the row distance', () => {
    // One row holding a whole session in shorthand: the "2 min" belongs to a
    // walk inside it, not to the 5.2 km session.
    const w = mapRunDay(day('Treadmill Primer', [
      run({ type: 'tempo', distance: 5.2, effortLevel: 7,
            description: 'WU 10. 3x90s at 6% incline at race effort, 2 min walk. CD 5.' }),
    ]));

    const work = flatten(w).find((s) => s.step.intensity === 'ACTIVE')!.step;
    expect([work.durationType, work.durationValue]).toEqual(['DISTANCE', 5200]);
  });

  it('keeps a duration that fits the row distance', () => {
    const w = mapRunDay(day('Long Run', [
      run({ type: 'long', distance: 16.4, effortLevel: 4,
            description: '1 hr 45 min easy on hilly trail.' }),
    ]));

    const steps = flatten(w);
    expect([steps[0].step.durationType, steps[0].step.durationValue]).toEqual(['TIME', 6300]);
  });

  it('pushes nothing for a rest day stored as an empty run row', () => {
    expect(mapRunDay(day('Rest', [
      run({ type: 'recovery', distance: 0, effortLevel: 1,
            description: 'Complete rest day. Focus on nutrition and hydration.' }),
    ]))).toBeNull();
  });

  it('never gives a step both a time and a distance', () => {
    const w = mapRunDay(day('Threshold Run', [
      run({ type: 'tempo', distance: 2, description: '15 min easy warm-up', effortLevel: 3 }),
      run({ type: 'tempo', distance: 1.2, noIntervals: 4, description: '6 min at threshold effort', effortLevel: 8 }),
      run({ type: 'tempo', distance: 1.7, description: '10 min easy cool-down', effortLevel: 3 }),
    ]));

    for (const { step } of flatten(w)) {
      const timed = step.durationType === 'TIME';
      const measured = step.durationType === 'DISTANCE';
      expect(timed && measured).toBe(false);
      if (step.durationType !== 'OPEN') expect(step.durationValue).toBeGreaterThan(0);
    }
  });
});

describe('CSV-derived days', () => {
  it('still map through the text-parsing builders when no runSpec is present', () => {
    // groupRowsByDay() produces exercises without runSpec; the day must still map.
    const w = mapWorkoutDay({
      day: 3,
      title: 'Easy Run',
      exercises: [{ name: '30 minute easy run', details: 'RPE 3' }],
    });
    expect(w).not.toBeNull();
    expect(w!.sport).toBe('RUNNING');
  });
});
