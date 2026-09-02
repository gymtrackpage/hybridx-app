import { describe, expect, it } from 'vitest';

import { lookupGarminExercise } from '../program-enricher';

function expectMatch(name: string, category: string, exerciseName: string) {
  expect(lookupGarminExercise(name)).toEqual({ exerciseCategory: category, exerciseName });
}

describe('lookupGarminExercise — additions for previously-unmatched plan exercises', () => {
  it('matches Dead Bug as a core drill', () => {
    expectMatch('Dead Bug', 'CORE', 'DEAD_BUG');
  });

  it('matches Nordic hamstring curl without falling into the bicep/dumbbell/barbell curl rule', () => {
    expectMatch('Nordic hamstring curl', 'LEG_CURL', 'NORDIC_HAMSTRING_CURL');
    expectMatch('Nordic curl', 'LEG_CURL', 'NORDIC_HAMSTRING_CURL');
  });

  it('matches an isometric calf hold even without the word "raise"', () => {
    expectMatch('Single-leg calf iso hold', 'CALF_RAISE', 'SINGLE_LEG_CALF_RAISE');
    // The existing "raise" rule still covers this shape unchanged.
    expectMatch('Single-Leg Calf Raises (Eccentric)', 'CALF_RAISE', 'CALF_RAISE');
  });

  it('matches dip variants', () => {
    expectMatch('Dips (weighted)', 'TRICEPS_EXTENSION', 'TRICEPS_DIP');
  });

  it('matches banded and single-leg hip-stability drills', () => {
    expectMatch('Clamshells with Band', 'HIP_STABILITY', 'CLAMSHELL');
    expectMatch('Lateral Band Walk', 'HIP_STABILITY', 'LATERAL_BAND_WALK');
    expectMatch('Side-Lying Hip Abduction', 'HIP_STABILITY', 'SIDE_LYING_HIP_ABDUCTION');
    expectMatch('Single-Leg Balance', 'HIP_STABILITY', 'SINGLE_LEG_BALANCE');
    expectMatch('Single-Leg Balance with Perturbation', 'HIP_STABILITY', 'SINGLE_LEG_BALANCE');
  });

  it('matches band pull-aparts under ROW rather than a loaded row', () => {
    expectMatch('Band Pull-Aparts', 'ROW', 'BAND_PULL_APART');
  });

  it('matches step-up and step-down variants, box before bare step-up', () => {
    expectMatch('Step-Ups', 'LUNGE', 'STEP_UP');
    expectMatch('Box Step-Up with Knee Drive', 'LUNGE', 'BOX_STEP_UP');
    expectMatch('Slow eccentric step-down, 5s', 'LUNGE', 'STEP_DOWN');
  });

  it('matches "DL" as a deadlift abbreviation for trap bar and hex bar', () => {
    expectMatch('Trap bar DL', 'DEADLIFT', 'TRAP_BAR_DEADLIFT');
    expectMatch('Hex bar DL', 'DEADLIFT', 'TRAP_BAR_DEADLIFT');
    // The full-word form still matches as before.
    expectMatch('Trap bar deadlift', 'DEADLIFT', 'TRAP_BAR_DEADLIFT');
  });

  it('matches S2OH as a shoulder-to-overhead press', () => {
    expectMatch('S2OH', 'SHOULDER_PRESS', 'BARBELL_SHOULDER_PRESS');
    expectMatch('Shoulder-to-Overhead', 'SHOULDER_PRESS', 'BARBELL_SHOULDER_PRESS');
  });

  it('leaves a bare "Core" row unmatched rather than guessing at a movement', () => {
    expect(lookupGarminExercise('Core')).toBeNull();
  });

  it('does not regress existing matches', () => {
    expectMatch('Romanian Deadlift', 'DEADLIFT', 'ROMANIAN_DEADLIFT');
    expectMatch('Back Squat', 'SQUAT', 'BARBELL_SQUAT');
    expectMatch('Barbell Bicep Curl', 'CURL', 'DUMBBELL_BICEP_CURL');
    expectMatch('Bulgarian Split Squat', 'LUNGE', 'DUMBBELL_BULGARIAN_SPLIT_SQUAT');
  });
});
