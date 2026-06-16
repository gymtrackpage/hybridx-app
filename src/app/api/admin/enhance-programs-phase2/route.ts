// src/app/api/admin/enhance-programs-phase2/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ===================================================================
// PHASE 2 ENHANCEMENT COMPONENTS
// ===================================================================

// Warm-up protocols based on workout type
const WARMUP_PROTOCOLS = {
  strength: {
    name: 'Dynamic Warm-up (8-10 minutes)',
    details: `🔥 WARM-UP PROTOCOL

Part 1: General Prep (4 min)
• 2 min easy cardio (row, bike, or jog)
• 10 arm circles each direction
• 10 leg swings each direction
• 10 bodyweight squats (focus on depth)

Part 2: Movement Prep (4-6 min)
• 5 inchworms with push-up
• 10 walking lunges with twist
• 10 glute bridges
• 10 band pull-aparts
• 5 down dog to cobra flows

🎯 Goal: Elevate heart rate, mobilize joints, activate prime movers`
  },

  running: {
    name: 'Running-Specific Warm-up (10-12 minutes)',
    details: `🏃 RUNNING WARM-UP PROTOCOL

Part 1: Easy Jog (5 min)
• Start very easy, gradually increase pace
• Focus on relaxed shoulders, quick cadence

Part 2: Dynamic Drills (5-7 min)
• 20m A-skips (2x)
• 20m B-skips (2x)
• 20m high knees (2x)
• 20m butt kicks (2x)
• 20m straight leg bounds (2x)
• 4x20m progressive strides (build to 80% speed)

🎯 Goal: Activate running muscles, groove mechanics, prepare for intensity`
  },

  hyrox: {
    name: 'Hyrox-Specific Warm-up (10-12 minutes)',
    details: `🏋️ HYROX WARM-UP PROTOCOL

Part 1: General Prep (3 min)
• 400m easy jog or 2 min row

Part 2: Hyrox Movement Prep (7-9 min)
• 10 bodyweight squats
• 10 push-ups (hands elevated if needed)
• 10 KB swings (light)
• 20m sled push (empty sled or light weight)
• 5 wall balls (light ball, focus on technique)
• 10 burpees (controlled pace)
• 5 down-and-ups (practice getting up quickly)

🎯 Goal: Rehearse race movements, groove patterns, build confidence`
  },

  conditioning: {
    name: 'Conditioning Warm-up (8 minutes)',
    details: `⚡ CONDITIONING WARM-UP PROTOCOL

3 Rounds (6-8 min total):
• 200m easy jog or 30 sec row/bike
• 5 air squats
• 5 push-ups
• 5 sit-ups
• 10 jumping jacks

Then: 2 min of:
• Movement-specific prep at 50% intensity
• Example: If workout has burpees, do 10 slow burpees
• Example: If workout has box jumps, do 10 step-ups

🎯 Goal: Gradual ramp-up, prepare for higher heart rates`
  }
};

// Cool-down protocols
const COOLDOWN_PROTOCOL = {
  name: 'Cool-down & Recovery (8-10 minutes)',
  details: `❄️ COOL-DOWN PROTOCOL

Part 1: Active Recovery (3-4 min)
• Walk or very easy movement to bring heart rate down
• Deep breathing: 4-count inhale, 6-count exhale

Part 2: Static Stretching (5-6 min)
• Hip Flexor Stretch: 60 sec each side
• Quad Stretch: 45 sec each side
• Hamstring Stretch: 60 sec each side
• Calf Stretch: 45 sec each side
• Glute/Piriformis Stretch: 60 sec each side
• Lat/Shoulder Stretch: 30 sec each side

💡 Tips:
• Hold each stretch without bouncing
• Breathe deeply into the stretch
• Focus on major muscle groups worked today
• Use foam roller if available (glutes, quads, lats, calves)

🎯 Goal: Begin recovery process, reduce soreness, improve flexibility`
};

// Core work progressions by week
const CORE_FINISHERS = {
  week1to2: {
    name: 'Core Finisher - Foundation (8-10 minutes)',
    details: `💪 CORE WORK - WEEKS 1-2 (Foundation)

Superset A: 3 Rounds, 90 sec rest
• Front Plank: 45 sec hold (maintain straight line)
• Dead Bugs: 12 reps total (slow, controlled)
• Russian Twists: 20 reps total (light weight or bodyweight)

Superset B: 2 Rounds, 60 sec rest
• Side Plank: 30 sec each side (stack feet or stagger)
• Bird Dogs: 10 reps each side (3-sec hold at extension)

🎯 Focus: Quality over quantity, master positions, breathe throughout`
  },

  week3to5: {
    name: 'Core Finisher - Development (10-12 minutes)',
    details: `💪 CORE WORK - WEEKS 3-5 (Development)

Superset A: 3 Rounds, 75 sec rest
• Weighted Front Plank: 60 sec (plate on back)
• Hanging Knee Raises: 10-12 reps (or lying leg raises)
• Russian Twists: 24 reps total (moderate weight)

Superset B: 3 Rounds, 60 sec rest
• Side Plank with Hip Dips: 20 reps each side
• Pallof Press: 12 reps each side (anti-rotation focus)

Finisher:
• Hollow Hold: 3x20-30 sec (rest 30 sec between)

🎯 Focus: Add load/complexity, increase time under tension, anti-rotation strength`
  },

  week6to8: {
    name: 'Core Finisher - Peak (12-15 minutes)',
    details: `💪 CORE WORK - WEEKS 6-8 (Peak Performance)

Superset A: 4 Rounds, 60 sec rest
• Weighted Front Plank: 75 sec (heavy plate)
• Strict Toes-to-Bar: 8-10 reps (or controlled V-ups)
• Weighted Russian Twists: 30 reps total (heavy)

Superset B: 3 Rounds, 45 sec rest
• Copenhagen Plank: 30 sec each side (adductor focus)
• Pallof Press: 15 reps each side (heavy resistance)

Finisher:
• Hollow Rock: 3x30 sec continuous (rest 30 sec)
• L-Sit Hold: 3x20 sec (on parallettes or floor)

🎯 Focus: Max strength, sport-specific positions, race-ready core stability`
  }
};

// Grip strength work
const GRIP_WORK = {
  carries: {
    name: 'Farmer Carries',
    details: `🤝 GRIP STRENGTH - FARMER CARRIES

3-4 Sets:
• 50m Farmer Carry (Heavy - 70-80% BW per hand)
• Walk with purpose, chest up, shoulders back
• Rest 90 sec between sets

🎯 Progression:
• Week 1-2: 3 sets, moderate weight
• Week 3-5: 4 sets, heavier weight
• Week 6-8: 4 sets, max weight, slower walks

💡 Alternative: Heavy suitcase carry (one arm), KB rack carry, trap bar carry`
  },

  hangs: {
    name: 'Barbell/Pull-up Bar Holds',
    details: `🤝 GRIP STRENGTH - DEAD HANGS

3-4 Sets:
• Dead Hang from Pull-up Bar: 30-45 sec
• Overhand grip, shoulders engaged (not fully relaxed)
• Rest 60 sec between sets

OR

• Barbell Holds: 3x20-30 sec
• Hold loaded barbell (150-200% of body weight)
• DON'T use straps - build raw grip

🎯 Progression:
• Week 1-2: 3 sets x 30 sec
• Week 3-5: 4 sets x 40 sec
• Week 6-8: 4 sets x 45 sec or add weight (vest, belt)

💡 Race Application: Strong grip = confident sled pulls, farmer carries`
  },

  dynamic: {
    name: 'Kettlebell Bottoms-Up Work',
    details: `🤝 GRIP STRENGTH - DYNAMIC GRIP

3 Sets:
• KB Bottoms-Up Carry: 30m each arm (light-moderate KB)
• KB Bottoms-Up Press: 6-8 reps each arm
• Rest 90 sec between sets

🎯 Why: Forces maximum grip tension, wrist stability, shoulder activation

Alternatives:
• Plate Pinch Carries: 30m with 2x10lb plates pinched
• Towel Pull-ups: 5-8 reps (drape towel over bar, grip towel)
• Fat Grip DB Work: Use Fat Gripz on any DB exercise

💡 Race Application: Grip endurance for late-race carries`
  }
};

// Short workout expansions
function expandShortWorkout(workout: any, weekNumber: number): any[] {
  const exercises = [...workout.exercises];
  const workoutType = determineWorkoutType(workout);

  const additions: any[] = [];

  // Add warm-up if missing
  const hasWarmup = exercises.some((e: any) =>
    e.name.toLowerCase().includes('warm')
  );
  if (!hasWarmup) {
    const warmupType = workoutType === 'running' ? 'running' :
                       workoutType === 'hyrox' ? 'hyrox' :
                       workoutType === 'conditioning' ? 'conditioning' : 'strength';
    additions.unshift(WARMUP_PROTOCOLS[warmupType as keyof typeof WARMUP_PROTOCOLS]);
  }

  // Add core work to strength days
  if ((workoutType === 'strength' || workoutType === 'hyrox') && exercises.length < 5) {
    const corePhase = weekNumber <= 2 ? 'week1to2' :
                      weekNumber <= 5 ? 'week3to5' : 'week6to8';
    additions.push(CORE_FINISHERS[corePhase as keyof typeof CORE_FINISHERS]);
  }

  // Add grip work to strength/hyrox days (not already in workout)
  const hasGrip = exercises.some((e: any) =>
    e.name.toLowerCase().includes('grip') ||
    e.name.toLowerCase().includes('farmer') ||
    e.name.toLowerCase().includes('carry') ||
    e.name.toLowerCase().includes('dead hang') ||
    e.name.toLowerCase().includes('barbell hold')
  );

  // Add grip on strength or hyrox days, odd weeks only (to avoid overload)
  if ((workoutType === 'strength' || workoutType === 'hyrox') && !hasGrip && weekNumber % 2 === 1) {
    const gripType = weekNumber <= 3 ? 'carries' :
                     weekNumber <= 6 ? 'hangs' : 'dynamic';
    additions.push(GRIP_WORK[gripType as keyof typeof GRIP_WORK]);
  }

  // Add cool-down if missing
  const hasCooldown = exercises.some((e: any) =>
    e.name.toLowerCase().includes('cool') ||
    e.name.toLowerCase().includes('stretch')
  );
  if (!hasCooldown) {
    additions.push(COOLDOWN_PROTOCOL);
  }

  return additions;
}

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

// ===================================================================
// MAIN ENHANCEMENT FUNCTION
// ===================================================================

async function enhanceProgramPhase2(programId: string, programName: string) {
  const db = getAdminDb();
  const programRef = db.collection('programs').doc(programId);
  const programDoc = await programRef.get();

  if (!programDoc.exists) {
    return { success: false, error: `Program not found: ${programId}` };
  }

  const programData = programDoc.data();
  const workouts = programData?.workouts || [];

  let additionsCount = 0;
  let warmupCount = 0;
  let cooldownCount = 0;
  let coreCount = 0;
  let gripCount = 0;

  const enhancedWorkouts = workouts.map((workout: any) => {
    // Skip rest days
    if (workout.title.toLowerCase().includes('rest')) {
      return workout;
    }

    const weekNumber = Math.floor((workout.day - 1) / 7) + 1;
    const exercises = [...workout.exercises];
    const originalCount = exercises.length;

    // Get additions for short workouts
    const additions = expandShortWorkout(workout, weekNumber);

    // Track what was added
    additions.forEach(add => {
      if (add.name.toLowerCase().includes('warm')) warmupCount++;
      if (add.name.toLowerCase().includes('cool')) cooldownCount++;
      if (add.name.toLowerCase().includes('core')) coreCount++;
      if (add.name.toLowerCase().includes('grip')) gripCount++;
    });

    // Insert additions in logical order
    const finalExercises = [];

    // 1. Warm-up first
    const warmup = additions.find(a => a.name.toLowerCase().includes('warm'));
    if (warmup) finalExercises.push(warmup);

    // 2. Original exercises
    finalExercises.push(...exercises);

    // 3. Core work
    const core = additions.find(a => a.name.toLowerCase().includes('core'));
    if (core) finalExercises.push(core);

    // 4. Grip work
    const grip = additions.find(a => a.name.toLowerCase().includes('grip'));
    if (grip) finalExercises.push(grip);

    // 5. Cool-down last
    const cooldown = additions.find(a => a.name.toLowerCase().includes('cool'));
    if (cooldown) finalExercises.push(cooldown);

    additionsCount += finalExercises.length - originalCount;

    return {
      ...workout,
      exercises: finalExercises
    };
  });

  // Update the program
  await programRef.update({
    workouts: enhancedWorkouts,
    lastEnhancedPhase2: new Date().toISOString(),
    enhancementVersion: 'v2.0-complete'
  });

  return {
    success: true,
    programName,
    additionsCount,
    breakdown: {
      warmupCount,
      cooldownCount,
      coreCount,
      gripCount
    }
  };
}

// ===================================================================
// API ENDPOINT
// ===================================================================

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
    const { mode = 'pilot', programIds } = body;

    const results = [];

    if (mode === 'pilot') {
      const result = await enhanceProgramPhase2(HYROX_PROGRAMS[0].id, HYROX_PROGRAMS[0].name);
      results.push(result);
    } else if (mode === 'all') {
      for (const program of HYROX_PROGRAMS) {
        const result = await enhanceProgramPhase2(program.id, program.name);
        results.push(result);
      }
    } else if (mode === 'specific' && programIds) {
      for (const id of programIds) {
        const program = HYROX_PROGRAMS.find(p => p.id === id);
        if (program) {
          const result = await enhanceProgramPhase2(program.id, program.name);
          results.push(result);
        }
      }
    }

    const totalAdditions = results.reduce((sum, r) => sum + (r.additionsCount || 0), 0);

    return NextResponse.json({
      success: true,
      results,
      totalAdditions,
      message: `Added ${totalAdditions} new components across ${results.length} programs`
    });

  } catch (error) {
    console.error('Phase 2 enhancement error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
