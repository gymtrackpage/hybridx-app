// scripts/export-training-plans.ts
//
// Dumps every training plan and, for each program day, the exact Garmin
// payload the sync would push for it. The point is reviewability: the same
// adapter and mapper the live sync uses (`workoutToDays` → `mapWorkoutDay`)
// are called here, so what lands in the spreadsheet is what lands on the
// watch — not a second implementation that can drift from the first.
//
// Writes a JSON intermediate; scripts/build-training-plan-workbook.py turns
// that into the .xlsx. Splitting the two keeps the Firestore read (slow,
// credentialed) separate from workbook formatting (fast, re-runnable).
//
// Usage:
//   # against Firestore — needs a service account with Datastore read access
//   FIREBASE_SERVICE_ACCOUNT_KEY="$(cat sa.json)" npx tsx scripts/export-training-plans.ts --out plans.json
//   GOOGLE_APPLICATION_CREDENTIALS=sa.json  npx tsx scripts/export-training-plans.ts --out plans.json
//
//   # offline smoke test against a checked-in program fixture
//   npx tsx scripts/export-training-plans.ts --from-json src/data/running-programs.json --out plans.json

import * as fs from 'fs';
import * as admin from 'firebase-admin';
import { workoutToDays } from '@/lib/garmin/program-adapter';
import { mapWorkoutDay, classifyWorkout } from '@/lib/garmin/workout-mapper';
import type { WorkoutDay, GarminWorkout, WorkoutStep } from '@/lib/garmin/workout-mapper';
import type { Program, Workout, RunningWorkout, Exercise, PlannedRun } from '@/models/types';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'hyroxedgeai';

/** Collections holding programs. Both are mapped identically at sync time. */
const PROGRAM_COLLECTIONS = ['programs', 'customPrograms'] as const;

// ── Output shapes ─────────────────────────────────────────────────────────────

interface SessionExport {
  /** Index within the day's sessions, as `workoutToDays` ordered them. */
  sessionIdx: number;
  /** Key the sync writes into `users/{uid}.garminPlanSync.workouts`. */
  dayKey: string;
  sessionType?: string;
  garminSport?: string;
  /** What the heuristic classifier makes of this session, even when
   *  sessionType bypasses it — a disagreement is worth seeing. */
  category: string;
  /** null means the mapper declined to push anything for this session. */
  workout: GarminWorkout | null;
}

interface DayExport {
  day: number;
  title: string;
  sourceKind: 'running' | 'hyrox';
  exercises: Exercise[];
  runs: PlannedRun[];
  sessions: SessionExport[];
  /** Data-shape problems found on the stored day, before mapping. */
  dataFlags: string[];
}

interface ProgramExport {
  id: string;
  collection: string;
  name: string;
  description: string;
  programType: string;
  targetRace?: string;
  visibility?: string;
  assignedUserCount: number;
  retainedUserCount: number;
  days: DayExport[];
}

// ── Credential handling ───────────────────────────────────────────────────────

function credential(): admin.credential.Credential {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (raw) {
    // Accept either the JSON blob itself or a path to a key file, since the
    // App Hosting secret stores the blob but a temporary key arrives as a file.
    const json = raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf-8');
    return admin.credential.cert(JSON.parse(json));
  }
  return admin.credential.applicationDefault();
}

// ── Mapping ───────────────────────────────────────────────────────────────────

/**
 * Runs one program day through the real sync path.
 *
 * Mirrors src/app/api/garmin/sync-plan/route.ts: sessions come from
 * `workoutToDays`, the day key is bare for single-session days and
 * `${day}_${idx}` once a day splits, and a null mapper result is a skip.
 */
function exportDay(w: Workout | RunningWorkout): DayExport {
  const runs: PlannedRun[] = (w as RunningWorkout).runs ?? [];
  const dataFlags: string[] = [];

  // `workoutToDays` reads `w.exercises` unguarded, so a stored day without the
  // field throws there and takes the whole sync request down with it. Record
  // that and hand the mapper a normalised day, so one bad document doesn't
  // cost us the export of every other one.
  if (w.exercises == null) {
    dataFlags.push('stored day has no exercises[] — workoutToDays throws on this shape');
  }
  const exercises: Exercise[] = (w.exercises as Exercise[]) ?? [];
  const normalised = { ...w, exercises } as Workout | RunningWorkout;

  const sessions = workoutToDays(normalised);
  const dayStr = String(w.day);

  return {
    day: w.day,
    title: w.title,
    sourceKind: runs.length > 0 ? 'running' : 'hyrox',
    exercises,
    runs,
    dataFlags,
    sessions: sessions.map((session: WorkoutDay, idx: number) => ({
      sessionIdx: idx,
      dayKey: sessions.length > 1 ? `${dayStr}_${idx}` : dayStr,
      sessionType: session.sessionType,
      garminSport: session.garminSport,
      category: classifyWorkout(session),
      workout: mapWorkoutDay(session),
    })),
  };
}

function exportProgram(p: Program, collection: string): ProgramExport {
  return {
    id: p.id,
    collection,
    name: p.name ?? '',
    description: p.description ?? '',
    programType: p.programType ?? '',
    targetRace: (p as any).targetRace,
    visibility: p.visibility,
    assignedUserCount: p.assignedUserIds?.length ?? 0,
    retainedUserCount: p.retainedUserIds?.length ?? 0,
    days: (p.workouts ?? []).map(exportDay),
  };
}

// ── Sources ───────────────────────────────────────────────────────────────────

async function readFirestore(): Promise<ProgramExport[]> {
  admin.initializeApp({ credential: credential(), projectId: PROJECT_ID });
  const db = admin.firestore();
  const out: ProgramExport[] = [];

  for (const collection of PROGRAM_COLLECTIONS) {
    const snap = await db.collection(collection).get();
    console.error(`  ${collection}: ${snap.size} program(s)`);
    for (const doc of snap.docs) {
      out.push(exportProgram({ id: doc.id, ...doc.data() } as Program, collection));
    }
  }
  return out;
}

function readLocalJson(path: string): ProgramExport[] {
  const parsed = JSON.parse(fs.readFileSync(path, 'utf-8'));
  const programs: Program[] = Array.isArray(parsed) ? parsed : [parsed];
  return programs.map((p) => exportProgram(p, `local:${path}`));
}

// ── Entry point ───────────────────────────────────────────────────────────────

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const outPath = arg('--out') ?? 'training-plans.json';
  const fromJson = arg('--from-json');

  console.error(fromJson ? `Reading programs from ${fromJson}…` : 'Reading programs from Firestore…');
  const programs = fromJson ? readLocalJson(fromJson) : await readFirestore();

  const totalDays = programs.reduce((n, p) => n + p.days.length, 0);
  const totalSessions = programs.reduce(
    (n, p) => n + p.days.reduce((m, d) => m + d.sessions.length, 0), 0);
  const mapped = programs.reduce(
    (n, p) => n + p.days.reduce((m, d) => m + d.sessions.filter((s) => s.workout).length, 0), 0);

  fs.writeFileSync(outPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: fromJson ?? `firestore:${PROJECT_ID}`,
    programs,
  }, null, 2));

  console.error(
    `Wrote ${outPath}: ${programs.length} programs, ${totalDays} days, ` +
    `${totalSessions} sessions, ${mapped} pushed to Garmin, ${totalSessions - mapped} skipped.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
