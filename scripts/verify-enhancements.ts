// scripts/verify-enhancements.ts
/**
 * Script to verify program enhancements by fetching and displaying sample workouts
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCB_K8odTJ98LuCM5YGR6v8AbwykUzpaW4",
  authDomain: "hyroxedgeai.firebaseapp.com",
  projectId: "hyroxedgeai",
  storageBucket: "hyroxedgeai.firebasestorage.app",
  messagingSenderId: "321094496963",
  appId: "1:321094496963:web:7193225dfa2b160ddce876"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function verifyProgram(programId: string, programName: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📋 VERIFYING: ${programName}`);
  console.log(`${'='.repeat(80)}\n`);

  const programRef = doc(db, 'programs', programId);
  const programDoc = await getDoc(programRef);

  if (!programDoc.exists()) {
    console.log(`❌ Program not found`);
    return;
  }

  const programData = programDoc.data();
  const workouts = programData?.workouts || [];

  console.log(`📊 Total Workouts: ${workouts.length}`);
  console.log(`🔧 Last Enhanced: ${programData.lastEnhanced || 'Never'}`);
  console.log(`📦 Enhancement Version: ${programData.enhancementVersion || 'None'}\n`);

  // Show first non-rest workout with enhancements
  const firstWorkout = workouts.find((w: any) => !w.title.toLowerCase().includes('rest'));

  if (firstWorkout) {
    console.log(`\n${'-'.repeat(80)}`);
    console.log(`📅 SAMPLE WORKOUT - Day ${firstWorkout.day}: ${firstWorkout.title}`);
    console.log(`${'-'.repeat(80)}\n`);

    const exercises = firstWorkout.exercises || [];

    // Show first 3 exercises
    for (let i = 0; i < Math.min(3, exercises.length); i++) {
      const exercise = exercises[i];
      console.log(`\n💪 Exercise ${i + 1}: ${exercise.name}`);
      console.log(`${'-'.repeat(60)}`);
      console.log(exercise.details || 'No details');
      console.log(`${'-'.repeat(60)}`);
    }
  }

  // Count enhancements
  let enhancedCount = 0;
  let totalExercises = 0;

  for (const workout of workouts) {
    if (workout.title.toLowerCase().includes('rest')) continue;

    for (const exercise of workout.exercises || []) {
      totalExercises++;
      const details = exercise.details || '';

      // Check for enhancement markers
      if (details.includes('🎯') || details.includes('💡') || details.includes('⚡') ||
          details.includes('Week ') || details.includes('Alternative:')) {
        enhancedCount++;
      }
    }
  }

  console.log(`\n\n${'='.repeat(80)}`);
  console.log(`✅ ENHANCEMENT SUMMARY`);
  console.log(`${'='.repeat(80)}`);
  console.log(`📊 Total Exercises: ${totalExercises}`);
  console.log(`✨ Enhanced Exercises: ${enhancedCount}`);
  console.log(`📈 Enhancement Rate: ${((enhancedCount / totalExercises) * 100).toFixed(1)}%`);
  console.log(`${'='.repeat(80)}\n`);
}

async function main() {
  console.log('\n🔍 PROGRAM ENHANCEMENT VERIFICATION\n');

  // Verify First Steps to Hyrox (pilot program)
  await verifyProgram('JrHDGwFm0Cn4sRJosApH', 'First Steps to Hyrox');
}

main()
  .then(() => {
    console.log('\n✅ Verification complete');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  });
