import Papa from 'papaparse';
import type {
  Program,
  Workout,
  RunningWorkout,
  Exercise,
  PlannedRun,
  PaceZone,
  ProgramType,
  WorkoutDay,
} from '@/models/types';
import { hasExercises, hasRuns } from '@/lib/type-guards';

export const UNIFIED_CSV_HEADERS = [
  'id',
  'programName',
  'programDescription',
  'programType',
  'targetRace',
  'workoutDay',
  'workoutTitle',
  'rowType',
  'exerciseName',
  'exerciseDetails',
  'runType',
  'runDistance',
  'runPaceZone',
  'runDescription',
  'runEffortLevel',
  'noIntervals',
] as const;

type UnifiedRow = Record<(typeof UNIFIED_CSV_HEADERS)[number], string>;

const VALID_PROGRAM_TYPES: ProgramType[] = ['hyrox', 'running', 'hybrid'];
const VALID_RUN_TYPES: PlannedRun['type'][] = ['easy', 'tempo', 'intervals', 'long', 'recovery'];
const VALID_PACE_ZONES: PaceZone[] = ['recovery', 'easy', 'marathon', 'threshold', 'interval', 'repetition'];
const VALID_TARGET_RACES = ['mile', '5k', '10k', 'half-marathon', 'marathon'] as const;

function makeBaseRow(program: Program, workout: WorkoutDay): UnifiedRow {
  const targetRace =
    (workout as RunningWorkout).targetRace ??
    (program as Program & { targetRace?: string }).targetRace ??
    '';
  return {
    id: program.id ?? '',
    programName: program.name,
    programDescription: program.description,
    programType: program.programType,
    targetRace: String(targetRace ?? ''),
    workoutDay: String(workout.day),
    workoutTitle: workout.title,
    rowType: '',
    exerciseName: '',
    exerciseDetails: '',
    runType: '',
    runDistance: '',
    runPaceZone: '',
    runDescription: '',
    runEffortLevel: '',
    noIntervals: '',
  };
}

export function programToCsv(program: Program): string {
  const rows: UnifiedRow[] = [];

  const sortedWorkouts = [...program.workouts].sort((a, b) => a.day - b.day);

  for (const workout of sortedWorkouts) {
    let emitted = false;

    if (hasExercises(workout)) {
      for (const exercise of workout.exercises) {
        const row = makeBaseRow(program, workout);
        row.rowType = 'exercise';
        row.exerciseName = exercise.name;
        row.exerciseDetails = exercise.details;
        rows.push(row);
        emitted = true;
      }
    }

    if (hasRuns(workout)) {
      for (const run of workout.runs) {
        const row = makeBaseRow(program, workout);
        row.rowType = 'run';
        row.runType = run.type;
        row.runDistance = String(run.distance);
        row.runPaceZone = run.paceZone;
        row.runDescription = run.description;
        row.runEffortLevel = String(run.effortLevel);
        row.noIntervals = run.noIntervals != null ? String(run.noIntervals) : '';
        rows.push(row);
        emitted = true;
      }
    }

    if (!emitted) {
      // Empty rest day — emit a placeholder row so the day round-trips.
      const row = makeBaseRow(program, workout);
      row.rowType = 'exercise';
      rows.push(row);
    }
  }

  return Papa.unparse(
    { fields: [...UNIFIED_CSV_HEADERS], data: rows },
    { quotes: true },
  );
}

export interface ParsedProgram {
  id?: string;
  data: Omit<Program, 'id'>;
}

export function isUnifiedCsv(headers: string[]): boolean {
  return headers.includes('rowType');
}

export function csvToProgram(csv: string): ParsedProgram {
  const result = Papa.parse<Record<string, string>>(csv, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    throw new Error(`Failed to parse CSV: ${result.errors[0].message}`);
  }
  const rows = result.data;
  if (rows.length === 0) throw new Error('CSV is empty.');

  return rowsToProgram(rows);
}

export function rowsToProgram(rows: Record<string, string>[]): ParsedProgram {
  if (rows.length === 0) throw new Error('CSV is empty.');

  const first = rows[0];
  const programName = (first.programName ?? '').trim();
  const programDescription = (first.programDescription ?? '').trim();
  const programTypeRaw = (first.programType ?? '').trim();

  if (!programName) throw new Error('CSV must include programName.');
  if (!programDescription) throw new Error('CSV must include programDescription.');
  if (!programTypeRaw) throw new Error('CSV must include programType (hyrox, running, or hybrid).');
  if (!VALID_PROGRAM_TYPES.includes(programTypeRaw as ProgramType)) {
    throw new Error(`Invalid programType "${programTypeRaw}". Must be one of: ${VALID_PROGRAM_TYPES.join(', ')}.`);
  }
  const programType = programTypeRaw as ProgramType;

  const targetRaceRaw = (first.targetRace ?? '').trim();
  let targetRace: (typeof VALID_TARGET_RACES)[number] | undefined;
  if (targetRaceRaw) {
    if (!(VALID_TARGET_RACES as readonly string[]).includes(targetRaceRaw)) {
      throw new Error(`Invalid targetRace "${targetRaceRaw}". Must be one of: ${VALID_TARGET_RACES.join(', ')}.`);
    }
    targetRace = targetRaceRaw as (typeof VALID_TARGET_RACES)[number];
  }

  const id = (first.id ?? '').trim() || undefined;

  type Bucket = { day: number; title: string; exercises: Exercise[]; runs: PlannedRun[] };
  const buckets = new Map<number, Bucket>();

  rows.forEach((row, idx) => {
    const lineNum = idx + 2; // +1 for header, +1 for 1-indexed
    const dayRaw = (row.workoutDay ?? '').trim();
    if (!dayRaw) throw new Error(`Row ${lineNum}: workoutDay is required.`);
    const day = parseInt(dayRaw, 10);
    if (isNaN(day)) throw new Error(`Row ${lineNum}: invalid workoutDay "${dayRaw}".`);

    const title = (row.workoutTitle ?? '').trim();
    if (!title) throw new Error(`Row ${lineNum}: workoutTitle is required.`);

    let bucket = buckets.get(day);
    if (!bucket) {
      bucket = { day, title, exercises: [], runs: [] };
      buckets.set(day, bucket);
    }

    const rowType = (row.rowType ?? '').trim().toLowerCase();
    if (rowType !== 'exercise' && rowType !== 'run') {
      throw new Error(`Row ${lineNum}: rowType must be "exercise" or "run".`);
    }

    if (rowType === 'exercise') {
      const name = (row.exerciseName ?? '').trim();
      const details = (row.exerciseDetails ?? '').trim();
      if (!name && !details) {
        // Allow empty placeholder rows for rest days so they round-trip without losing the day.
        return;
      }
      if (!name) throw new Error(`Row ${lineNum}: exerciseName is required for an exercise row.`);
      if (!details) throw new Error(`Row ${lineNum}: exerciseDetails is required for an exercise row.`);
      bucket.exercises.push({ name, details });
      return;
    }

    // run row
    const runTypeRaw = (row.runType ?? '').trim();
    if (!runTypeRaw) throw new Error(`Row ${lineNum}: runType is required for a run row.`);
    if (!VALID_RUN_TYPES.includes(runTypeRaw as PlannedRun['type'])) {
      throw new Error(`Row ${lineNum}: invalid runType "${runTypeRaw}". Must be one of: ${VALID_RUN_TYPES.join(', ')}.`);
    }

    const distanceRaw = (row.runDistance ?? '').trim();
    const distance = parseFloat(distanceRaw);
    if (distanceRaw === '' || isNaN(distance)) {
      throw new Error(`Row ${lineNum}: invalid runDistance "${distanceRaw}".`);
    }

    const paceZoneRaw = (row.runPaceZone ?? '').trim();
    if (!VALID_PACE_ZONES.includes(paceZoneRaw as PaceZone)) {
      throw new Error(`Row ${lineNum}: invalid runPaceZone "${paceZoneRaw}". Must be one of: ${VALID_PACE_ZONES.join(', ')}.`);
    }

    const description = (row.runDescription ?? '').trim();
    if (!description) throw new Error(`Row ${lineNum}: runDescription is required for a run row.`);

    const effortRaw = (row.runEffortLevel ?? '').trim();
    const effort = parseInt(effortRaw, 10);
    if (isNaN(effort) || effort < 1 || effort > 10) {
      throw new Error(`Row ${lineNum}: runEffortLevel must be an integer 1-10, got "${effortRaw}".`);
    }

    const noIntervalsRaw = (row.noIntervals ?? '').trim();
    let noIntervals: number | undefined;
    if (noIntervalsRaw) {
      const n = parseInt(noIntervalsRaw, 10);
      if (isNaN(n)) throw new Error(`Row ${lineNum}: invalid noIntervals "${noIntervalsRaw}".`);
      noIntervals = n;
    }

    bucket.runs.push({
      type: runTypeRaw as PlannedRun['type'],
      distance,
      paceZone: paceZoneRaw as PaceZone,
      description,
      effortLevel: effort as PlannedRun['effortLevel'],
      ...(noIntervals != null ? { noIntervals } : {}),
    });
  });

  const workouts: WorkoutDay[] = Array.from(buckets.values())
    .sort((a, b) => a.day - b.day)
    .map((b) => {
      if (b.runs.length > 0 && b.exercises.length === 0) {
        const w: RunningWorkout = {
          day: b.day,
          title: b.title,
          runs: b.runs,
          programType: 'running',
          exercises: [],
          ...(targetRace ? { targetRace } : {}),
        };
        return w;
      }
      if (b.exercises.length > 0 && b.runs.length === 0) {
        const w: Workout = {
          day: b.day,
          title: b.title,
          exercises: b.exercises,
          programType: 'hyrox',
        };
        return w;
      }
      // Hybrid day or empty rest day — keep both arrays.
      return {
        day: b.day,
        title: b.title,
        exercises: b.exercises,
        runs: b.runs,
      } as unknown as WorkoutDay;
    });

  const data: Omit<Program, 'id'> = {
    name: programName,
    description: programDescription,
    programType,
    workouts,
    ...(targetRace ? ({ targetRace } as Partial<Program>) : {}),
  };

  return { id, data };
}

export function programFilename(program: Program): string {
  const slug = (program.name || 'program')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'program';
  return `${slug}.csv`;
}
