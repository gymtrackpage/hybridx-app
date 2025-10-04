// src/app/api/admin/enhance-programs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

// ===================================================================
// TECHNIQUE CUES DATABASE
// ===================================================================

interface TechniqueCue {
  keywords: string[];
  cues: string[];
}

const TECHNIQUE_CUES: TechniqueCue[] = [
  // Hyrox-specific movements
  {
    keywords: ['skierg', 'ski erg'],
    cues: [
      '🎯 Pull with your core, not just arms',
      '⚡ Drive explosively with your legs',
      '🔄 Rhythm: Arms → Core → Legs (recovery phase)',
      '💡 Alternative: If no SkiErg available, use rowing machine with emphasis on lat pulldowns'
    ]
  },
  {
    keywords: ['sled push'],
    cues: [
      '🎯 Low body position, drive through the ground',
      '💪 Keep arms locked, use leg power',
      '⚙️ Short, powerful steps - don\'t overstride',
      '💡 Alternative: Heavy prowler push or treadmill at max incline walking'
    ]
  },
  {
    keywords: ['sled pull'],
    cues: [
      '🎯 Hand-over-hand technique, stay low',
      '💪 Engage lats and core with each pull',
      '🏃 Backpedal with control, don\'t trip',
      '💡 Alternative: Battle rope pulls or resistance band rows'
    ]
  },
  {
    keywords: ['burpee broad jump', 'burpee'],
    cues: [
      '🎯 Chest to ground, full hip extension on jump',
      '⚡ Explode forward, not just up',
      '🔄 Land softly, control your breathing',
      '💡 Race pace: Find sustainable rhythm early'
    ]
  },
  {
    keywords: ['rowing', 'row ', 'rower'],
    cues: [
      '🎯 Legs → Core → Arms (pull sequence)',
      '⚡ Drive hard with legs, finish with lat pull',
      '🔄 Recovery: Arms → Core → Legs (slow and controlled)',
      '⚙️ Damper setting: 4-6 for most athletes'
    ]
  },
  {
    keywords: ['farmer carry', 'farmers carry'],
    cues: [
      '🎯 Chest up, shoulders back, tight core',
      '💪 Grip with purpose - hook grip if needed',
      '🏃 Quick, short steps for stability',
      '💡 Alternative: Heavy dumbbell or kettlebell carry'
    ]
  },
  {
    keywords: ['sandbag lunge', 'sandbag'],
    cues: [
      '🎯 Torso upright, front knee tracks over toes',
      '💪 Drive through front heel to stand',
      '⚙️ Hug sandbag tight to chest',
      '💡 Alternative: Barbell front rack lunges or weighted vest walking lunges'
    ]
  },
  {
    keywords: ['wall ball', 'wall balls'],
    cues: [
      '🎯 Squat depth: hip crease below knee',
      '⚡ Explosive hip drive, throw to target',
      '🔄 Catch in squat position, absorb with legs',
      '⚙️ 10ft target standard, use legs not arms'
    ]
  },

  // General strength movements
  {
    keywords: ['back squat', 'squat'],
    cues: [
      '🎯 Depth: Hip crease below knee',
      '💪 Chest up, core braced, knees out',
      '⚡ Drive through midfoot, not toes',
      '🔄 Control descent, explode up'
    ]
  },
  {
    keywords: ['deadlift'],
    cues: [
      '🎯 Bar over midfoot, shoulders over bar',
      '💪 Lats tight, chest up, neutral spine',
      '⚡ Push the floor away, lock out hips',
      '⚙️ Hinge at hips, not spine'
    ]
  },
  {
    keywords: ['bench press'],
    cues: [
      '🎯 Retract shoulder blades, arch upper back',
      '💪 Bar path: Over shoulders, not throat',
      '⚡ Touch chest, drive through legs',
      '🔄 Elbows ~45° angle from body'
    ]
  },
  {
    keywords: ['overhead press', 'strict press', 'shoulder press'],
    cues: [
      '🎯 Vertical bar path, face moves back',
      '💪 Tight glutes and core',
      '⚡ Press through to lockout overhead',
      '⚙️ Don\'t hyperextend lower back'
    ]
  },
  {
    keywords: ['pull up', 'pull-up', 'pullup'],
    cues: [
      '🎯 Full hang to chin over bar',
      '💪 Engage lats, not just biceps',
      '⚡ Pull elbows down and back',
      '💡 Scale: Use band or ring rows if needed'
    ]
  },
  {
    keywords: ['box jump'],
    cues: [
      '🎯 Land softly with full foot contact',
      '⚡ Hip hinge load, explosive triple extension',
      '🔄 Step down, don\'t jump down',
      '💡 Alternative: Step-ups with knee drive'
    ]
  },
  {
    keywords: ['thruster'],
    cues: [
      '🎯 Front squat depth + overhead press',
      '⚡ One fluid motion, use leg drive',
      '💪 Elbows high in front rack',
      '⚙️ Bar path: Straight up from shoulders'
    ]
  },

  // Running cues
  {
    keywords: ['running', 'run ', 'jog'],
    cues: [
      '🎯 Midfoot strike, quick cadence (170-180 spm)',
      '💪 Upright posture, relaxed shoulders',
      '⚡ Breathe rhythmically (2-in, 2-out or 3-in, 2-out)',
      '🏃 Hyrox pace: Controlled, sustainable - not a sprint'
    ]
  },
  {
    keywords: ['sprint', 'intervals', 'tempo'],
    cues: [
      '🎯 Drive knees forward, powerful arm swing',
      '⚡ Max effort on work, full recovery on rest',
      '🔄 Focus on form even when fatigued',
      '💡 Hyrox race prep: Practice running after strength work'
    ]
  },

  // Core & Accessory
  {
    keywords: ['plank'],
    cues: [
      '🎯 Straight line: Ears, shoulders, hips, ankles',
      '💪 Squeeze glutes, brace core',
      '⚙️ Breathe steadily, don\'t hold breath',
      '💡 Progress: Add weight vest or single-arm hold'
    ]
  },
  {
    keywords: ['russian twist'],
    cues: [
      '🎯 Rotate from obliques, not just arms',
      '💪 Keep chest up, heels grounded or elevated',
      '⚙️ Controlled tempo, full rotation each side'
    ]
  },
  {
    keywords: ['kettlebell swing'],
    cues: [
      '🎯 Hip hinge, not squat',
      '⚡ Explosive hip snap drives kettlebell',
      '🔄 Arms are ropes, hips do the work',
      '⚙️ Kettlebell to chest height, not overhead'
    ]
  }
];

const EQUIPMENT_ALTERNATIVES: { [key: string]: string } = {
  'skierg': '💡 No SkiErg? Use rowing machine with focus on lat pulldowns or battle rope slams',
  'sled push': '💡 No sled? Use heavy prowler, weighted wheelbarrow, or treadmill at max incline',
  'sled pull': '💡 No sled? Use battle rope pulls, heavy resistance band rows, or partner-resisted backpedal',
  'rower': '💡 No rower? Use assault bike, ski erg, or run 400m per 500m row',
  'assault bike': '💡 No assault bike? Use rower, run, or stationary bike with high resistance',
  'sandbag': '💡 No sandbag? Use heavy dumbbell, kettlebell, or loaded backpack',
  'wall ball': '💡 No wall ball? Use medicine ball, basketball, or dumbbell thruster variation',
  'box': '💡 No box? Use stairs, bench, or stack of stable plates'
};

const WEEKLY_THEMES = [
  'Week 1 Theme: Movement Quality & Technique Foundation',
  'Week 2 Theme: Building Work Capacity',
  'Week 3 Theme: Strength Development',
  'Week 4 Theme: Deload & Recovery (60-70% intensity)',
  'Week 5 Theme: Race-Specific Endurance',
  'Week 6 Theme: Power & Speed',
  'Week 7 Theme: Peak Volume',
  'Week 8 Theme: Taper & Race Preparation'
];

function enhanceExerciseDetails(exerciseName: string, currentDetails: string): string {
  let enhanced = currentDetails;
  const lowerName = exerciseName.toLowerCase();

  for (const tech of TECHNIQUE_CUES) {
    const matches = tech.keywords.some(keyword => lowerName.includes(keyword));
    if (matches) {
      const newCues = tech.cues.filter(cue => !enhanced.includes(cue));
      if (newCues.length > 0) {
        enhanced += '\n\n' + newCues.join('\n');
      }
      break;
    }
  }

  for (const [equipment, alternative] of Object.entries(EQUIPMENT_ALTERNATIVES)) {
    if (lowerName.includes(equipment) && !enhanced.includes('Alternative:')) {
      enhanced += '\n\n' + alternative;
      break;
    }
  }

  return enhanced.trim();
}

function addWeeklyTheme(dayNumber: number): string {
  const weekIndex = Math.floor((dayNumber - 1) / 7);
  if (weekIndex < WEEKLY_THEMES.length) {
    return `📅 ${WEEKLY_THEMES[weekIndex]}\n\n`;
  }
  return '';
}

async function enhanceProgram(programId: string, programName: string) {
  const db = getAdminDb();
  const programRef = db.collection('programs').doc(programId);
  const programDoc = await programRef.get();

  if (!programDoc.exists) {
    return { success: false, error: `Program not found: ${programId}` };
  }

  const programData = programDoc.data();
  const workouts = programData?.workouts || [];

  let enhancementCount = 0;

  const enhancedWorkouts = workouts.map((workout: any) => {
    if (workout.title.toLowerCase().includes('rest')) {
      return workout;
    }

    let exercises = workout.exercises || [];

    exercises = exercises.map((exercise: any, exerciseIndex: number) => {
      const originalDetails = exercise.details || '';
      let enhancedDetails = originalDetails;

      if (exerciseIndex === 0 && (workout.day - 1) % 7 === 0) {
        const theme = addWeeklyTheme(workout.day);
        if (theme && !enhancedDetails.includes('Week ')) {
          enhancedDetails = theme + enhancedDetails;
        }
      }

      enhancedDetails = enhanceExerciseDetails(exercise.name, enhancedDetails);

      if (enhancedDetails !== originalDetails) {
        enhancementCount++;
      }

      return {
        ...exercise,
        details: enhancedDetails
      };
    });

    return {
      ...workout,
      exercises
    };
  });

  await programRef.update({
    workouts: enhancedWorkouts,
    lastEnhanced: new Date().toISOString(),
    enhancementVersion: 'v1.0-phase1'
  });

  return { success: true, enhancementCount, programName };
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
    const { mode = 'pilot', programIds } = body;

    const results = [];

    if (mode === 'pilot') {
      // Run pilot on first program only
      const result = await enhanceProgram(HYROX_PROGRAMS[0].id, HYROX_PROGRAMS[0].name);
      results.push(result);
    } else if (mode === 'all') {
      // Run on all programs
      for (const program of HYROX_PROGRAMS) {
        const result = await enhanceProgram(program.id, program.name);
        results.push(result);
      }
    } else if (mode === 'specific' && programIds) {
      // Run on specific programs
      for (const id of programIds) {
        const program = HYROX_PROGRAMS.find(p => p.id === id);
        if (program) {
          const result = await enhanceProgram(program.id, program.name);
          results.push(result);
        }
      }
    }

    const totalEnhancements = results.reduce((sum, r) => sum + (r.enhancementCount || 0), 0);

    return NextResponse.json({
      success: true,
      results,
      totalEnhancements,
      message: `Enhanced ${totalEnhancements} exercises across ${results.length} programs`
    });

  } catch (error: any) {
    console.error('Enhancement error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
