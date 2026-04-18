/**
 * HybridX → Garmin Training API workout mapper.
 *
 * Pure functions, no I/O. Takes WorkoutDay (one row per program day with
 * an array of {name, details} exercises) and emits a Garmin Training API
 * workout payload.
 *
 * Coverage:
 *  - Running: easy, long, intervals, tempo, threshold, hills, strides
 *  - Strength: sets × reps, AMRAPs, RPE-based, max-holds
 *  - Hyrox circuits / simulations: lap-button driven OTHER steps
 *  - Rest / welcome / race-day: returns null (skipped)
 *
 * Garmin enum IDs match the canonical Garmin Connect workout JSON.
 * Verify field names against the Partner Training API spec when going live.
 */

// ============================================================
// INPUT TYPES
// ============================================================

export interface CsvRow {
  programName: string;
  programDescription: string;
  workoutDay: number;
  workoutTitle: string;
  exerciseName: string;
  exerciseDetails: string;
}

export interface WorkoutDay {
  day: number;
  title: string;
  exercises: Array<{ name: string; details: string }>;
}

// ============================================================
// GARMIN TRAINING API OUTPUT TYPES
// ============================================================

export const SportType = {
  RUNNING: { sportTypeId: 1, sportTypeKey: 'running' },
  CYCLING: { sportTypeId: 2, sportTypeKey: 'cycling' },
  OTHER: { sportTypeId: 3, sportTypeKey: 'other' },
  STRENGTH: { sportTypeId: 5, sportTypeKey: 'strength_training' },
  CARDIO: { sportTypeId: 6, sportTypeKey: 'cardio_training' },
} as const;

export const StepType = {
  REST: { stepTypeId: 1, stepTypeKey: 'rest' },
  WARMUP: { stepTypeId: 2, stepTypeKey: 'warmup' },
  COOLDOWN: { stepTypeId: 3, stepTypeKey: 'cooldown' },
  INTERVAL: { stepTypeId: 4, stepTypeKey: 'interval' },
  RECOVERY: { stepTypeId: 5, stepTypeKey: 'recovery' },
  OTHER: { stepTypeId: 6, stepTypeKey: 'other' },
} as const;

export const DurationType = {
  TIME: { durationTypeId: 1, durationTypeKey: 'time' },
  DISTANCE: { durationTypeId: 2, durationTypeKey: 'distance' },
  OPEN: { durationTypeId: 3, durationTypeKey: 'open' },
  HR_REACHED: { durationTypeId: 4, durationTypeKey: 'heart.rate' },
  CALORIES: { durationTypeId: 5, durationTypeKey: 'calories' },
  REPS: { durationTypeId: 6, durationTypeKey: 'reps' },
} as const;

export const TargetType = {
  NO_TARGET: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
  POWER_ZONE: { workoutTargetTypeId: 2, workoutTargetTypeKey: 'power.zone' },
  CADENCE_ZONE: { workoutTargetTypeId: 3, workoutTargetTypeKey: 'cadence.zone' },
  HEART_RATE_ZONE: { workoutTargetTypeId: 4, workoutTargetTypeKey: 'heart.rate.zone' },
  SPEED_ZONE: { workoutTargetTypeId: 5, workoutTargetTypeKey: 'speed.zone' },
  PACE_ZONE: { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' },
} as const;

type SportTypeValue = (typeof SportType)[keyof typeof SportType];
type StepTypeValue = (typeof StepType)[keyof typeof StepType];
type DurationTypeValue = (typeof DurationType)[keyof typeof DurationType];
type TargetTypeValue = (typeof TargetType)[keyof typeof TargetType];

export interface ExecutableStep {
  type: 'ExecutableStepDTO';
  stepOrder: number;
  stepType: StepTypeValue;
  description?: string;
  durationType: DurationTypeValue;
  durationValue?: number;
  targetType: TargetTypeValue;
  targetValueOne?: number;
  targetValueTwo?: number;
  zoneNumber?: number;
}

export interface RepeatGroup {
  type: 'RepeatGroupDTO';
  stepOrder: number;
  numberOfIterations: number;
  workoutSteps: WorkoutStep[];
  smartRepeat?: boolean;
}

export type WorkoutStep = ExecutableStep | RepeatGroup;

export interface WorkoutSegment {
  segmentOrder: number;
  sportType: SportTypeValue;
  workoutSteps: WorkoutStep[];
}

export interface GarminWorkout {
  workoutName: string;
  description?: string;
  sport: SportTypeValue;
  estimatedDurationInSecs?: number;
  workoutSegments: WorkoutSegment[];
}

// ============================================================
// RPE → HR ZONE
// ============================================================

export function rpeToHrZone(rpe: number): number {
  if (rpe <= 3) return 1;
  if (rpe <= 6) return 2;
  if (rpe === 7) return 3;
  if (rpe === 8) return 4;
  return 5;
}

export function parseRpe(
  text: string,
): { zone: number; low: number; high: number } | null {
  const m = text.match(/RPE\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (!m) return null;
  const low = parseInt(m[1], 10);
  const high = m[2] ? parseInt(m[2], 10) : low;
  return { zone: rpeToHrZone(Math.round((low + high) / 2)), low, high };
}

// ============================================================
// NUMERIC PARSERS
// ============================================================

export function parseDurationMinutes(text: string): number | null {
  const m =
    text.match(/(\d+)\s*[- ]\s*minute/i) ||
    text.match(/(\d+)\s*minutes?\b/i) ||
    text.match(/(\d+)\s*min(?!\w)/i);
  return m ? parseInt(m[1], 10) * 60 : null;
}

export function parseDistanceMeters(text: string): number | null {
  const km = text.match(/(\d+(?:\.\d+)?)\s*km\b/i);
  if (km) return Math.round(parseFloat(km[1]) * 1000);
  const m = text.match(/(\d+)\s*m\b(?!in)/i);
  return m ? parseInt(m[1], 10) : null;
}

export function parseSetsReps(
  text: string,
): { sets: number; reps: number; repsMax?: number; isAmrap: boolean } | null {
  const amrap = text.match(/(\d+)\s*x\s*AMRAP/i);
  if (amrap) return { sets: parseInt(amrap[1], 10), reps: 0, isAmrap: true };
  if (/\bAMRAP\b/i.test(text) && !/\d+\s*min.*AMRAP/i.test(text)) {
    return { sets: 1, reps: 0, isAmrap: true };
  }
  const m = text.match(/(\d+)\s*x\s*(\d+)(?:\s*[-–]\s*(\d+))?\b(?!\s*m\b)/i);
  if (!m) return null;
  return {
    sets: parseInt(m[1], 10),
    reps: parseInt(m[2], 10),
    repsMax: m[3] ? parseInt(m[3], 10) : undefined,
    isAmrap: false,
  };
}

export function parseRunIntervals(
  text: string,
): { reps: number; distanceM?: number; timeS?: number } | null {
  const dist = text.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(km|m)\b/i);
  if (dist) {
    const reps = parseInt(dist[1], 10);
    const val = parseFloat(dist[2]);
    return {
      reps,
      distanceM: dist[3].toLowerCase() === 'km' ? val * 1000 : val,
    };
  }
  const time = text.match(/(\d+)\s*x\s*(\d+)[- ]?\s*(min|sec|second)/i);
  if (time) {
    const reps = parseInt(time[1], 10);
    const val = parseInt(time[2], 10);
    return {
      reps,
      timeS: time[3].toLowerCase().startsWith('min') ? val * 60 : val,
    };
  }
  return null;
}

export function parseRecoverySeconds(text: string): number | 'open' {
  const min = text.match(/(\d+)\s*min(?:ute)?s?\s*(?:jog\s*)?(?:recovery|rest)/i);
  if (min) return parseInt(min[1], 10) * 60;
  const sec = text.match(/(\d+)\s*sec(?:ond)?s?\s*(?:rest|recovery)/i);
  if (sec) return parseInt(sec[1], 10);
  return 'open';
}

// ============================================================
// CLASSIFIER
// ============================================================

export type WorkoutCategory =
  | 'rest'
  | 'skip'
  | 'run_easy'
  | 'run_intervals'
  | 'run_long'
  | 'run_benchmark'
  | 'strength'
  | 'hyrox_circuit'
  | 'hyrox_sim';

export function classifyWorkout(day: WorkoutDay): WorkoutCategory {
  const title = day.title.toLowerCase();
  const allText = (
    day.title +
    ' ' +
    day.exercises.map((e) => e.name + ' ' + e.details).join(' ')
  ).toLowerCase();

  if (day.day === 0) return 'skip';
  if (title.includes('welcome') || title.includes("what's next")) return 'skip';
  if (title.includes('race day')) return 'skip';

  if (
    title === 'rest' ||
    title === 'full rest' ||
    title.startsWith('rest ') ||
    title.includes('rest or active') ||
    title.includes('post-race recovery')
  ) {
    return 'rest';
  }

  if (title.includes('simulation') || title.includes('half-sim')) return 'hyrox_sim';
  if (
    title.includes('compromised running') ||
    title.includes('hyrox station') ||
    title.includes('hyrox skills')
  ) {
    return 'hyrox_circuit';
  }

  if (
    title.includes('threshold') ||
    title.includes('interval') ||
    title.includes('tempo') ||
    title.includes('hill')
  ) {
    return 'run_intervals';
  }
  if (title.includes('long slow') || title.includes('long run')) return 'run_long';
  if (title.includes('shakeout')) return 'run_intervals';
  if (title.includes('easy run') || title.includes('deload: easy')) return 'run_easy';
  if (title.includes('benchmark')) return 'run_benchmark';

  if (
    title.includes('strength') ||
    title.includes('power') ||
    title.includes('deload: light') ||
    title.includes('return to training') ||
    title.includes('unilateral')
  ) {
    return 'strength';
  }

  if (/squats|deadlift|press|lunge/.test(allText)) return 'strength';
  if (/\brun\b|\bjog\b/.test(allText)) return 'run_easy';

  return 'skip';
}

// ============================================================
// WORKOUT BUILDERS
// ============================================================

class StepCounter {
  private n = 0;
  next(): number {
    return ++this.n;
  }
}

function buildExecutable(
  counter: StepCounter,
  params: {
    stepType: StepTypeValue;
    description?: string;
    durationType?: DurationTypeValue;
    durationValue?: number;
    targetType?: TargetTypeValue;
    zoneNumber?: number;
  },
): ExecutableStep {
  return {
    type: 'ExecutableStepDTO',
    stepOrder: counter.next(),
    stepType: params.stepType,
    description: params.description,
    durationType: params.durationType ?? DurationType.OPEN,
    durationValue: params.durationValue,
    targetType: params.targetType ?? TargetType.NO_TARGET,
    zoneNumber: params.zoneNumber,
  };
}

function buildRepeatGroup(
  counter: StepCounter,
  iterations: number,
  buildInner: () => WorkoutStep[],
): RepeatGroup {
  const stepOrder = counter.next();
  const workoutSteps = buildInner();
  return {
    type: 'RepeatGroupDTO',
    stepOrder,
    numberOfIterations: iterations,
    workoutSteps,
  };
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function workoutName(day: WorkoutDay): string {
  // Garmin caps workout names around 50 chars on most devices.
  return truncate(`D${day.day} – ${day.title}`, 50);
}

function workoutDescription(day: WorkoutDay): string {
  return truncate(
    day.exercises.map((e) => `${e.name}: ${e.details}`).join('\n'),
    1000,
  );
}

// ------------------------------------------------------------
// Mapper: easy / long runs
// ------------------------------------------------------------

function mapRunEasy(day: WorkoutDay): GarminWorkout {
  const counter = new StepCounter();
  const details = day.exercises.map((e) => `${e.name} ${e.details}`).join(' ');
  const durationSecs = parseDurationMinutes(details) ?? 1800;
  const rpe = parseRpe(details);
  const zone = rpe?.zone ?? 2;

  const steps: WorkoutStep[] = [
    buildExecutable(counter, {
      stepType: StepType.INTERVAL,
      description: day.exercises.map((e) => e.name).join('; '),
      durationType: DurationType.TIME,
      durationValue: durationSecs,
      targetType: TargetType.HEART_RATE_ZONE,
      zoneNumber: zone,
    }),
  ];

  return {
    workoutName: workoutName(day),
    description: workoutDescription(day),
    sport: SportType.RUNNING,
    estimatedDurationInSecs: durationSecs,
    workoutSegments: [
      { segmentOrder: 1, sportType: SportType.RUNNING, workoutSteps: steps },
    ],
  };
}

// ------------------------------------------------------------
// Mapper: interval / threshold / hills / strides
// ------------------------------------------------------------

function mapRunIntervals(day: WorkoutDay): GarminWorkout {
  const counter = new StepCounter();
  const steps: WorkoutStep[] = [];
  let estimatedSecs = 0;

  const allText = day.exercises.map((e) => `${e.name} ${e.details}`).join(' ');

  const warmup = allText.match(/(\d+)\s*min(?:ute)?\s*warm[- ]?up/i);
  if (warmup) {
    const secs = parseInt(warmup[1], 10) * 60;
    steps.push(
      buildExecutable(counter, {
        stepType: StepType.WARMUP,
        durationType: DurationType.TIME,
        durationValue: secs,
      }),
    );
    estimatedSecs += secs;
  }

  const shakeout = allText.match(
    /(\d+)[- ]?minute\s*(?:easy\s*)?jog(?!\s*recovery)/i,
  );
  if (shakeout && !warmup) {
    const secs = parseInt(shakeout[1], 10) * 60;
    steps.push(
      buildExecutable(counter, {
        stepType: StepType.WARMUP,
        description: 'Easy jog',
        durationType: DurationType.TIME,
        durationValue: secs,
      }),
    );
    estimatedSecs += secs;
  }

  const intervalPatterns = findAllIntervalPatterns(allText);
  for (const pat of intervalPatterns) {
    const workSecs = pat.distanceM
      ? Math.round((pat.distanceM / 1000) * 270)
      : pat.timeS ?? 0;
    const recSecs = pat.recovery === 'open' ? 30 : pat.recovery;
    estimatedSecs += pat.reps * (workSecs + recSecs);

    const group = buildRepeatGroup(counter, pat.reps, () => {
      const workStep = buildExecutable(counter, {
        stepType: StepType.INTERVAL,
        description: pat.description,
        durationType: pat.distanceM ? DurationType.DISTANCE : DurationType.TIME,
        durationValue: pat.distanceM ?? pat.timeS,
        targetType: TargetType.HEART_RATE_ZONE,
        zoneNumber: pat.zone,
      });
      const recStep =
        pat.recovery === 'open'
          ? buildExecutable(counter, {
              stepType: StepType.RECOVERY,
              description: 'Jog/walk recovery — lap when ready',
              durationType: DurationType.OPEN,
            })
          : buildExecutable(counter, {
              stepType: StepType.RECOVERY,
              durationType: DurationType.TIME,
              durationValue: pat.recovery,
            });
      return [workStep, recStep];
    });
    steps.push(group);
  }

  const cooldown = allText.match(/(\d+)\s*min(?:ute)?\s*cool[- ]?down/i);
  if (cooldown) {
    const secs = parseInt(cooldown[1], 10) * 60;
    steps.push(
      buildExecutable(counter, {
        stepType: StepType.COOLDOWN,
        durationType: DurationType.TIME,
        durationValue: secs,
      }),
    );
    estimatedSecs += secs;
  }

  if (steps.length === 0) return mapRunEasy(day);

  return {
    workoutName: workoutName(day),
    description: workoutDescription(day),
    sport: SportType.RUNNING,
    estimatedDurationInSecs: estimatedSecs || undefined,
    workoutSegments: [
      { segmentOrder: 1, sportType: SportType.RUNNING, workoutSteps: steps },
    ],
  };
}

function findAllIntervalPatterns(text: string): Array<{
  reps: number;
  distanceM?: number;
  timeS?: number;
  zone: number;
  recovery: number | 'open';
  description: string;
}> {
  type Pat = ReturnType<typeof findAllIntervalPatterns>[number];
  const results: Pat[] = [];
  const byKey = new Map<string, number>();

  const regex = /(\d+)\s*x\s*(\d+(?:\.\d+)?)[- ]?\s*(km|m|min|sec|second|minute)\b/gi;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(text)) !== null) {
    const reps = parseInt(m[1], 10);
    const val = parseFloat(m[2]);
    const unit = m[3].toLowerCase();

    let distanceM: number | undefined;
    let timeS: number | undefined;
    if (unit === 'km') distanceM = val * 1000;
    else if (unit === 'm') distanceM = val;
    else if (unit.startsWith('min')) timeS = val * 60;
    else if (unit.startsWith('sec')) timeS = val;

    const key = `${reps}_${distanceM ?? `T${timeS}`}`;

    const start = Math.max(0, m.index - 20);
    const end = Math.min(text.length, m.index + m[0].length + 80);
    const localCtx = text.slice(start, end).toLowerCase();
    const postCtx = text.slice(m.index + m[0].length, m.index + m[0].length + 80);

    const rpe = parseRpe(localCtx);
    const isHard =
      /stride|hill sprint|sprint|maximal|all[- ]out|80% effort|90% effort/i.test(
        localCtx,
      );
    const zone = rpe?.zone ?? (isHard ? 5 : 4);

    let label: string;
    if (/\bstride/i.test(localCtx)) label = 'Strides';
    else if (/\bhill/i.test(localCtx) && timeS) label = 'Hill sprint';
    else if (distanceM && distanceM >= 1000) label = `${val}${unit} interval`;
    else if (distanceM) label = `${val}${unit} rep`;
    else if (timeS && timeS <= 60) label = 'Short rep';
    else label = 'Effort';

    let recovery: number | 'open' = 'open';
    const recMin = postCtx.match(/(\d+)\s*min(?:ute)?s?\s*(?:jog\s*)?(?:recovery|rest)/i);
    const recSec = postCtx.match(/(\d+)\s*sec(?:ond)?s?\s*(?:rest|recovery)/i);
    if (recMin) recovery = parseInt(recMin[1], 10) * 60;
    else if (recSec) recovery = parseInt(recSec[1], 10);

    const existingIdx = byKey.get(key);
    if (existingIdx !== undefined) {
      const existing = results[existingIdx];
      if (existing.recovery === 'open' && recovery !== 'open') {
        existing.recovery = recovery;
      }
      if (rpe && zone !== 4) existing.zone = zone;
      continue;
    }

    byKey.set(key, results.length);
    results.push({ reps, distanceM, timeS, zone, recovery, description: label });
  }

  return results;
}

// ------------------------------------------------------------
// Mapper: strength
// ------------------------------------------------------------

function mapStrength(day: WorkoutDay): GarminWorkout {
  const counter = new StepCounter();
  const steps: WorkoutStep[] = [];

  for (const ex of day.exercises) {
    const reps = parseSetsReps(ex.details);
    const rpe = parseRpe(ex.details);

    const timeMatch = ex.details.match(/(\d+)\s*minute/i);
    if (/max hold|dead hang/i.test(ex.name + ex.details)) {
      steps.push(
        buildRepeatGroup(counter, reps?.sets ?? 3, () => [
          buildExecutable(counter, {
            stepType: StepType.INTERVAL,
            description: `${ex.name} — max hold`,
            durationType: DurationType.OPEN,
          }),
          buildExecutable(counter, {
            stepType: StepType.REST,
            durationType: DurationType.OPEN,
          }),
        ]),
      );
      continue;
    }

    if (!reps && timeMatch && /of\s+/.test(ex.details)) {
      steps.push(
        buildExecutable(counter, {
          stepType: StepType.INTERVAL,
          description: ex.name,
          durationType: DurationType.TIME,
          durationValue: parseInt(timeMatch[1], 10) * 60,
        }),
      );
      continue;
    }

    if (reps) {
      const rpeLabel = rpe
        ? ` @ RPE ${rpe.low}${rpe.high !== rpe.low ? `-${rpe.high}` : ''}`
        : '';
      const repLabel = reps.isAmrap
        ? 'AMRAP'
        : reps.repsMax
          ? `${reps.reps}-${reps.repsMax}`
          : `${reps.reps}`;
      const description = `${ex.name} — ${repLabel}${rpeLabel}`;

      steps.push(
        buildRepeatGroup(counter, reps.sets, () => {
          const workStep: ExecutableStep = reps.isAmrap
            ? buildExecutable(counter, {
                stepType: StepType.INTERVAL,
                description,
                durationType: DurationType.OPEN,
              })
            : buildExecutable(counter, {
                stepType: StepType.INTERVAL,
                description,
                durationType: DurationType.REPS,
                durationValue: reps.repsMax ?? reps.reps,
              });
          const restStep = buildExecutable(counter, {
            stepType: StepType.REST,
            description: 'Rest 60–120s',
            durationType: DurationType.OPEN,
          });
          return [workStep, restStep];
        }),
      );
      continue;
    }

    steps.push(
      buildExecutable(counter, {
        stepType: StepType.OTHER,
        description: `${ex.name}: ${truncate(ex.details, 150)}`,
        durationType: DurationType.OPEN,
      }),
    );
  }

  return {
    workoutName: workoutName(day),
    description: workoutDescription(day),
    sport: SportType.STRENGTH,
    workoutSegments: [
      { segmentOrder: 1, sportType: SportType.STRENGTH, workoutSteps: steps },
    ],
  };
}

// ------------------------------------------------------------
// Mapper: Hyrox circuits / simulations
// ------------------------------------------------------------

function mapHyroxCircuit(day: WorkoutDay): GarminWorkout {
  const counter = new StepCounter();
  const steps: WorkoutStep[] = day.exercises.map((ex) =>
    buildExecutable(counter, {
      stepType: StepType.OTHER,
      description: `${ex.name}: ${truncate(ex.details, 180)}`,
      durationType: DurationType.OPEN,
    }),
  );

  return {
    workoutName: workoutName(day),
    description: workoutDescription(day),
    sport: SportType.CARDIO,
    workoutSegments: [
      { segmentOrder: 1, sportType: SportType.CARDIO, workoutSteps: steps },
    ],
  };
}

// ============================================================
// MAIN DISPATCHER
// ============================================================

export function mapWorkoutDay(day: WorkoutDay): GarminWorkout | null {
  const category = classifyWorkout(day);
  switch (category) {
    case 'skip':
    case 'rest':
      return null;
    case 'run_easy':
    case 'run_long':
      return mapRunEasy(day);
    case 'run_intervals':
      return mapRunIntervals(day);
    case 'run_benchmark': {
      const runEx = day.exercises.filter((e) =>
        /run|jog|time trial/i.test(e.name + ' ' + e.details),
      );
      if (runEx.length) return mapRunEasy({ ...day, exercises: runEx });
      return mapStrength(day);
    }
    case 'strength':
      return mapStrength(day);
    case 'hyrox_circuit':
    case 'hyrox_sim':
      return mapHyroxCircuit(day);
  }
}

// ============================================================
// CSV / FIRESTORE PIPELINE
// ============================================================

export function groupRowsByDay(rows: CsvRow[]): WorkoutDay[] {
  const map = new Map<number, WorkoutDay>();
  for (const row of rows) {
    if (!map.has(row.workoutDay)) {
      map.set(row.workoutDay, {
        day: row.workoutDay,
        title: row.workoutTitle,
        exercises: [],
      });
    }
    map.get(row.workoutDay)!.exercises.push({
      name: row.exerciseName,
      details: row.exerciseDetails,
    });
  }
  return Array.from(map.values()).sort((a, b) => a.day - b.day);
}

export interface MappedDay {
  day: number;
  title: string;
  category: WorkoutCategory;
  workout: GarminWorkout | null;
}

export function mapTrainingPlan(rows: CsvRow[]): MappedDay[] {
  return groupRowsByDay(rows).map((day) => ({
    day: day.day,
    title: day.title,
    category: classifyWorkout(day),
    workout: mapWorkoutDay(day),
  }));
}
