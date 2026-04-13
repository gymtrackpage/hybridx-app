/**
 * Updates "Dual Peak: Trail & Strength":
 * 1. Fix data model: convert all strength sessions from run[recovery] → exercises[]
 * 2. Remove absolute weight examples → percentage-of-1RM only
 * 3. Reschedule Phase 1 strength sessions to avoid 3 consecutive hard days
 *    (Days 3→5, 10→12, 17→19 — strength moves off the hard-run sandwich)
 * 4. Add Phase Bridge on Day 31 (replaces abrupt Phase 1→2 transition)
 * 5. Update program description with clear prerequisite framing
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PROGRAM_ID = 'BtijMgolHGvf2P8QsZEK';

const docRef = db.collection('programs').doc(PROGRAM_ID);
const snap = await docRef.get();
const program = snap.data();
const workouts = program.workouts.map(w => ({ ...w, exercises: w.exercises || [], runs: w.runs || [] }));

function getDay(day) {
  return workouts.find(w => w.day === day);
}

// ─── Helper: make a day a pure strength day ───────────────────────────────────
function setStrengthDay(dayNum, title, introDescription, exercises) {
  const w = getDay(dayNum);
  w.title = title;
  w.runs = [];
  w.exercises = exercises;
  // Store session-level description in the first exercise's details prefix won't work well;
  // instead put the session intro as the first exercise placeholder entry
  // Actually: store intro as a special "Session Notes" exercise so it shows at the top
  w.exercises = [
    { name: '📋 Session Notes', details: introDescription },
    ...exercises,
  ];
}

// ─── Helper: make a day rest/cross-train ─────────────────────────────────────
function setRestDay(dayNum, title = 'Rest or Cross-Train') {
  const w = getDay(dayNum);
  w.title = title;
  w.runs = [{
    type: 'recovery',
    distance: 0,
    paceZone: 'recovery',
    description: 'Focus on mobility, light activity (swimming, cycling, walking), or complete rest. You have trained hard on consecutive days — use this time to recover so the next session lands on fresh legs.',
    effortLevel: 1,
    noIntervals: 0,
  }];
  w.exercises = [];
}

// ─── 1. PHASE 1 STRENGTH SESSION RESCHEDULING ────────────────────────────────
// Current pattern: Hard Run (Day 2) → Strength (Day 3) → Hard Run (Day 4) → Rest (Day 5)
// Fixed pattern:   Hard Run (Day 2) → Rest (Day 3) → Hard Run (Day 4) → Strength (Day 5)

// Week 1: Day 3 → Rest, Day 5 → Strength Maintenance A
setRestDay(3);

setStrengthDay(5,
  'Strength Maintenance A',
  'Phase 1 strength work: keep your competition lifts sharp while trail fitness builds. The goal is neural maintenance, not volume fatigue — 2–3 heavy singles, accessory work, done. You should leave the gym feeling activated, not wrecked.',
  [
    {
      name: 'Back Squat',
      details: 'Work up to 2 singles at 85% of your 1RM. 3–4 warm-up sets building from 50% → 65% → 75% → 85%. Rest 3–4 minutes between singles. Focus on bar path and depth — competition standards apply. Record your RPE: should feel like an 8/10.',
    },
    {
      name: 'Bench Press',
      details: 'Work up to 2 sets of 3 at 85% of your 1RM. Same warm-up ladder. Touch-and-go or competition pause — match your competition rules. Rest 3 minutes between sets.',
    },
    {
      name: 'Bulgarian Split Squat',
      details: '3 sets × 10 reps per leg. Bodyweight or light dumbbell. Rear foot elevated on a bench. This doubles as trail stability work — control the descent (3 seconds down), drive through the front heel. The single-leg demand here directly supports descent running on technical trails.',
    },
  ]
);

// Week 2: Day 10 → Rest, Day 12 → Strength Maintenance B
setRestDay(10);

setStrengthDay(12,
  'Strength Maintenance B',
  'Second strength session of Phase 1. S2OH and pulling strength maintained at 85%. Farmer\'s Walk is both a strength and loaded carry stimulus — it also trains the grip and core bracing you need on technical trail descents.',
  [
    {
      name: 'S2OH (Push Press or Jerk)',
      details: 'Work up to 2 sets of 2 at 85% of your 1RM. Use your competition movement (Push Press or Clean & Jerk). Warm up deliberately — this movement requires shoulder and thoracic preparation. Rest 3–4 minutes between sets. RPE target: 8/10.',
    },
    {
      name: 'Max Chin-ups (Strict)',
      details: '3 sets of max unbroken reps. Dead hang start, chin over bar, full extension at the bottom. Rest exactly 3 minutes between sets. Record total reps per set — this is your pulling baseline for Phase 2 progression. Add weight if you can do 15+ unbroken.',
    },
    {
      name: 'Farmer\'s Walk',
      details: '3 × 20m at a challenging but controlled weight (roughly 50% of bodyweight per hand if you have the grip for it). Walk at a deliberate pace — tall posture, shoulders packed, no lateral lean. The loaded carry trains the trunk stability and grip endurance that directly transfers to long days in the mountains.',
    },
  ]
);

// Week 3: Day 17 → Rest, Day 19 → Strength Maintenance A (intensity increase)
setRestDay(17);

setStrengthDay(19,
  'Strength Maintenance A',
  'Week 3 strength — intensity increases to 90%. You are now 3 weeks into trail-focused training. Your legs are accumulating aerobic fatigue; the CNS load from near-maximal singles here is manageable but respect recovery. Quality > quantity.',
  [
    {
      name: 'Back Squat',
      details: 'Work up to 1 single at 90% of your 1RM. Thorough warm-up: 50% × 5, 65% × 3, 75% × 2, 82% × 1, 87% × 1, 90% × 1. Rest 4 minutes before the top single. This should feel heavy but technically clean — do not grind a miss the week before race taper.',
    },
    {
      name: 'Bench Press',
      details: 'Work up to 1 set of 3 at 90% of your 1RM. Same approach: build deliberately, one top set, step off confident. The 3-rep format at 90% is a strong stimulus without the CNS cost of a max single.',
    },
    {
      name: 'Glute Bridges',
      details: '3 sets × 10 reps. Weighted (barbell across hips or heavy dumbbell on pelvis). Squeeze hard for 2 seconds at the top. This is posterior chain maintenance specifically for trail running — the gluteus maximus powers uphill running, and it will be heavily recruited on your peak long run (Day 20) the next day.',
    },
  ]
);

// ─── 2. WEEK 4 TAPER STRENGTH (Day 24) — convert to exercises ────────────────
setStrengthDay(24,
  'Strength Maintenance (Light)',
  'Race week. Very light activation only — no loading, no fatigue. This session keeps the neuromuscular system primed for race day without adding any muscular stress. It should take 15–20 minutes at most.',
  [
    {
      name: 'Goblet Squat',
      details: '2 sets × 5 reps. Light kettlebell or dumbbell held at chest. Full depth, controlled. The goal is movement quality and joint lubrication, not stimulus.',
    },
    {
      name: 'Push-ups',
      details: '2 sets × 5 reps. Slow and deliberate. Arms shoulder-width, full chest contact with the floor, elbows at 45°. No fatigue target — this is pattern activation only.',
    },
    {
      name: 'Band Pull-Aparts',
      details: '2 sets × 15 reps. Light band. Pull the band across your chest to shoulder height with straight arms. Activates the rear deltoids and upper back without any loading stress. Important for shoulder health heading into the trail race.',
    },
  ]
);

// ─── 3. PHASE BRIDGE — Day 31 (replaces abrupt Strength Re-Introduction) ─────
// Day 29 is post-race recovery, Day 30 rest, Day 31 was immediately "Strength Re-Introduction"
// Replace Day 31 with a deliberate Phase Bridge session
const day31 = getDay(31);
day31.title = 'Phase Bridge: Transition & Reflection';
day31.runs = [{
  type: 'recovery',
  distance: 2,
  paceZone: 'recovery',
  description: 'Easy 20–30 minute walk or very light jog — no pace target, no performance pressure. You have just completed a trail half marathon. Your body is in the early stages of recovery, and your training phase is about to shift completely.\n\nUse this session for reflection and planning:\n\n▸ Trail race review: what went well? Where did you lose time — climbs, descents, fueling, pacing? Write this down.\n\n▸ Strength phase goal-setting: confirm your opening attempts for competition day. Back Squat, Bench Press, S2OH — write your opener, second attempt, and target third attempt now, while your trail fitness is at its peak and you can assess your overall physical condition clearly.\n\n▸ Recovery status check: rate your legs (1–10), energy (1–10), and motivation (1–10). If any score is below 5, push the Phase 2 strength re-introduction back by 2 days and extend this recovery window.\n\nPhase 2 begins tomorrow. You are now a strength athlete with an aerobic engine.',
  effortLevel: 1,
  noIntervals: 0,
}];
day31.exercises = [];

// ─── 4. PHASE 2 STRENGTH DAYS — convert all from run[recovery] to exercises[] ─

// Day 32: Strength Re-Introduction (was "Easy Aerobic & Skills")
// Make it a proper hybrid: easy run + first real lifting session
const day32 = getDay(32);
day32.title = 'Strength Re-Introduction';
day32.runs = [{
  type: 'easy',
  distance: 5,
  paceZone: 'easy',
  description: 'Easy 5km run at a fully conversational pace. This maintains your aerobic base during the strength-focused Phase 2 — you are not abandoning running, you are just reducing it. Run easy enough that you could lift weights immediately after.',
  effortLevel: 3,
  noIntervals: 1,
}];
day32.exercises = [
  { name: '📋 Session Notes', details: 'First barbell work after the trail race. Weights are deliberately light (60% of 1RM). The goal today is to feel the bar, re-establish technique, and assess how your body has recovered. If anything feels off — joint pain, significant weakness — stay at 60% and do not chase heavier weights.' },
  {
    name: 'Back Squat',
    details: '3 sets × 8 reps at 60% of your 1RM. Focus entirely on movement quality: full depth, knees tracking toes, controlled descent (2 seconds down). This is a technique session as much as a strength session.',
  },
  {
    name: 'Bench Press',
    details: '3 sets × 8 reps at 60% of your 1RM. Controlled and deliberate. Re-establish your touch point, elbow position, and leg drive. Record how the weight feels — this gives you your re-introduction baseline.',
  },
  {
    name: 'Barbell Row',
    details: '3 sets × 8 reps at a moderate weight. Hinge at the hips, flat back, pull the bar to your lower sternum. Trains the pulling muscles that complement your pressing and overhead work.',
  },
];

// Day 33: Strength Volume A
setStrengthDay(33,
  'Strength Volume A',
  'Phase 2 begins in earnest. 5×5 at 75% is the classic strength-building protocol — enough volume to drive adaptation, not so much that you cannot recover in 48 hours. Track your reps per set and any RPE notes.',
  [
    {
      name: 'Back Squat',
      details: '5 sets × 5 reps at 75% of your 1RM. Rest 3 minutes between sets. All 5 reps should feel like a 7–8/10 effort — if any set starts feeling like a 9, end at that set. Consistent 5×5 quality beats grinding a sixth set.',
    },
    {
      name: 'Bench Press',
      details: '5 sets × 5 reps at 75% of your 1RM. Rest 2–3 minutes between sets. Control the descent to chest, pause or touch depending on your competition rules, press explosively.',
    },
    {
      name: 'Weighted Chin-ups',
      details: '3 sets × 5–8 reps at a challenging added weight. If 5 reps feels like a 9/10, reduce the weight. These build the upper back thickness that supports heavy pressing and overhead work.',
    },
  ]
);

// Day 34: Strength Volume B
setStrengthDay(34,
  'Strength Volume B',
  'Overhead and carry day. S2OH is your most technical competition lift — each set at RPE 7 should feel powerful and controlled, not laboured. Farmer\'s Walk weight builds across sets; note your top set weight.',
  [
    {
      name: 'S2OH (Push Press)',
      details: '5 sets × 5 reps at RPE 7 (roughly 72–75% of 1RM). Start from a rack. Dip-drive-press: generate power from the legs, lock out overhead with active shoulders. Rest 3 minutes between sets. If you are training Jerk for competition, alternate Push Press sets with technique Jerk singles.',
    },
    {
      name: "Farmer's Walk",
      details: '4 × 20m, building weight each set. Set 1: moderate. Sets 2–4: progressively heavier. The carry challenges your grip, trunk bracing, and shoulder packing under axial load. These qualities are directly tested in competition.',
    },
    {
      name: 'Dumbbell Row',
      details: '3 sets × 10 reps per arm. Brace on a bench, pull the dumbbell to your hip. Full range — elbow past torso at the top. Balances the pressing volume in this phase.',
    },
  ]
);

// Day 37: Strength Volume A (Week 6 — load increase)
setStrengthDay(37,
  'Strength Volume A',
  'Load increases to 80%. 5×5 at 80% is a meaningful jump — ensure you slept well and nutrition is on point before this session. If you arrive fatigued, drop to 77% and protect the movement quality.',
  [
    {
      name: 'Back Squat',
      details: '5 sets × 5 reps at 80% of your 1RM. Rest 3–4 minutes between sets. By now your technique should be automatic — focus on maintaining tension throughout the lift: full breath before descent, brace through the hole, drive through the heels.',
    },
    {
      name: 'Bench Press',
      details: '5 sets × 5 reps at 80% of your 1RM. Rest 3 minutes. At 80% the fifth rep of the fifth set will be genuinely hard. That\'s the target stimulus.',
    },
    {
      name: 'Weighted Chin-ups',
      details: '4 sets × 5–8 reps, heavier than last week. Track total volume (sets × reps × weight added). Progressive overload here should be visible across weeks 5–7.',
    },
  ]
);

// Day 39: Strength Volume B (Week 6 — RPE increase)
setStrengthDay(39,
  'Strength Volume B',
  'S2OH at RPE 8 this week — pushing closer to maximal capability. Farmer\'s Walk moves to 5 sets. Bulgarian Split Squats return as accessory; at this point in the program they are a direct injury prevention tool for your running maintenance days.',
  [
    {
      name: 'S2OH (Push Press)',
      details: '5 sets × 5 reps at RPE 8 (roughly 78–82% of 1RM). This should feel hard on reps 4 and 5. If the bar slows significantly on rep 5, that is the correct weight. Rest 3–4 minutes between sets.',
    },
    {
      name: "Farmer's Walk",
      details: '5 × 20m, heaviest weights of the program so far. Sets 4 and 5 should be a genuine grip and mental challenge. Set down between sets if needed — technique and posture are more important than unbroken carries.',
    },
    {
      name: 'Bulgarian Split Squat',
      details: '3 sets × 8 reps per leg with dumbbells. Maintains single-leg strength and hip stability during the reduced running phase. Controls the muscular imbalances that build up during heavy bilateral training.',
    },
  ]
);

// Day 41: Strength Volume A (Week 7 — shift to 5×3 for peaking)
setStrengthDay(41,
  'Strength Volume A',
  'Transition from volume (5×5) to peaking (5×3 at 85%). Fewer reps, heavier weight, longer rest. This is the beginning of the competition peaking protocol — CNS intensity rises, volume decreases. Each set of 3 should feel explosive and technically perfect.',
  [
    {
      name: 'Back Squat',
      details: '5 sets × 3 reps at 85% of your 1RM. Rest 4 minutes between sets. At 85% the bar is heavy but should move with authority. If your third rep is a grind on every set, you are either slightly over-estimated on 1RM or still carrying trail race fatigue — drop to 82% and note it.',
    },
    {
      name: 'Bench Press',
      details: '5 sets × 3 reps at 85% of your 1RM. Rest 3–4 minutes. The reduced rep count lets you focus on each rep individually — competition-quality touch, full lock-out, legal pause if required.',
    },
    {
      name: 'Weighted Chin-ups',
      details: '5 sets × 3–5 reps (heavy). Work up to the heaviest added weight you can complete with strict technique. These should feel like genuine effort — chin clearly over the bar, full extension at the bottom.',
    },
  ]
);

// Day 44: Strength Peaking A
setStrengthDay(44,
  'Strength Peaking A',
  'Peak week begins. Working to heavy singles at 90–95% tells your nervous system what maximum effort feels like. This is not a max-out attempt — your competition is the max attempt. The goal today is to feel heavy weight, confirm your openers, and walk out confident.',
  [
    {
      name: 'Back Squat',
      details: 'Work up to a heavy single at 90–95% of your 1RM. Warm-up: 50% × 5, 65% × 3, 75% × 2, 82% × 1, 88% × 1, 92% × 1. Stop at 92–95% — do not attempt a new PR today. Record how it felt (RPE, bar speed). This data sets your competition opener (90% of today\'s successful single is a safe opener).',
    },
    {
      name: 'Bench Press',
      details: 'Work up to a heavy 3RM at 90–95% of your 1RM. Three reps at this intensity is a significant competition stimulus. Use competition rules (pause if required). Record your 3RM — your opener should be around this weight for a comfortable first lift.',
    },
  ]
);

// Day 46: Strength Peaking B
setStrengthDay(46,
  'Strength Peaking B',
  'S2OH peak session. Carry and chin-up maxes give you competition-day confidence data. Approach each lift with a clear opener and target in mind.',
  [
    {
      name: 'S2OH',
      details: 'Work up to a heavy 2RM at 90–95% of your 1RM. Warm-up fully before your top sets. Use your competition technique exclusively — this is the last heavy S2OH before competition. Record the weight and RPE.',
    },
    {
      name: 'Max Unbroken Chin-ups (Strict)',
      details: 'One all-out set of max unbroken strict chin-ups. Dead hang start, chin over bar on every rep. Record total — this is your competition baseline and a useful fitness marker across the program.',
    },
    {
      name: "Max Farmer's Walk",
      details: 'Work up to a max weight for a single 20m carry. Build in 3–4 attempts. Your max today should be clearly heavier than week 5. This tests peak grip and carry strength.',
    },
  ]
);

// Day 48: Strength Peaking A (final peak session)
setStrengthDay(48,
  'Strength Peaking A',
  'Final heavy lifting session before competition. This is where you confirm your opening attempts. Target 95–102% of your training 1RM — close to your true max, but not a new PR attempt. Walk out of here knowing exactly what you are opening with.',
  [
    {
      name: 'Back Squat',
      details: 'Work up to a single at 95–102% of your 1RM. This is as close to a competition attempt as you will get before the real thing. Warm-up identically to how you will warm up on competition day. Record: time from first warm-up bar to top single, how the weight moved, how you felt. Replicate this exactly at the competition.',
    },
    {
      name: 'Bench Press',
      details: 'Work up to a 3RM at 95–102% of your 1RM. The 3-rep competition attempt today confirms your capability. If it moves well, your third competition attempt is within reach. If it is a struggle, adjust your third attempt target accordingly.',
    },
  ]
);

// Day 51: Taper Strength (CNS primer)
setStrengthDay(51,
  'Taper Strength',
  'CNS primer only. Light, explosive, brief. No muscular fatigue — the training is done. The goal is to feel fast, sharp, and powerful heading into competition week. This should take 20 minutes maximum.',
  [
    {
      name: 'Box Jumps',
      details: '3 sets × 5 reps. Use a comfortable height (60–80% of your max). Land softly, step down (do not jump down). The goal is to feel explosive, not to test your max jump. Rest fully between sets.',
    },
    {
      name: 'Explosive Push-ups / Clapping Push-ups',
      details: '3 sets × 5 reps. Maximum intent on each rep — chest to floor, push explosively. The power expression here primes the upper body without any strength-training fatigue.',
    },
  ]
);

// Day 53: Opener Session
setStrengthDay(53,
  'Opener Session',
  'Final session before competition. Extremely light — 50–60% of your 1RM for one single per lift. The purpose is not training; it is system priming and confidence. You should leave feeling fast, loose, and ready. Do not be tempted to go heavier.',
  [
    {
      name: 'Back Squat — Opener Feel',
      details: 'One single at 50–60% of your 1RM. Should feel almost laughably light. Focus on the exact warm-up sequence you will use tomorrow. Confirm your opening attempt in your head as the bar moves.',
    },
    {
      name: 'Bench Press — Opener Feel',
      details: 'One single at 50–60% of your 1RM. Competition pause if required by your fed. The bar should accelerate off the chest — that explosive feeling is what you want to carry into tomorrow.',
    },
    {
      name: 'S2OH — Opener Feel',
      details: 'One single at 50–60% of your 1RM. Feel the dip-drive, feel the lockout. Visualise your first competition attempt succeeding cleanly. Pack up, eat well, rest.',
    },
  ]
);

// Day 56: Competition Day
const day56 = getDay(56);
day56.title = 'COMPETITION DAY';
day56.runs = [];
day56.exercises = [
  {
    name: '📋 Competition Protocol',
    details: 'Arrive 90 minutes before your first attempt. Execute your standard warm-up — not longer, not different. The routine you practised in the Opener Session yesterday is your template today.\n\nOpeners: choose weights you can make on the worst day of your life. A successful first attempt unlocks the rest of the competition. A miss on the opener breaks momentum, costs mental energy, and can derail the entire session.\n\nBetween attempts: stay warm, eat fast-digesting carbs, hydrate. Do not sit in the cold. Do not overthink the next lift.\n\nThis is the culmination of 8 weeks of dual-phase training. You ran a trail half marathon and built toward a strength peak in the same 8-week window. That is an elite athletic achievement regardless of your numbers today.',
  },
  {
    name: 'Back Squat',
    details: 'Opener: ~90% of your Day 48 top single. Second attempt: ~97–100% of Day 48. Third attempt: target PR or competition goal weight. Trust your training — you have been to 102% in practice.',
  },
  {
    name: 'Bench Press',
    details: 'Opener: your comfortable 3RM weight from Day 48. Second attempt: add 2.5–5kg. Third attempt: your target PR.',
  },
  {
    name: 'S2OH',
    details: 'Opener: your 2RM weight from Day 46. Second and third attempts: build based on how the opener moves. Execute your competition technique — this is not the day to try a new variation.',
  },
];

// ─── 5. PROGRAM DESCRIPTION — prerequisites and framing ──────────────────────
const updatedDescription = 'An 8-week, two-phase plan for the elite multi-sport athlete. Phase 1 (weeks 1–4) peaks for a technical trail half marathon while maintaining strength competition lifts. Phase 2 (weeks 5–8) transitions to a full strength peaking block to peak for a lifting competition.\n\nPrerequisites — this program is designed for athletes who have ALL of the following:\n• An established strength base: you have trained Back Squat, Bench Press, and S2OH consistently for at least 12 months and know your 1RMs\n• Trail running experience: you can comfortably run 10–14km on hilly terrain and have trained with hill repeats before\n• Two specific upcoming events: a trail half marathon in approximately week 4, and a strength/lifting competition in approximately week 8\n• Training age: you are experienced enough to manage 5-day training weeks, interpret RPE, and adjust load when fatigued\n\nIf you do not have both a trail race and a lifting competition within this 8-week window, this plan is not appropriate. Choose the Trail Runner or a standalone strength program instead.';

// ─── WRITE BACK ───────────────────────────────────────────────────────────────
console.log('Updating Dual Peak: Trail & Strength...');
await docRef.update({
  description: updatedDescription,
  workouts,
});
console.log('✅ Done!\n');

// Verification
console.log('--- Key changes ---');
const updated = workouts;
console.log(`Day  3 title: ${updated.find(w=>w.day===3).title} | runs: ${updated.find(w=>w.day===3).runs.length} | exercises: ${updated.find(w=>w.day===3).exercises.length}`);
console.log(`Day  5 title: ${updated.find(w=>w.day===5).title} | exercises: ${updated.find(w=>w.day===5).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 10 title: ${updated.find(w=>w.day===10).title} | runs: ${updated.find(w=>w.day===10).runs.length}`);
console.log(`Day 12 title: ${updated.find(w=>w.day===12).title} | exercises: ${updated.find(w=>w.day===12).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 17 title: ${updated.find(w=>w.day===17).title} | runs: ${updated.find(w=>w.day===17).runs.length}`);
console.log(`Day 19 title: ${updated.find(w=>w.day===19).title} | exercises: ${updated.find(w=>w.day===19).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 31 title: ${updated.find(w=>w.day===31).title} | is Phase Bridge: ${updated.find(w=>w.day===31).title.includes('Bridge')}`);
console.log(`Day 32 title: ${updated.find(w=>w.day===32).title} | runs: ${updated.find(w=>w.day===32).runs.length} | exercises: ${updated.find(w=>w.day===32).exercises.length}`);
console.log(`Day 33 title: ${updated.find(w=>w.day===33).title} | runs: ${updated.find(w=>w.day===33).runs.length} | exercises: ${updated.find(w=>w.day===33).exercises.length}`);
console.log(`Day 44 runs: ${updated.find(w=>w.day===44).runs.length} | exercises: ${updated.find(w=>w.day===44).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 56 runs: ${updated.find(w=>w.day===56).runs.length} | exercises: ${updated.find(w=>w.day===56).exercises.map(e=>e.name).join(', ')}`);
console.log(`Description prerequisites: ${updatedDescription.includes('Prerequisites')}`);
// Check no absolute kg references remain
const allDescriptions = updated.flatMap(w => [
  ...w.runs.map(r => r.description || ''),
  ...w.exercises.map(e => e.details || ''),
]).join(' ');
const kgReferences = allDescriptions.match(/~\d+kg/g) || [];
console.log(`Absolute kg references remaining: ${kgReferences.length} ${kgReferences.length > 0 ? kgReferences.join(', ') : '✅'}`);
