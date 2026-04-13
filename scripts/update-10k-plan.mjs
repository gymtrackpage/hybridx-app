/**
 * Updates the "10k Running Plan" with coaching improvements:
 * 1. Posterior chain strength circuit (1 session/week, weeks 1–9)
 * 2. Progressive long runs with marathon-pace finishes in build phase
 * 3. Recovery run pacing guidance on all easy run days
 * 4. Time Trial (Day 60) rewritten with full protocol & how to use result
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PROGRAM_ID = 'jYNyJoDcdJVCLCq3zxZw';

// ─── Posterior chain strength circuit (intermediate level) ────────────────────
const STRENGTH_CIRCUIT = [
  {
    name: 'Single-Leg Romanian Deadlift',
    details: '3 sets × 10 reps per leg. Stand on one leg, hinge at the hip, lowering torso until roughly parallel to floor. Drive back up through the standing heel. Keep a flat back. Use a wall for balance if needed. Prevents hamstring strains — the most common 10K training injury.',
  },
  {
    name: 'Hip Thrusts / Glute Bridges',
    details: '3 sets × 20 reps. Upper back on floor or bench, feet flat, drive hips explosively to full extension, squeeze glutes hard at top. For progresssion: hold 2 sec at top, or add a resistance band above knees. Powers the glute drive that produces your running speed.',
  },
  {
    name: 'Single-Leg Calf Raises (slow)',
    details: '3 sets × 15 reps per leg. Stand on edge of a step. Rise fully to toes (1 sec), lower heel 3 seconds below step level. The slow lowering is the key — it loads the Achilles tendon to prevent tendinopathy and shin splints at higher mileage.',
  },
  {
    name: 'Copenhagen Side Plank',
    details: '3 sets × 20 seconds per side. Side plank with top foot on a bench or chair seat. Hold. Hip adductors stabilize your pelvis during the single-leg push-off phase of running — weakness here causes IT band syndrome and knee pain.',
  },
  {
    name: 'Dead Bug',
    details: '3 sets × 8 reps per side. Lie on back, arms vertical, hips and knees at 90°. Slowly lower opposite arm and leg to just above the floor, exhaling fully. Return. Core stability from this drill directly prevents the torso collapse that ruins running economy when fatigued.',
  },
];

const PACE_GUIDANCE = 'Pace check: you should be able to hold a full conversation in complete sentences. If you can only manage short phrases, slow down. If you\'re running with someone faster, run alone today — a "recovery run" run at tempo pace defeats its own purpose.';

// Fetch the program
const docRef = db.collection('programs').doc(PROGRAM_ID);
const snap = await docRef.get();
const program = snap.data();
const workouts = program.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

function getDay(day) {
  return workouts.find(w => w.day === day);
}

// ─── 1. STRENGTH SESSIONS — one per week, on cross-train days ────────────────
// Weeks 1–9: cross-train days are 3, 10, 17, 24, 31, 38, 45, 52, 59
// Weeks 10–12 are taper — leave those alone.
const crossTrainDays = [3, 10, 17, 24, 31, 38, 45, 52, 59];
for (const dayNum of crossTrainDays) {
  const w = getDay(dayNum);
  w.title = 'Strength & Posterior Chain';
  w.runs = [{
    type: 'recovery',
    distance: 0,
    paceZone: 'recovery',
    description: 'No running today. Complete the posterior chain strength circuit below (~35 min). These 5 exercises target the exact muscles that fail first in 10K training: hamstrings, glutes, calves, hip adductors, and core stability. Consistent strength work reduces injury risk by ~30% over a 12-week plan.',
    effortLevel: 2,
    noIntervals: 0,
  }];
  w.exercises = STRENGTH_CIRCUIT;
}

// ─── 2. PROGRESSIVE LONG RUNS ─────────────────────────────────────────────────
// Add marathon-pace finishes to build-phase long runs.
// Keep peak long run (Day 48, 20km) fully easy — don't layer intensity onto the highest volume day.
// Days 41 and 55 already have marathon paceZone on a single segment — split them properly.

// Day 27: 16km → 12km easy + 4km marathon pace
const day27 = getDay(27);
day27.title = 'Progressive Long Run';
day27.runs = [
  {
    type: 'long',
    distance: 12,
    paceZone: 'easy',
    description: 'First 12km at a fully conversational easy pace. This is the aerobic foundation — resist the urge to push. ' + PACE_GUIDANCE,
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'long',
    distance: 4,
    paceZone: 'marathon',
    description: 'Final 4km at marathon pace (comfortably hard — you can speak in short phrases but not full sentences). This builds fatigue resistance and teaches you to hold form and pace when your legs are already loaded. Walk if you need to in week 4 — this is a new stimulus.',
    effortLevel: 6,
    noIntervals: 1,
  },
];

// Day 34: 18km → 12km easy + 6km marathon pace
const day34 = getDay(34);
day34.title = 'Progressive Long Run';
day34.runs = [
  {
    type: 'long',
    distance: 12,
    paceZone: 'easy',
    description: 'First 12km at fully conversational easy pace. Focus on keeping effort steady — this section should feel almost too easy. ' + PACE_GUIDANCE,
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'long',
    distance: 6,
    paceZone: 'marathon',
    description: 'Final 6km at marathon pace. By week 5 this should feel challenging but controlled. If heart rate spikes above comfortable, dial back slightly — the fatigue-resistance adaptation still happens.',
    effortLevel: 6,
    noIntervals: 1,
  },
];

// Day 41: was a single 15km@marathon segment — split properly into 9km easy + 6km marathon
const day41 = getDay(41);
day41.title = 'Progressive Long Run';
day41.runs = [
  {
    type: 'long',
    distance: 9,
    paceZone: 'easy',
    description: 'First 9km at fully conversational easy pace. Week 6 is mid-cycle — the ability to push in the second half here is a key fitness marker.',
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'long',
    distance: 6,
    paceZone: 'marathon',
    description: 'Final 6km at marathon pace. Aim to run the last kilometre at your goal 10K race pace — just one kilometre, but it tells you if your fitness is on track.',
    effortLevel: 6,
    noIntervals: 1,
  },
];

// Day 48: 20km — KEEP FULLY EASY. Peak volume week. Don't compound fatigue.
// (No change needed — already @easy)

// Day 55: was a single 16km@marathon segment — split into 10km easy + 6km marathon (taper entry)
const day55 = getDay(55);
day55.title = 'Progressive Long Run (Final Build)';
day55.runs = [
  {
    type: 'long',
    distance: 10,
    paceZone: 'easy',
    description: 'First 10km at conversational easy pace. Weeks 8–9 volume starts tapering. This is the last demanding long run — run it smart.',
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'long',
    distance: 6,
    paceZone: 'marathon',
    description: 'Final 6km at marathon pace. You should be able to hit this comfortably now — if it still feels hard, it means your easy pace needs to slow down in training. Use this feedback going into the final 4 weeks.',
    effortLevel: 6,
    noIntervals: 1,
  },
];

// ─── 3. RECOVERY RUN GUIDANCE — all standalone easy run days ─────────────────
const easyRunDays = [1, 5, 8, 12, 15, 19, 22, 26, 29, 33, 36, 40, 43, 47, 50, 54, 57, 61, 64, 67, 68, 71];
for (const dayNum of easyRunDays) {
  const w = getDay(dayNum);
  if (w && w.runs && w.runs.length > 0) {
    w.runs[0].description = w.runs[0].description + ' ' + PACE_GUIDANCE;
  }
}

// ─── 4. TIME TRIAL — Day 60: full protocol + how to use the result ────────────
const day60 = getDay(60);
day60.title = '5K Time Trial';
day60.runs = [
  {
    type: 'easy',
    distance: 2,
    paceZone: 'easy',
    description: 'Warm-up: 10-minute easy jog, then 4×100m strides at 10K effort with 60-second walk recovery between each. Shake out the legs, feel sharp, breathe through the nerves. This warm-up is mandatory — starting a time trial cold significantly skews your result.',
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'intervals',
    distance: 5,
    paceZone: 'interval',
    description: 'Run 5km as fast as you can sustain from start to finish. This is your mid-plan 5K Time Trial. Start at your target 10K pace — if you can finish the last 1km faster, you started correctly. GPS or a measured 5km route recommended. Record your finish time.\n\nHow to use your result: Take your 5K time and multiply by 2.09 to estimate your current 10K race pace. Example: 22:00 5K → target 10K time ~46:00 (4:36/km pace). Use this to calibrate your race-pace intervals for weeks 9–12. If your time trial result is significantly faster than expected, update your target paces in your profile.',
    effortLevel: 10,
    noIntervals: 1,
  },
  {
    type: 'easy',
    distance: 2,
    paceZone: 'easy',
    description: '10-minute easy jog cool-down. Note your time, how the effort felt, and any kilometre splits in your session notes. This data is useful for your coach and for your own pattern recognition.',
    effortLevel: 3,
    noIntervals: 1,
  },
];

// ─── WRITE BACK ───────────────────────────────────────────────────────────────
console.log('Updating 10K Running Plan...');
await docRef.update({ workouts });
console.log('✅ Program updated successfully!\n');

// Verification
console.log('--- Verification ---');
for (const day of [3, 10, 27, 34, 41, 48, 55, 60, 5]) {
  const w = workouts.find(w => w.day === day);
  console.log(`Day ${String(day).padStart(2)}: ${w.title}`);
  if (w.exercises?.length) console.log(`         exercises: ${w.exercises.map(e => e.name).join(', ')}`);
  if (w.runs?.length) {
    w.runs.forEach((r, i) => {
      console.log(`         run[${i}]: ${r.distance}km @${r.paceZone} — ${r.description.substring(0, 80)}...`);
    });
  }
}
console.log('\nPace guidance check (Day 1):', workouts.find(w => w.day === 1).runs[0].description.includes('full conversation'));
