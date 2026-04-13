/**
 * Updates the "Half Marathon Improver" program:
 * 1. Fix duration claim: "16-week" → "12-week" in name + description
 * 2. Add half-marathon-specific strength circuit to cross-train days (weeks 1–8)
 * 3. Properly split progressive long runs (Days 41, 55) into easy + marathon-pace segments
 *    + add recovery run pace guidance to all Recovery Run days
 * 4. Rewrite Day 46 Time Trial with full protocol + HM pace calculator
 * 5. Rewrite Day 68 Race Day with race morning warm-up protocol
 *    + Add "What's Next?" to Day 70 (final active day)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PROGRAM_ID = '5wjLfv0N4VWxxPT0ZxiO';

// ─── HM-specific posterior chain + core strength circuit ─────────────────────
const STRENGTH_CIRCUIT = [
  {
    name: 'Hip Thrusts / Glute Bridges',
    details: '3 sets × 20 reps. Upper back on floor or bench, feet flat. Drive hips explosively to full extension, squeeze glutes hard for 2 seconds. For progression: single-leg version, or add a resistance band above knees. The glutes are the primary power generator for half marathon pace — weakness here costs you minutes.',
  },
  {
    name: 'Single-Leg Calf Raises (Eccentric)',
    details: '3 sets × 15 reps per leg. Stand on edge of a step. Rise on two legs, lower on ONE leg over 4 slow seconds until heel is below step level. The slow lowering is what builds Achilles tendon resilience. Critical for preventing tendinopathy at high weekly mileage.',
  },
  {
    name: 'Copenhagen Side Plank',
    details: '3 sets × 25 seconds per side. Side plank with top foot on a bench or chair. The hip adductor muscles of your inner thigh stabilise your pelvis on every single foot strike. Weakness here causes IT band syndrome, groin strains, and lateral knee pain.',
  },
  {
    name: 'Dead Bug',
    details: '3 sets × 10 reps per side. Lie on back, arms pointing to ceiling, hips and knees at 90°. Keeping lower back pressed firmly to floor, slowly lower opposite arm and leg until just above the floor, exhale fully. Return. At 90+ minutes of running, your core is what keeps your form from collapsing — this exercise builds that endurance.',
  },
  {
    name: 'Side-Lying Hip Abduction',
    details: '3 sets × 15 reps per side. Lie on your side, top leg straight. Raise it to ~45° keeping toes pointing forward (not up). Lower slowly. Strengthens the gluteus medius — the muscle that prevents your pelvis from dropping sideways on each stride. Neglect this and you will develop IT band syndrome or runner\'s knee at peak mileage.',
  },
];

const RECOVERY_PACE_GUIDANCE = 'Pace check: you should be able to speak in full sentences without breathlessness throughout this entire run. If not, slow down — there is no minimum pace requirement here. Running recovery runs too fast is the most common training mistake; it accumulates fatigue without delivering an aerobic benefit. If your training partner is faster today, run alone.';

// Fetch the program
const docRef = db.collection('programs').doc(PROGRAM_ID);
const snap = await docRef.get();
const program = snap.data();
const workouts = program.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

function getDay(day) {
  return workouts.find(w => w.day === day);
}

// ─── 1. FIX DURATION METADATA ─────────────────────────────────────────────────
// Handled via the top-level update below (name + description fields)

// ─── 2. STRENGTH SESSIONS — weeks 1–8 cross-train days ───────────────────────
// Week 9 taper begins at day 57 — do not add strength sessions then or later.
const crossTrainDays = [3, 10, 17, 24, 31, 38, 45, 52];
for (const dayNum of crossTrainDays) {
  const w = getDay(dayNum);
  w.title = 'Strength & Posterior Chain';
  w.runs = [{
    type: 'recovery',
    distance: 0,
    paceZone: 'recovery',
    description: 'No running today. Complete the posterior chain strength circuit below (~35–40 min). Half marathon training at 5 days/week creates significant cumulative load on the glutes, Achilles, hip adductors, and core. This circuit directly addresses each failure point to keep you training through the full 12 weeks.',
    effortLevel: 2,
    noIntervals: 0,
  }];
  w.exercises = STRENGTH_CIRCUIT;
}

// ─── 3a. PROGRESSIVE LONG RUNS — split single marathon-pace segments ──────────
// Day 41: "Run the last 6km at Marathon Pace" — was one 18km@marathon segment
// Split: 12km easy + 6km @marathon
const day41 = getDay(41);
day41.title = 'Progressive Long Run';
day41.runs = [
  {
    type: 'long',
    distance: 12,
    paceZone: 'easy',
    description: 'First 12km at fully conversational easy pace — hold back, breathe through your nose, save your legs. Week 6 is mid-program peak — the quality comes in the second half.',
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'long',
    distance: 6,
    paceZone: 'marathon',
    description: 'Final 6km at your goal half marathon race pace (marathon paceZone = sustained threshold effort you can hold for 90+ min). This is the single most race-specific stimulus in the plan. Focus on form as your legs fatigue: tall posture, relaxed jaw, arms at 90°.',
    effortLevel: 6,
    noIntervals: 1,
  },
];

// Day 55: "Run the last 6km at Marathon Pace" — was one 16km@marathon segment
// This is week 8, first taper week. Split: 10km easy + 6km @marathon.
const day55 = getDay(55);
day55.title = 'Final Progressive Long Run';
day55.runs = [
  {
    type: 'long',
    distance: 10,
    paceZone: 'easy',
    description: 'First 10km at easy conversational pace. Taper is starting — overall volume is reduced but the quality stimulus is maintained. Trust the process.',
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'long',
    distance: 6,
    paceZone: 'marathon',
    description: 'Final 6km at half marathon race pace. This should feel controlled and strong — if it feels easy, your fitness is ahead of schedule. If it\'s a struggle, dial back intensity for the remaining 2 weeks and prioritise rest. Last long run before race day.',
    effortLevel: 6,
    noIntervals: 1,
  },
];

// ─── 3b. RECOVERY RUN PACE GUIDANCE — all Recovery Run days ──────────────────
const recoveryRunDays = [5, 12, 19, 26, 33, 40, 47, 54];
for (const dayNum of recoveryRunDays) {
  const w = getDay(dayNum);
  if (w && w.runs && w.runs.length > 0) {
    w.runs[0].description = w.runs[0].description + ' ' + RECOVERY_PACE_GUIDANCE;
  }
}

// ─── 4. TIME TRIAL — Day 46: rewrite with full protocol ─────────────────────
// Distance: 10K (appropriate mid-plan gauge for a half marathon target)
// This is in Week 7, after the 22km peak long run. Well-timed.
const day46 = getDay(46);
day46.title = '10K Time Trial';
day46.runs = [
  {
    type: 'easy',
    distance: 2,
    paceZone: 'easy',
    description: 'Warm-up: 10-minute easy jog, then 6×100m progressive strides (build each stride from 60% to 85% effort) with 45-second walk recovery between. Your legs should feel loose, light, and ready. Do not skip this — starting a time trial cold underestimates your fitness by 30–60 seconds over 10K.',
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'intervals',
    distance: 10,
    paceZone: 'interval',
    description: 'Run 10km at maximum sustainable effort from start to finish. Aim to run even splits or a slight negative split (second half marginally faster). Record your time and kilometre splits.\n\nHow to use your result:\n• Your half marathon target time ≈ 10K time × 2.223 (Example: 48:00 10K → 1:46:42 HM, or ~5:03/km pace)\n• Or: your HM pace ≈ your 10K pace + 18–25 seconds per km\n• If your time trial shows you are faster than your current HM target, update your goal pace for the race-pace sessions in weeks 8–10. Accurate target paces make those sessions dramatically more effective.',
    effortLevel: 10,
    noIntervals: 1,
  },
  {
    type: 'easy',
    distance: 2,
    paceZone: 'easy',
    description: '10-minute easy jog cool-down, then 5 minutes of leg shaking and walking. Log your kilometre splits, how each effort felt, and your finish time in session notes. This data is your training anchor for the final 5 weeks.',
    effortLevel: 3,
    noIntervals: 1,
  },
];

// ─── 5a. RACE DAY — Day 68: full race morning protocol ───────────────────────
const day68 = getDay(68);
day68.runs = [
  {
    type: 'easy',
    distance: 1.5,
    paceZone: 'easy',
    description: 'Race Morning Protocol (begin 40 minutes before your wave start):\n\n1. Nutrition: eat 2–3 hours before start (oats, banana, coffee if usual). Sip 400–600ml water in the 2 hours before — stop drinking 20 min before start.\n\n2. Warm-up (20 min before start): 8–10 min easy jog → 5 min dynamic drills (leg swings, hip circles, high knees, butt kicks) → 3×100m progressive strides at 50% → 70% → 85% effort with 60 sec walk recovery between each → arrive at start corral warm, breathing under control.\n\n3. Race strategy: go out at goal pace from the gun — do NOT bank time in the first 3km. Half marathon is won or lost in km 14–19. Aim for even splits or a slight negative split.',
    effortLevel: 4,
    noIntervals: 1,
  },
  {
    type: 'easy',
    distance: 21.1,
    paceZone: 'marathon',
    description: 'Execute your race plan. Target your goal half marathon pace. Km 1–5: controlled and relaxed, even if it feels easy — it should. Km 6–13: settle into rhythm, focus on form (tall posture, relaxed shoulders, arms at 90°). Km 14–19: this is your fitness test — hold the pace. Km 20–21.1: give everything you have left. Trust 12 weeks of work.',
    effortLevel: 10,
    noIntervals: 1,
  },
  {
    type: 'recovery',
    distance: 1.5,
    paceZone: 'recovery',
    description: 'Easy jog or walk cool-down. Collect your medal. Eat within 30 minutes (carbs + protein). Rehydrate steadily over the next 2 hours. You\'ve earned this.',
    effortLevel: 2,
    noIntervals: 1,
  },
];

// ─── 5b. WHAT'S NEXT — Day 70 (last day before blank rest weeks) ─────────────
const day70 = getDay(70);
day70.title = "What's Next?";
day70.runs = [{
  type: 'recovery',
  distance: 0,
  paceZone: 'recovery',
  description: 'Post-race recovery: days 1–7 after a half marathon should be completely unstructured. Walk if you want to, sleep as much as possible, eat well.\n\nWhat\'s next for your running:\n🏆 Ready to go further? The next natural step is a full marathon build — you now have the aerobic base. Aim for a 16–20 week marathon plan.\n\n⚡ Want to add strength? The Hyrox Fusion Balance or First Steps to Hyrox programs combine your running fitness with functional strength — a powerful combination for overall athletic performance.\n\n🎯 Want to go faster at the half marathon? Run one easy week, then re-enter this plan at Week 4 with updated target paces from your time trial result. Four more weeks of quality work can take 3–5 minutes off your next PB.',
  effortLevel: 1,
  noIntervals: 0,
}];

// ─── WRITE BACK ───────────────────────────────────────────────────────────────
console.log('Updating Half Marathon Improver...');
await docRef.update({
  name: '12-Week Half Marathon Improver',
  description: 'A 12-week plan for intermediate runners aiming for a new half marathon PB. This 5-day/week schedule is periodized to maximize your lactate threshold and endurance, with a strength component on cross-training days to reduce injury risk at peak mileage. Culminates in a 3-week taper and includes a mid-plan 10K time trial to calibrate your race-day target pace.',
  workouts,
});
console.log('✅ Done!\n');

// Verification
console.log('--- Key changes ---');
const updated = workouts;
console.log(`Name → 12-Week Half Marathon Improver`);
console.log(`Day 3  title: ${updated.find(w=>w.day===3).title}`);
console.log(`Day 3  exercises: ${updated.find(w=>w.day===3).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 41 runs: ${updated.find(w=>w.day===41).runs.map(r=>`${r.distance}km@${r.paceZone}`).join(' + ')}`);
console.log(`Day 46 title: ${updated.find(w=>w.day===46).title}`);
console.log(`Day 46 main paceZone: ${updated.find(w=>w.day===46).runs[1].paceZone}`);
console.log(`Day 55 runs: ${updated.find(w=>w.day===55).runs.map(r=>`${r.distance}km@${r.paceZone}`).join(' + ')}`);
console.log(`Day 68 runs: ${updated.find(w=>w.day===68).runs.map(r=>`${r.distance}km@${r.paceZone}`).join(' + ')}`);
console.log(`Day 70 title: ${updated.find(w=>w.day===70).title}`);
console.log(`Recovery run pace guidance (Day 5): ${updated.find(w=>w.day===5).runs[0].description.includes('full sentences')}`);
console.log(`Strength sessions count: ${crossTrainDays.length} (days ${crossTrainDays.join(', ')})`);
