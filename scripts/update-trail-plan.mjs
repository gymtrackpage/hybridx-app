/**
 * Updates the "Trail Runner" program:
 * 1. Rewrite all "Strength for Trail Stability" days with explicit exercises
 *    (single-leg stability, lateral hip, ankle, eccentric calf work)
 * 2. Expand "Long Trail Run: Technical Practice" (Day 20) with teachable descent cues
 * 3. Add prerequisite / base-fitness note to program description
 * 4. Add elevation gain tracking guidance to all long run days
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PROGRAM_ID = 'ncYgpWVba8fxHre91CeD';

// ─── Trail-specific strength exercises by training phase ─────────────────────

const STRENGTH_W1_W2 = [
  {
    name: 'Single-Leg Glute Bridge',
    details: '3 sets × 12 reps per leg. Lie on back, one foot flat on the floor, opposite leg raised. Drive hips up through the planted heel to full extension, squeezing the glute hard at the top. Lower slowly over 3 seconds. This single-leg version trains the glute medius — the muscle that stabilises your pelvis on every uneven trail step. Neglect it and you will roll your ankle or develop IT band pain within a few weeks of trail running.',
  },
  {
    name: 'Clamshells with Band',
    details: '3 sets × 20 reps per side. Lie on your side with a light resistance band above the knees. Feet together, hips stacked. Open the top knee toward the ceiling as far as possible without rolling your pelvis backward. Close slowly. The lateral hip rotators (gluteus medius and minimus) control your pelvis on single-leg loading — every root, rock, and cambered trail tests them. Weakness here causes IT band syndrome and lateral knee pain.',
  },
  {
    name: 'Walking Lunges',
    details: '3 sets × 12 reps per leg. Step forward into a deep lunge, lower the back knee to just above the floor, then drive through the front heel to stand and step into the next lunge. Keep torso upright. Builds the single-leg quad and glute strength needed to push up climbs and absorb descents. Add light dumbbells in each hand once the movement feels stable.',
  },
  {
    name: 'Single-Leg Calf Raise (Eccentric)',
    details: '3 sets × 15 reps per leg. Stand on the edge of a step. Rise on both feet, then lower on ONE leg over 4 slow seconds until your heel is below the step. Use both feet to rise again. The slow eccentric lowering builds Achilles tendon and calf resilience specifically for descent impact loading. Trail runners who skip this develop Achilles tendinopathy during peak mileage weeks.',
  },
  {
    name: 'Single-Leg Balance with Perturbation',
    details: '3 sets × 30 seconds per leg. Stand on one leg on a slightly unstable surface (folded yoga mat or grass). Eyes open first, then progress to eyes closed. Gently swing your free leg in various directions to challenge ankle stability. Proprioception training like this is the primary defence against trail ankle sprains — it trains the neuromuscular reflex that fires before you consciously react to a foot roll.',
  },
];

const STRENGTH_W3_W4 = [
  {
    name: 'Bulgarian Split Squat',
    details: '3 sets × 10 reps per leg. Rear foot elevated on a bench behind you, front foot forward. Lower straight down until front thigh is parallel to the floor, keeping torso upright. Drive back up through the front heel. This is the most race-specific strength exercise in this program — the elevated rear leg mimics the hip extension demand of steep climbing. Add dumbbells once bodyweight feels controlled.',
  },
  {
    name: 'Side-Lying Hip Abduction',
    details: '3 sets × 15 reps per side. Lie on your side, bottom leg bent for stability, top leg straight. Raise the top leg to ~45° with toes pointing forward, not upward. Lower slowly over 3 seconds. Targets the gluteus medius — essential for lateral stability on cambered trails and side-slopes. Add a resistance band above the ankles for progressive overload this week.',
  },
  {
    name: 'Box Step-Up with Knee Drive',
    details: '3 sets × 12 reps per leg. Step onto a box or sturdy step (40–50cm). At the top, drive the trail leg up and bring the opposite knee to hip height. Lower under control — do not drop or bounce. This directly replicates the explosive hip extension needed when running steep climbs. Add a dumbbell in each hand for load.',
  },
  {
    name: 'Single-Leg Calf Raise (Eccentric)',
    details: '3 sets × 12 reps per leg. Same as weeks 1–2, but slow the lowering phase to 5 seconds. Increase step height if available. You may feel mild muscle soreness the next day — this is the tendon adaptation stimulus. If you feel sharp Achilles pain (not soreness), reduce range of motion.',
  },
  {
    name: 'Lateral Band Walk',
    details: '3 sets × 15 steps each direction. Band above the knees, slight squat position, step sideways keeping toes forward. The hip abductor and external rotator demand here translates directly to stability on side-sloped trail surfaces. Keep tension on the band throughout — do not allow the trailing foot to fully close to the lead foot.',
  },
];

const STRENGTH_W5_W6 = [
  {
    name: 'Bulgarian Split Squat (Weighted)',
    details: '3 sets × 8 reps per leg. Same position as weeks 3–4 with heavier dumbbells or a barbell held at chest. The load progression mirrors the increasing demands of your peak long runs. If one leg noticeably struggles more than the other, add an extra set on the weaker side.',
  },
  {
    name: 'Pistol Squat Progression',
    details: '3 sets × 6–8 reps per leg. Start assisted: hold a post or TRX strap, extend one leg forward, and lower on the other to a 90° squat. Build toward unassisted over these two weeks. This is the gold-standard single-leg strength test for trail runners — it requires quad strength, hip stability, and ankle mobility simultaneously. If you cannot yet do an unassisted pistol, the assisted version still delivers most of the benefit.',
  },
  {
    name: 'Kettlebell Swing',
    details: '3 sets × 15 reps. Hinge at the hips (not squat), drive hips explosively forward to swing the kettlebell to chest height, let it fall back between the legs and immediately re-hinge. Builds the explosive hip extension that powers steep climbs and the posterior chain resilience needed for descent absorption over 2+ hours.',
  },
  {
    name: 'Copenhagen Side Plank',
    details: '3 sets × 30 seconds per side. Side plank with the top foot on a bench or chair. Hold. Targets hip adductors — the inner-thigh muscles that prevent the pelvis dropping on every uneven foot strike. Weakness here manifests as groin strains and lateral knee pain on long descents.',
  },
  {
    name: 'Single-Leg Calf Raise (Loaded)',
    details: '3 sets × 10 reps per leg. Hold a dumbbell in the same-side hand. Maintain the 5-second lowering protocol. Loaded eccentric calf raises during peak mileage weeks maintain Achilles resilience when training stress is highest.',
  },
];

const STRENGTH_W7_TAPER = [
  {
    name: 'Bodyweight Squat (Activation)',
    details: '2 sets × 10 reps. Controlled bodyweight squat to activate the quads and glutes without load. Movement quality only — no fatigue.',
  },
  {
    name: 'Single-Leg Glute Bridge',
    details: '2 sets × 10 reps per leg. Maintains posterior chain activation without adding training stress. Focus on the glute squeeze and controlled lowering.',
  },
  {
    name: 'Clamshells',
    details: '2 sets × 15 reps per side. Light band or no band. Keeps the lateral hip firing without loading it. Maintains neuromuscular readiness of the hip abductors heading into race week.',
  },
  {
    name: 'Single-Leg Balance (Eyes Closed)',
    details: '2 sets × 20 seconds per leg. A proprioception check as much as a training stimulus. If balance feels significantly worse than it did 3 weeks ago, that is a signal of accumulated fatigue — prioritise sleep over any additional training this week.',
  },
];

const ELEVATION_GUIDANCE = 'Elevation goal: aim to accumulate at least 50% of your race\'s total elevation gain across your weekly long runs as training progresses. For example, if your target race has 800m of elevation gain, work toward 400–500m gain in your peak long runs (week 4–5). Track this on your GPS watch or app (Strava, Garmin Connect, and Coros all show cumulative elevation per activity). The more elevation you rehearse in training, the more confident you will feel on race climbs.';

const docRef = db.collection('programs').doc(PROGRAM_ID);
const snap = await docRef.get();
const program = snap.data();
const workouts = program.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

function getDay(day) {
  return workouts.find(w => w.day === day);
}

// ─── 1. STRENGTH SESSIONS — rewrite with explicit exercises ──────────────────

// Days 3, 10 — weeks 1–2 foundation
for (const dayNum of [3, 10]) {
  const w = getDay(dayNum);
  w.title = 'Strength for Trail Stability';
  w.runs = [{
    type: 'recovery',
    distance: 0,
    paceZone: 'recovery',
    description: 'No running today. Complete the trail stability circuit below (~35–40 min). Trail running demands single-leg strength, lateral hip control, ankle proprioception, and Achilles resilience — all on unpredictable terrain. Weeks 1–2 focus on movement quality over load: master the positions before adding weight.',
    effortLevel: 2,
    noIntervals: 0,
  }];
  w.exercises = STRENGTH_W1_W2;
}

// Days 17, 24 — weeks 3–4 loading
for (const dayNum of [17, 24]) {
  const w = getDay(dayNum);
  w.title = 'Strength for Trail Stability';
  w.runs = [{
    type: 'recovery',
    distance: 0,
    paceZone: 'recovery',
    description: 'No running today. Trail stability circuit (~40 min). Weeks 3–4 increase single-leg load and introduce Bulgarian Split Squats — the most race-specific exercise in this program. Add weight where indicated. You will feel these in your descents by the weekend long run.',
    effortLevel: 2,
    noIntervals: 0,
  }];
  w.exercises = STRENGTH_W3_W4;
}

// Days 31, 38 — weeks 5–6 peak strength
for (const dayNum of [31, 38]) {
  const w = getDay(dayNum);
  w.title = 'Strength for Trail Stability';
  w.runs = [{
    type: 'recovery',
    distance: 0,
    paceZone: 'recovery',
    description: `No running today. Peak trail stability circuit (~40–45 min). Weeks 5–6 are your highest strength stimulus — Pistol Squat progressions and loaded Kettlebell Swings alongside your peak long run volume. ${dayNum === 38 ? 'This is the final high-load strength session before taper begins next week.' : ''}`,
    effortLevel: 3,
    noIntervals: 0,
  }];
  w.exercises = STRENGTH_W5_W6;
}

// Day 45 — week 7 taper
const day45 = getDay(45);
day45.title = 'Strength for Trail Stability';
day45.runs = [{
  type: 'recovery',
  distance: 0,
  paceZone: 'recovery',
  description: 'Light activation only (~20 min). Taper week — maintain neuromuscular readiness without adding fatigue. If anything feels tight or sore, replace this session with a 15-minute mobility and foam rolling routine instead.',
  effortLevel: 1,
  noIntervals: 0,
}];
day45.exercises = STRENGTH_W7_TAPER;

// ─── 2. TECHNICAL PRACTICE — Day 20: full descent and terrain cues ───────────
const day20 = getDay(20);
day20.runs = [{
  type: 'long',
  distance: 14,
  paceZone: 'easy',
  description: `Long run on the most technical trail available to you. Time on feet ~100–110 min. This session is about developing trail skill, not fitness — the fitness comes from the other days. Focus on these teachable techniques:\n\n▸ Descent technique: lean slightly forward from the ankles (not the waist). Your centre of mass should feel like it is falling into the descent, not braking against it. Keep your arms wider than usual for lateral balance. Land with a slightly bent knee on the ball of the foot — your quads absorb the impact. Relax your hands, jaw, and shoulders. Tense runners stumble; relaxed runners flow.\n\n▸ Eye placement: look 2–3 metres ahead, not directly at your feet. Your peripheral vision handles immediate foot placement; your eyes should be reading terrain 3–4 steps ahead to pre-select your line through rocks and roots.\n\n▸ Root and rock navigation: step on top of roots where possible — better grip than the side. On wet rocks, land flat-footed rather than on the ball of the foot; more surface contact gives more friction. Shorten your stride on technical sections — many quick steps beats fewer long strides.\n\n▸ Power hiking uphills: if your heart rate rises above a comfortable level on steep climbs, switch to a power hike. Place your hands on your thighs and push down with each step — this recruits the glutes and reduces quad fatigue. Practice the transition: run when the grade eases, hike when it steepens.\n\n▸ ${ELEVATION_GUIDANCE}`,
  effortLevel: 4,
  noIntervals: 1,
}];

// ─── 3. ELEVATION GUIDANCE — all other long runs ─────────────────────────────
for (const dayNum of [6, 13, 27, 34, 41, 48]) {
  const w = getDay(dayNum);
  if (w && w.runs && w.runs.length > 0) {
    w.runs[0].description = w.runs[0].description + ' ' + ELEVATION_GUIDANCE;
  }
}

// ─── 4. DESCRIPTION — add prerequisite note ──────────────────────────────────
const updatedDescription = 'An 8-week plan for intermediate runners tackling a hilly trail race. This 5-day/week schedule focuses on building hill strength, technical skill, and endurance for a strong finish.\n\nPrerequisite: This plan works best if you already have a base of hill running and can comfortably run 8–10km. If you are coming from flat road running only, complete 2–4 weeks of general hill conditioning first — add 2–3 hilly runs per week and practice power hiking steep grades. Starting this plan without that base significantly increases injury risk in weeks 3–5 when hill repeat volume peaks.';

// ─── WRITE BACK ───────────────────────────────────────────────────────────────
console.log('Updating Trail Runner...');
await docRef.update({
  description: updatedDescription,
  workouts,
});
console.log('✅ Done!\n');

// Verification
console.log('--- Key changes ---');
console.log(`Day  3 exercises: ${workouts.find(w=>w.day===3).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 17 exercises: ${workouts.find(w=>w.day===17).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 31 exercises: ${workouts.find(w=>w.day===31).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 45 exercises: ${workouts.find(w=>w.day===45).exercises.map(e=>e.name).join(', ')}`);
console.log(`Day 20 descent cues: ${workouts.find(w=>w.day===20).runs[0].description.includes('Descent technique')}`);
console.log(`Day  6 elevation guidance: ${workouts.find(w=>w.day===6).runs[0].description.includes('elevation goal')}`);
console.log(`Day 27 elevation guidance: ${workouts.find(w=>w.day===27).runs[0].description.includes('elevation goal')}`);
console.log(`Description has prerequisite: ${updatedDescription.includes('Prerequisite')}`);
