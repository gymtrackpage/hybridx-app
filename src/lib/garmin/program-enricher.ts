/**
 * Auto-enriches Exercise objects with Garmin-structured fields using keyword
 * matching against the Garmin Training API exercise enum lookup table.
 *
 * If an exercise already has garminExerciseCategory set, it is left unchanged
 * (manual values always win over auto-detection).
 *
 * Also parses sets/reps/restSeconds from exercise.details when not already set,
 * using the same parsers that the workout-mapper uses at sync time — storing
 * the result on the exercise avoids re-parsing on every sync.
 */

import type { Exercise } from '@/models/types';
import { parseSetsReps, parseRecoverySeconds } from './workout-mapper';

// ── Garmin exercise lookup table ──────────────────────────────────────────────
// Rules are checked in order — more specific patterns must come before general ones.

interface GarminExerciseMatch {
  patterns: RegExp[];
  exerciseCategory: string;
  exerciseName: string;
}

const EXERCISE_LOOKUP: GarminExerciseMatch[] = [
  // Deadlift variants — specific first
  { patterns: [/romanian/i, /\brdl\b/i], exerciseCategory: 'DEADLIFT', exerciseName: 'ROMANIAN_DEADLIFT' },
  { patterns: [/sumo\s+deadlift/i], exerciseCategory: 'DEADLIFT', exerciseName: 'SUMO_DEADLIFT' },
  { patterns: [/trap\s*bar\s+deadlift/i, /hex\s*bar\s+deadlift/i], exerciseCategory: 'DEADLIFT', exerciseName: 'TRAP_BAR_DEADLIFT' },
  { patterns: [/deadlift/i], exerciseCategory: 'DEADLIFT', exerciseName: 'BARBELL_DEADLIFT' },

  // Squat variants
  { patterns: [/goblet\s+squat/i], exerciseCategory: 'SQUAT', exerciseName: 'GOBLET_SQUAT' },
  { patterns: [/wall\s*ball/i], exerciseCategory: 'SQUAT', exerciseName: 'WALL_BALL_SQUAT' },
  { patterns: [/front\s+squat/i], exerciseCategory: 'SQUAT', exerciseName: 'FRONT_SQUAT' },
  { patterns: [/box\s+squat/i], exerciseCategory: 'SQUAT', exerciseName: 'BOX_SQUAT' },
  { patterns: [/bulgarian\s+split\s+squat/i], exerciseCategory: 'LUNGE', exerciseName: 'DUMBBELL_BULGARIAN_SPLIT_SQUAT' },
  { patterns: [/jump\s+squat/i], exerciseCategory: 'PLYO', exerciseName: 'JUMP_SQUAT' },
  { patterns: [/squat/i], exerciseCategory: 'SQUAT', exerciseName: 'BARBELL_SQUAT' },

  // Hip raise / posterior chain
  { patterns: [/hip\s+thrust/i], exerciseCategory: 'HIP_RAISE', exerciseName: 'BARBELL_HIP_THRUST' },
  { patterns: [/glute\s+bridge/i], exerciseCategory: 'HIP_RAISE', exerciseName: 'BARBELL_GLUTE_BRIDGE' },
  { patterns: [/kettlebell\s+swing/i, /kb\s+swing/i], exerciseCategory: 'HIP_RAISE', exerciseName: 'KETTLEBELL_SWING' },

  // Carries
  { patterns: [/farmer.{0,6}carry/i, /farmer.{0,6}walk/i], exerciseCategory: 'CARRY', exerciseName: 'FARMERS_CARRY' },
  { patterns: [/overhead\s+carry/i], exerciseCategory: 'CARRY', exerciseName: 'OVERHEAD_CARRY' },
  { patterns: [/\bcarry\b/i], exerciseCategory: 'CARRY', exerciseName: 'FARMERS_CARRY' },

  // Bench press variants
  { patterns: [/incline\s+(?:dumbbell\s+)?(?:bench\s+)?press/i], exerciseCategory: 'BENCH_PRESS', exerciseName: 'INCLINE_DUMBBELL_BENCH_PRESS' },
  { patterns: [/dumbbell\s+(?:bench\s+)?press/i], exerciseCategory: 'BENCH_PRESS', exerciseName: 'DUMBBELL_BENCH_PRESS' },
  { patterns: [/bench\s+press/i], exerciseCategory: 'BENCH_PRESS', exerciseName: 'BARBELL_BENCH_PRESS' },

  // Shoulder / overhead press
  { patterns: [/push\s+press/i], exerciseCategory: 'SHOULDER_PRESS', exerciseName: 'BARBELL_SHOULDER_PRESS' },
  { patterns: [/overhead\s+press/i, /\bohp\b/i, /shoulder\s+press/i, /arnold\s+press/i], exerciseCategory: 'SHOULDER_PRESS', exerciseName: 'BARBELL_SHOULDER_PRESS' },

  // Pull-ups / chin-ups
  { patterns: [/weighted\s+(?:strict\s+)?pull.?up/i], exerciseCategory: 'PULL_UP', exerciseName: 'WEIGHTED_PULL_UP' },
  { patterns: [/kipping\s+pull.?up/i], exerciseCategory: 'PULL_UP', exerciseName: 'KIPPING_PULL_UP' },
  { patterns: [/burpee\s+pull.?up/i], exerciseCategory: 'PULL_UP', exerciseName: 'BURPEE_PULL_UP' },
  { patterns: [/pull.?up/i, /chin.?up/i], exerciseCategory: 'PULL_UP', exerciseName: 'PULL_UP' },

  // Rows — exclude sled (sled goes to CARDIO_TRAINING via hyrox circuit path)
  { patterns: [/seated\s+(?:cable\s+)?row/i], exerciseCategory: 'ROW', exerciseName: 'SEATED_CABLE_ROW' },
  { patterns: [/single\s+arm\s+(?:dumbbell\s+)?row/i, /one\s+arm\s+(?:dumbbell\s+)?row/i], exerciseCategory: 'ROW', exerciseName: 'ONE_ARM_DUMBBELL_ROW' },
  { patterns: [/barbell\s+row/i, /bent.?over\s+row/i], exerciseCategory: 'ROW', exerciseName: 'BARBELL_ROW' },
  { patterns: [/(?<!sled\s)\brow\b/i], exerciseCategory: 'ROW', exerciseName: 'BARBELL_ROW' },

  // Lunges
  { patterns: [/barbell\s+(?:walking\s+)?lunge/i], exerciseCategory: 'LUNGE', exerciseName: 'WALKING_BARBELL_LUNGE' },
  { patterns: [/dumbbell\s+(?:walking\s+)?lunge/i], exerciseCategory: 'LUNGE', exerciseName: 'DUMBBELL_LUNGE' },
  { patterns: [/reverse\s+lunge/i], exerciseCategory: 'LUNGE', exerciseName: 'REVERSE_DUMBBELL_LUNGE' },
  { patterns: [/lunge/i], exerciseCategory: 'LUNGE', exerciseName: 'WALKING_LUNGE' },

  // Plyo
  { patterns: [/box\s+jump/i], exerciseCategory: 'PLYO', exerciseName: 'BOX_JUMP' },
  { patterns: [/medicine\s+ball\s+slam/i, /med\s+ball\s+slam/i], exerciseCategory: 'PLYO', exerciseName: 'MEDICINE_BALL_SLAM' },
  { patterns: [/medicine\s+ball\s+(?:overhead\s+)?throw/i], exerciseCategory: 'PLYO', exerciseName: 'MEDICINE_BALL_OVERHEAD_THROW' },

  // Push-ups
  { patterns: [/push.?up/i], exerciseCategory: 'PUSH_UP', exerciseName: 'PUSH_UP' },

  // Core / plank
  { patterns: [/mountain\s+climber/i], exerciseCategory: 'PLANK', exerciseName: 'MOUNTAIN_CLIMBER' },
  { patterns: [/plank/i], exerciseCategory: 'PLANK', exerciseName: 'PLANK' },

  // Curl
  { patterns: [/bicep\s+curl/i, /dumbbell\s+curl/i, /barbell\s+curl/i], exerciseCategory: 'CURL', exerciseName: 'DUMBBELL_BICEP_CURL' },

  // Calf
  { patterns: [/calf\s+raise/i], exerciseCategory: 'CALF_RAISE', exerciseName: 'CALF_RAISE' },
];

export function lookupGarminExercise(
  name: string,
): { exerciseCategory: string; exerciseName: string } | null {
  for (const entry of EXERCISE_LOOKUP) {
    if (entry.patterns.some((p) => p.test(name))) {
      return { exerciseCategory: entry.exerciseCategory, exerciseName: entry.exerciseName };
    }
  }
  return null;
}

// ── Main enrichment function ──────────────────────────────────────────────────

export function enrichExerciseWithGarmin(exercise: Exercise): Exercise {
  const enriched: Exercise = { ...exercise };

  // Garmin category/name: only auto-populate if not already set manually
  if (!enriched.garminExerciseCategory) {
    const match = lookupGarminExercise(exercise.name);
    if (match) {
      enriched.garminExerciseCategory = match.exerciseCategory;
      enriched.garminExerciseName = match.exerciseName;
    }
  }

  // Sets/reps: parse from details text if not already set
  if (enriched.sets == null && enriched.reps == null) {
    const parsed = parseSetsReps(exercise.details);
    if (parsed && !parsed.isAmrap && parsed.sets > 0 && parsed.reps > 0) {
      enriched.sets = parsed.sets;
      enriched.reps = parsed.reps;
    }
  }

  // Rest seconds: parse from details text if not already set
  if (enriched.restSeconds == null) {
    const rest = parseRecoverySeconds(exercise.details);
    if (typeof rest === 'number') {
      enriched.restSeconds = rest;
    }
  }

  return enriched;
}
