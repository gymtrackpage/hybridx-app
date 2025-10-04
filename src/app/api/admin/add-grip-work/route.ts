// src/app/api/admin/add-grip-work/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

const GRIP_WORK = {
  carries: {
    name: 'Grip Strength - Farmer Carries',
    details: `🤝 GRIP STRENGTH - FARMER CARRIES

3-4 Sets:
• 50m Farmer Carry (Heavy - 70-80% BW per hand)
• Walk with purpose, chest up, shoulders back
• Rest 90 sec between sets

🎯 Progression:
• Week 1: 3 sets, moderate weight (50-60% BW per hand)
• Week 3: 4 sets, heavier weight (60-70% BW per hand)
• Week 5: 4 sets, heavy weight (70-80% BW per hand)
• Week 7: 4 sets, max weight, focus on grip endurance

💡 Alternative: Heavy suitcase carry (one arm), KB rack carry, trap bar carry

🏆 Race Application: Direct transfer to Hyrox farmer carry station`
  },

  hangs: {
    name: 'Grip Strength - Dead Hangs',
    details: `🤝 GRIP STRENGTH - DEAD HANGS & HOLDS

Option A - Pull-up Bar Dead Hangs:
• 3-4 Sets x 30-45 sec
• Overhand grip, shoulders engaged (not fully relaxed)
• Rest 60 sec between sets

Option B - Barbell Holds:
• 3 Sets x 20-30 sec
• Hold loaded barbell (150-200% of body weight)
• DON'T use straps - build raw grip strength

🎯 Progression:
• Week 1: 3 sets x 30 sec
• Week 3: 4 sets x 35 sec
• Week 5: 4 sets x 40 sec
• Week 7: 4 sets x 45 sec or add weight (vest, belt)

💡 Alternative: Towel hangs (more challenging), fat bar holds

🏆 Race Application: Grip endurance for sled pulls, confident farmer carries when fatigued`
  },

  dynamic: {
    name: 'Grip Strength - KB Bottoms-Up Work',
    details: `🤝 GRIP STRENGTH - DYNAMIC GRIP & STABILITY

3 Sets of:
• KB Bottoms-Up Carry: 30m each arm (light-moderate KB)
• KB Bottoms-Up Press: 6-8 reps each arm
• Rest 90 sec between sets

🎯 Why: Forces maximum grip tension, wrist stability, shoulder activation

Alternatives:
• Plate Pinch Carries: 30m with 2x10lb plates pinched together
• Towel Pull-ups: 5-8 reps (drape towel over bar, grip towel ends)
• Fat Grip DB Work: Use Fat Gripz on any DB exercise (curls, rows, press)

🎯 Progression:
• Week 1: Light KB, focus on control
• Week 3: Moderate KB, add reps
• Week 5: Heavier KB, slower tempo
• Week 7: Max KB you can control

💡 Race Application: Grip endurance under fatigue, late-race carries when grip is challenged`
  }
};

function determineWorkoutType(workout: any): string {
  const title = workout.title.toLowerCase();
  const exercises = workout.exercises || [];
  const exerciseNames = exercises.map((e: any) => e.name.toLowerCase()).join(' ');

  if (title.includes('run') || exerciseNames.includes('run')) {
    return 'running';
  }
  if (title.includes('hyrox') || title.includes('sled') ||
      exerciseNames.includes('sled') || exerciseNames.includes('wall ball')) {
    return 'hyrox';
  }
  if (title.includes('metcon') || title.includes('conditioning') || title.includes('amrap')) {
    return 'conditioning';
  }
  return 'strength';
}

async function addGripWorkToProgram(programId: string, programName: string) {
  const db = getAdminDb();
  const programRef = db.collection('programs').doc(programId);
  const programDoc = await programRef.get();

  if (!programDoc.exists) {
    return { success: false, error: `Program not found: ${programId}` };
  }

  const programData = programDoc.data();
  const workouts = programData?.workouts || [];

  let gripAddedCount = 0;

  const enhancedWorkouts = workouts.map((workout: any) => {
    // Skip rest days
    if (workout.title.toLowerCase().includes('rest')) {
      return workout;
    }

    const weekNumber = Math.floor((workout.day - 1) / 7) + 1;
    const exercises = [...workout.exercises];
    const workoutType = determineWorkoutType(workout);

    // Check if already has grip work
    const hasGrip = exercises.some((e: any) =>
      e.name.toLowerCase().includes('grip') ||
      e.name.toLowerCase().includes('farmer') ||
      e.name.toLowerCase().includes('carry') ||
      e.name.toLowerCase().includes('dead hang') ||
      e.name.toLowerCase().includes('barbell hold') ||
      e.name.toLowerCase().includes('bottoms-up')
    );

    // Add grip work to strength/hyrox days on odd weeks
    if ((workoutType === 'strength' || workoutType === 'hyrox') && !hasGrip && weekNumber % 2 === 1) {
      const gripType = weekNumber <= 3 ? 'carries' :
                       weekNumber <= 6 ? 'hangs' : 'dynamic';

      const gripExercise = GRIP_WORK[gripType as keyof typeof GRIP_WORK];

      // Insert before cool-down if exists, otherwise at end
      const cooldownIndex = exercises.findIndex((e: any) =>
        e.name.toLowerCase().includes('cool-down') ||
        e.name.toLowerCase().includes('recovery')
      );

      if (cooldownIndex >= 0) {
        exercises.splice(cooldownIndex, 0, gripExercise);
      } else {
        exercises.push(gripExercise);
      }

      gripAddedCount++;
    }

    return {
      ...workout,
      exercises
    };
  });

  // Update the program
  await programRef.update({
    workouts: enhancedWorkouts,
    lastGripEnhancement: new Date().toISOString(),
    enhancementVersion: 'v2.1-grip-complete'
  });

  return {
    success: true,
    programName,
    gripAddedCount
  };
}

const HYROX_PROGRAMS = [
  { id: 'JrHDGwFm0Cn4sRJosApH', name: 'First Steps to Hyrox' },
  { id: 'j5qE8awNGl8IPoNzaVFH', name: 'Hyrox Fusion Balance' },
  { id: 'mTSbnEGsI9nzqDccm90B', name: 'Hyrox Run Performance' },
  { id: 'dBJAHOM8TqeMyanNG9s5', name: 'Ultra Elite Performance' },
  { id: 'uf3EsOGPMp5wGV7bPi1h', name: 'Hyrox Doubles & Relay Prep' },
  { id: 'QXpgKvrxjW4VfYspOlHQ', name: 'Olympic Lifting & Power Cycle' }
];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode = 'all' } = body;

    const results = [];

    if (mode === 'all') {
      for (const program of HYROX_PROGRAMS) {
        const result = await addGripWorkToProgram(program.id, program.name);
        results.push(result);
      }
    }

    const totalGrip = results.reduce((sum, r) => sum + (r.gripAddedCount || 0), 0);

    return NextResponse.json({
      success: true,
      results,
      totalGrip,
      message: `Added ${totalGrip} grip strength sessions across ${results.length} programs`
    });

  } catch (error: any) {
    console.error('Grip work enhancement error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
