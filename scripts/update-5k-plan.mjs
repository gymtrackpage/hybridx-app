/**
 * Updates the "Improve your 5K time" program with coaching improvements:
 * 1. Form cues on every running session
 * 2. Bodyweight strength sessions (2/week) in weeks 1–3 (days 1–21)
 * 3. Day 10: Replace Rest/Cross-Train with Speed Play (Fartlek)
 * 4. Day 41: Fix paceZone 'marathon' → 'interval'; update description
 * 5. Day 56: Add "What's Next?" post-race guidance
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PROGRAM_ID = 've6fME6cJH6dDuSPrMSl';

const FORM_CUE = 'Form focus: tall posture, relaxed shoulders, midfoot landing under your hips, arms swinging forward/back (not across body), aim for 170–180 steps per minute cadence.';

const STRENGTH_CIRCUIT = [
  {
    name: 'Glute Bridges',
    details: '3 sets × 15 reps. Lie on back, feet flat, drive hips up squeezing glutes. Hold 2 sec at top. Rest 60s between sets. Strengthens glutes to prevent knee and IT band issues.',
  },
  {
    name: 'Single-Leg Calf Raises',
    details: '3 sets × 15 reps per leg. Stand on edge of a step, lower heel below step level, then rise fully onto toes. Lower slowly (3 sec). Prevents shin splints and Achilles issues.',
  },
  {
    name: 'Single-Leg Balance',
    details: '3 sets × 30 seconds per leg. Stand on one foot, slight knee bend. Progress: eyes open → eyes closed. Builds ankle stability and proprioception to prevent ankle sprains.',
  },
  {
    name: 'Step-Ups',
    details: '3 sets × 12 reps per leg. Use a step or low box (30–40cm). Drive through the heel of the leading leg to stand up. Lower under control. Strengthens single-leg power and hip stability.',
  },
];

// Append form cue to a run description
function withFormCue(description) {
  return `${description} ${FORM_CUE}`;
}

// Fetch the program
const docRef = db.collection('programs').doc(PROGRAM_ID);
const snap = await docRef.get();
if (!snap.exists) throw new Error('Program not found!');

const program = snap.data();
const workouts = program.workouts.map(w => ({ ...w }));

function getDay(day) {
  return workouts.find(w => w.day === day);
}

// ─── 1. FORM CUES ─────────────────────────────────────────────────────────────
// Add form cues to the MAIN run segment (not warmup/cooldown) of each workout.
// For easy/long runs, add to the single run. For structured workouts, add to the key interval/tempo set.

// Days with a single run (easy, long, recovery-with-notes)
const singleRunDays = [1, 5, 6, 8, 12, 13, 15, 19, 20, 22, 26, 27, 29, 33, 34, 36, 40, 43, 46, 47, 50, 51];
for (const dayNum of singleRunDays) {
  const w = getDay(dayNum);
  if (w && w.runs && w.runs.length > 0) {
    w.runs[0].description = withFormCue(w.runs[0].description);
  }
}

// Days with structured workouts (warmup[0] + MAIN[1] + cooldown[2]) — add cue to main segment only
const structuredDays = [2, 4, 9, 11, 16, 18, 23, 25, 30, 32, 37, 39, 44];
for (const dayNum of structuredDays) {
  const w = getDay(dayNum);
  if (w && w.runs && w.runs.length >= 2) {
    // Index 1 is the main working set
    w.runs[1].description = withFormCue(w.runs[1].description);
  }
}

// Day 41: long run with faster finish — main run is index 0 (only one segment)
// Handled in fix #4 below

// ─── 2. STRENGTH SESSIONS (weeks 1–3) ─────────────────────────────────────────
// Week 1: Day 3 (cross-train → strength circuit) and Day 5 (easy run + post-run strength)
// Week 2: Day 12 (easy run + post-run strength) and Day 14 (rest → active recovery + strength)
// Week 3: Day 17 (cross-train → strength circuit) and Day 19 (easy run + post-run strength)

// Day 3: Rest/Cross-Train → Strength Circuit
const day3 = getDay(3);
day3.title = 'Strength & Injury Prevention';
day3.runs = [{
  type: 'recovery',
  distance: 0,
  paceZone: 'recovery',
  description: 'No running today. Complete the bodyweight strength circuit below — these 4 exercises directly prevent the most common beginner running injuries: shin splints, IT band syndrome, and knee pain. Takes ~20 minutes.',
  effortLevel: 2,
  noIntervals: 0,
}];
day3.exercises = STRENGTH_CIRCUIT;

// Day 5: Easy Run — add post-run strength
const day5 = getDay(5);
day5.title = 'Easy Run + Strength';
day5.exercises = STRENGTH_CIRCUIT;

// Day 12: Easy Run — add post-run strength
const day12 = getDay(12);
day12.title = 'Easy Run + Strength';
day12.exercises = STRENGTH_CIRCUIT;

// Day 14: Rest → Active Recovery + Strength (light version)
const day14 = getDay(14);
day14.title = 'Active Recovery + Strength';
day14.runs = [{
  type: 'recovery',
  distance: 0,
  paceZone: 'recovery',
  description: 'Short 10-minute walk or light stretching to loosen up, then complete the strength circuit. Keeping the legs moving on rest days accelerates recovery and builds the connective tissue strength that prevents injury.',
  effortLevel: 1,
  noIntervals: 0,
}];
day14.exercises = STRENGTH_CIRCUIT;

// Day 17: Rest/Cross-Train → Strength Circuit
const day17 = getDay(17);
day17.title = 'Strength & Injury Prevention';
day17.runs = [{
  type: 'recovery',
  distance: 0,
  paceZone: 'recovery',
  description: 'No running today. Complete the bodyweight strength circuit. By week 3 these should feel easier — add a 5th set or slow the lowering phase of calf raises to 5 seconds.',
  effortLevel: 2,
  noIntervals: 0,
}];
day17.exercises = STRENGTH_CIRCUIT;

// Day 19: Easy Run — add post-run strength
const day19 = getDay(19);
day19.title = 'Easy Run + Strength';
day19.exercises = STRENGTH_CIRCUIT;

// ─── 3. DAY 10: Replace Rest/Cross-Train with SPEED PLAY ──────────────────────
const day10 = getDay(10);
day10.title = 'Speed Play';
day10.runs = [
  {
    type: 'easy',
    distance: 1.5,
    paceZone: 'easy',
    description: `10-minute easy warm-up jog. ${FORM_CUE}`,
    effortLevel: 3,
    noIntervals: 1,
  },
  {
    type: 'easy',
    distance: 3,
    paceZone: 'easy',
    description: 'Speed Play — 20 minutes of easy jogging with spontaneous surges: 4–5 times during the run, pick up the pace for 60 seconds (use a landmark — the next lamp post, top of a small hill, or just when you feel like it). No watch, no pressure. Return to easy jog between surges. This teaches your body to change gears and makes running feel more playful.',
    effortLevel: 5,
    noIntervals: 1,
  },
  {
    type: 'easy',
    distance: 1,
    paceZone: 'recovery',
    description: '5-minute easy walk/jog cool-down. Shake out the legs.',
    effortLevel: 2,
    noIntervals: 1,
  },
];
day10.exercises = [];

// ─── 4. DAY 41: Fix paceZone 'marathon' → 'interval' ─────────────────────────
// Note: The review doc referenced this as Day 40 (0-indexed); it is Day 41 in the DB.
const day41 = getDay(41);
day41.runs = [{
  type: 'long',
  distance: 10,
  paceZone: 'interval',
  description: `Long run with a race-pace finish. Run the first 7km at a comfortable easy pace, then push the final 3km at your goal 5K race pace (interval effort). This builds the mental and physical ability to push hard on tired legs — a critical 5K skill. ${FORM_CUE}`,
  effortLevel: 6,
  noIntervals: 1,
}];

// ─── 5. DAY 56: "What's Next?" guidance ───────────────────────────────────────
const day56 = getDay(56);
day56.title = "What's Next?";
day56.runs = [{
  type: 'recovery',
  distance: 0,
  paceZone: 'recovery',
  description: `Congratulations — you've completed the Improve Your 5K program! Take this week easy, then consider your next challenge:\n\n🏃 Ready to go further? Move to the 10K Running Plan — it builds directly on the aerobic base you've created.\n\n💪 Want to mix strength and speed? The First Steps to Hyrox program or Hyrox Fusion Balance introduces gym-based HYROX training alongside your running.\n\nKey maintenance tip: keep one easy run and one quality session per week to hold your fitness. And set a new 5K target date — racing regularly is the fastest way to improve.`,
  effortLevel: 1,
  noIntervals: 0,
}];

// ─── WRITE BACK ───────────────────────────────────────────────────────────────
console.log('Updating program...');
await docRef.update({ workouts });
console.log('✅ Program updated successfully!');

// Verify the key changes
console.log('\n--- Verification ---');
console.log('Day 3 title:', workouts.find(w => w.day === 3).title);
console.log('Day 3 exercises count:', workouts.find(w => w.day === 3).exercises.length);
console.log('Day 5 title:', workouts.find(w => w.day === 5).title);
console.log('Day 5 exercises count:', workouts.find(w => w.day === 5).exercises.length);
console.log('Day 10 title:', workouts.find(w => w.day === 10).title);
console.log('Day 10 runs count:', workouts.find(w => w.day === 10).runs.length);
console.log('Day 41 paceZone:', workouts.find(w => w.day === 41).runs[0].paceZone);
console.log('Day 56 title:', workouts.find(w => w.day === 56).title);
console.log('\nForm cue check (Day 1):', workouts.find(w => w.day === 1).runs[0].description.includes('tall posture'));
console.log('Form cue check (Day 2 main interval):', workouts.find(w => w.day === 2).runs[1].description.includes('tall posture'));
