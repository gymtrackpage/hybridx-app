/**
 * One-time migration script: enriches all Firestore program documents with
 * Garmin-structured fields on Exercise objects.
 *
 * Run via: npx ts-node --project tsconfig.json src/scripts/enrich-programs.ts
 *
 * Safe to run multiple times — existing manual values are never overwritten.
 */

import * as admin from 'firebase-admin';
import { enrichExerciseWithGarmin } from '../lib/garmin/program-enricher';
import type { Exercise, Workout, RunningWorkout } from '../models/types';

// Initialise Firebase Admin using Application Default Credentials.
// Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path.
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('programs').get();
  console.log(`Found ${snapshot.size} programs.`);

  let updated = 0;
  let unchanged = 0;

  for (const doc of snapshot.docs) {
    const program = doc.data();
    const workouts: (Workout | RunningWorkout)[] = program.workouts ?? [];

    let changed = false;
    const enrichedWorkouts = workouts.map((w) => {
      if (!('exercises' in w) || !w.exercises?.length) return w;

      const enrichedExercises = (w.exercises as Exercise[]).map((ex) => {
        const enriched = enrichExerciseWithGarmin(ex);
        const keys: (keyof Exercise)[] = [
          'garminExerciseCategory', 'garminExerciseName',
          'weightKg', 'restSeconds', 'sets', 'reps',
        ];
        const wasChanged = keys.some((k) => enriched[k] !== ex[k]);
        if (wasChanged) changed = true;
        return enriched;
      });

      return { ...w, exercises: enrichedExercises };
    });

    if (changed) {
      await doc.ref.update({ workouts: enrichedWorkouts });
      console.log(`  Updated: ${program.name ?? doc.id}`);
      updated++;
    } else {
      unchanged++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Unchanged: ${unchanged}`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
