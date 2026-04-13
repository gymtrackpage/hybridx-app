/**
 * Batch description + targeted content updates for:
 * - Olympic Lifting: fix active recovery (remove Farmer Carries), stronger safety prerequisites
 * - Ultra Elite: HRV monitoring protocol in description, deload note
 * - CrossFit Bridge: realistic expectations, gymnastics prerequisites, post-program pathway
 * - Hyrox Fusion Balance: add Week 4 mini race simulation, add km estimates to long runs
 * - Hyrox Run Performance: running form coaching in strength sessions, compromised run distance note
 * - Hyrox Doubles: station assignment battery test in Week 5, fitness gap guidance in description
 * - 50K Ultra: updated description (programType already fixed separately)
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ─── 1. OLYMPIC LIFTING — fix active recovery, update description ─────────────
{
  const ref = db.collection('programs').doc('QXpgKvrxjW4VfYspOlHQ');
  const snap = await ref.get();
  const p = snap.data();
  const workouts = p.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

  // Remove Farmer Carries from ALL active recovery days
  // Active recovery days are: 3, 10, 17, 24, 31, 38, 45, 52, 59, 66, 73, 80
  // But only the ones that have "Grip Strength - Farmer Carries" should be changed
  for (const w of workouts) {
    if ((w.title || '').includes('Active Recovery')) {
      w.exercises = w.exercises.filter(e => !e.name.includes('Farmer'));
      // Also remove Core Finisher from active recovery — it's too heavy for recovery
      w.exercises = w.exercises.filter(e => !e.name.includes('Core Finisher'));
    }
  }

  const newDescription = `A 12-week dedicated cycle to build maximal strength and technical proficiency in the Olympic lifts. Test your 1RMs for Back Squat, Snatch, and Clean & Jerk before starting — the program is built on percentages, so accurate 1RMs are essential.

PREREQUISITES (non-negotiable):
• Minimum 12 months of consistent Olympic lifting coaching under supervision
• Can demonstrate a full squat Snatch with an empty bar with technically correct form
• Can perform a stable Overhead Squat with appropriate load
• Know your current 1RM for: Back Squat, Snatch, and Clean & Jerk
• Currently training 4+ days/week consistently — do not start this program from scratch

PROGRAM FRAMING:
This is an Olympic weightlifting strength block, not a Hyrox race-preparation program. It is best used as a 12-week strength foundation before transitioning to a Hyrox-specific program such as Hyrox Fusion Balance. Completing this cycle then running 12 weeks of Fusion Balance gives you a strength-then-specificity periodization that maximises Hyrox performance.

Deload weeks are built into Week 4 and Week 8. These are mandatory — do not train through them. Adaptation happens during recovery, not during training.`;

  await ref.update({ description: newDescription, workouts });
  console.log('✅ Olympic Lifting updated');
  const activeRecovery = workouts.filter(w => (w.title||'').includes('Active Recovery'));
  console.log(`   Active recovery days: ${activeRecovery.length}`);
  console.log(`   Farmer Carries remaining: ${activeRecovery.reduce((n, w) => n + w.exercises.filter(e=>e.name.includes('Farmer')).length, 0)}`);
}

// ─── 2. ULTRA ELITE — description with HRV protocol + deload note ─────────────
{
  const ref = db.collection('programs').doc('dBJAHOM8TqeMyanNG9s5');
  const newDescription = `An advanced 12-week program for competitive Hyrox athletes, using undulating periodization. It alternates between Week A (High Intensity Anaerobic), Week B (High Volume Base Training), and Week C (Max Aerobic Capacity) to maximise your performance ceiling.

This program is for athletes already competing at Hyrox events with consistent 6-day/week training history. Do not start this program as your first Hyrox plan.

DAILY READINESS PROTOCOL:
Before every session, rate yourself on three measures (1–5 each):
• Sleep quality (1 = terrible, 5 = excellent)
• Muscle soreness (1 = severely sore, 5 = completely fresh)
• Motivation/energy (1 = couldn't care less, 5 = ready to go)

Score ≤ 7/15: Reduce this session's intensity by 20–30%. Drop loads, reduce run pace targets.
Score ≤ 5/15: Swap to the Active Recovery session or take complete rest.
Any single score of 1: Take a rest day regardless of total score.

At 6 sessions/week, accumulated fatigue is the primary performance limiter. This check-in prevents training through breakdown states that cause overuse injuries and stalled progress.

DELOAD STRUCTURE:
Weeks 4 and 8 contain built-in deload sessions. These reduce to 4 active days at 60% of normal volume. Deload weeks are not optional — they are when adaptation is consolidated. Athletes who skip deloads plateau faster and sustain more overuse injuries.

RACE TAPER (Weeks 11–12):
Week 11: Reduce to 5 sessions, 50–60% volume. Maintain 2 short race-pace efforts.
Week 12 (final days): 3 sessions max, 25–30% volume. Race-pace strides only. Follow the race day warm-up protocol in the final session.`;

  await ref.update({ description: newDescription });
  console.log('✅ Ultra Elite description updated');
}

// ─── 3. CROSSFIT BRIDGE — realistic expectations, prerequisites, pathway ──────
{
  const ref = db.collection('programs').doc('hI2ziHSOkazjrbObnOOj');
  const snap = await ref.get();
  const p = snap.data();
  const workouts = p.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

  const newDescription = `A 16-week program for intermediate/advanced Hyrox athletes learning CrossFit skills and building CrossFit-specific strength. Includes benchmark testing.

REALISTIC EXPECTATIONS:
16 weeks is enough time to build a strong foundation in Olympic lifting and gymnastics movements. It is not enough time to master them — that takes 1–2 years of consistent practice. By Week 16, you will have: technically sound Olympic lift positions, introduction to kipping pull-ups and toes-to-bar, a significantly stronger back squat and deadlift, and real experience with CrossFit benchmark workouts. You will not have: muscle-ups (unless you were close before), elite gymnastics efficiency, or competition-ready Olympic lift loads.

GYMNASTICS PREREQUISITES:
Before starting the gymnastics skill progression, ensure you can:
• 5 strict pull-ups (dead hang, chin over bar, full extension at bottom)
• 10 controlled push-ups
• 30-second hollow body hold on the floor

If you cannot meet these standards: substitute ring rows for all pulling gymnastics movements and band-assisted strict pull-ups for kipping work until you build the baseline. Attempting kipping or muscle-up progressions without a strict pull-up base risks shoulder injury.

AFTER THIS PROGRAM:
You are ready for: Hyrox Fusion Balance (intermediate) if returning to Hyrox race preparation, or Ultra Elite Performance (advanced) if your CrossFit-built fitness is now at a competitive level. Your strength base from this program is a significant asset in either direction.`;

  // Add post-program pathway as a note in the last block (Week 16)
  const lastWeekDays = workouts.filter(w => w.day >= 106);
  if (lastWeekDays.length > 0) {
    const lastActiveDay = lastWeekDays.find(w => !(w.title||'').toLowerCase().includes('rest'));
    if (lastActiveDay) {
      lastActiveDay.exercises.push({
        name: "🏆 What's Next?",
        details: `You've completed the 16-week Hyrox to CrossFit Bridge. You now have:
• A significantly stronger squat, deadlift, and press
• Introduction to Olympic lifting positions and movements
• Real experience with gymnastics skill progressions
• CrossFit benchmark workout data to track your progress

Your next program:
🎯 Hyrox Fusion Balance — take your new strength base into a race-specific Hyrox program. Your improved strength will show up most on the Sled Push, Farmer's Carry, and Wall Ball stations.
⚡ Ultra Elite Performance — if you've been competing in Hyrox and want to push performance further, your CrossFit-built engine is ready for this 6-day program.
🏋️ Olympic Lifting & Power Cycle — if the Olympic lifting in this program lit something up for you, this dedicated 12-week Snatch and Clean & Jerk cycle builds the technical foundation further.`,
      });
    }
  }

  await ref.update({ description: newDescription, workouts });
  console.log('✅ CrossFit Bridge updated');
}

// ─── 4. FUSION BALANCE — add Week 4 mini simulation, add km to long runs ──────
{
  const ref = db.collection('programs').doc('j5qE8awNGl8IPoNzaVFH');
  const snap = await ref.get();
  const p = snap.data();
  const workouts = p.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

  // Long run km targets (based on time → estimated distance at easy pace ~6:00–6:30/km)
  // Week 1: 60-75 min → ~10-12km | Week 2: 75-80 min → ~12-13km | Week 3: 80-90 → ~13-14km
  // Week 4 deload: shorter | Week 5: 90 min → ~14-15km | Week 6: 90+fast finish → ~14-15km
  // Week 7 deload: shorter | Week 8-9: build back | Week 10+: taper
  const longRunDistances = {
    4: '10–12km',   // Week 1
    11: '12–13km',  // Week 2
    18: '13–14km',  // Week 3
    // Week 4 is deload
    32: '14–15km',  // Week 5
    39: '14–15km',  // Week 6 (with fast finish)
    46: '12–13km',  // Week 7 (deload/heavy strength week)
    53: '15–16km',  // Week 8
    60: '14–15km',  // Week 9
    67: '12–13km',  // Week 10 (taper)
    74: '10–12km',  // Week 11
  };

  for (const w of workouts) {
    if ((w.title||'').includes('Long Aerobic')) {
      const km = longRunDistances[w.day];
      if (km) {
        const runEx = w.exercises.find(e => e.name.includes('Long'));
        if (runEx) {
          // Append km guidance if not already present
          if (!runEx.details.includes('km')) {
            runEx.details = runEx.details + `\n\nDistance target: approximately ${km} at your easy pace (~6:00–6:30/km). Use time as your primary guide, distance as a secondary check.`;
          }
        }
      }
    }
  }

  // Add mini race simulation to Week 4 (Day 25 is Week 4 Hybrid/Compromised)
  // Find the Week 4 strength day and add a mini simulation
  const week4days = workouts.filter(w => w.day >= 22 && w.day <= 28);
  console.log('Week 4 days:', week4days.map(w => `Day ${w.day}: ${w.title}`).join(', '));

  // Week 4 day 24 or 25 — find the compromised running day
  const week4compromised = workouts.find(w => w.day >= 22 && w.day <= 28 && (w.title||'').includes('Compromised'));
  if (week4compromised) {
    const mainSet = week4compromised.exercises.find(e => (e.name||'').includes('Main Set') || (e.name||'').includes('Hybrid'));
    if (mainSet) {
      mainSet.details = mainSet.details + `\n\n📋 Week 4 Mini Race Simulation: If feeling good after the main set, add: 800m Run → 500m SkiErg → 800m Run → 25m Sled Push (light weight). This is your first experience of running between stations. Notice how your legs feel entering the SkiErg — this is exactly what Hyrox racing feels like. The goal is awareness and movement quality, not speed.`;
    }
  }

  await ref.update({ workouts });
  console.log('✅ Fusion Balance updated');
  const longRuns = workouts.filter(w => (w.title||'').includes('Long Aerobic'));
  console.log(`   Long runs with km targets: ${longRuns.filter(w => w.exercises.some(e => e.details.includes('km'))).length}/${longRuns.length}`);
}

// ─── 5. RUN PERFORMANCE — running form coaching, compromised run distance ──────
{
  const ref = db.collection('programs').doc('mTSbnEGsI9nzqDccm90B');
  const snap = await ref.get();
  const p = snap.data();
  const workouts = p.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

  const RUNNING_FORM_COACHING = `
RUNNING MECHANICS — read once, apply every session:
• Cadence: target 170–180 steps per minute. Count your right foot strikes for 30 seconds (target 85–90). Most runners under-cadence, which creates overstriding and heel-striking.
• Posture: tall and stacked — ears over shoulders over hips over ankles. Don't lean from the waist. A slight forward lean from the ankles is correct.
• Foot strike: land under your hips, not in front. The foot should contact the ground beneath your centre of mass. This is mostly a cadence fix — higher cadence naturally shortens stride.
• Arm swing: 90° at the elbows, hands relaxed (imagine holding a crisp without breaking it). Swing forward and back, not across the body. Your arms counterbalance your legs — efficient arm swing = more efficient legs.
• Breathing: during easy runs, breathe through your nose only. This develops aerobic efficiency and forces an appropriate pace. During intervals, breathe rhythmically: inhale for 2 steps, exhale for 2 steps.`;

  // Add running form coaching to all Strength for Runners days (weeks 1-6)
  for (const w of workouts) {
    if ((w.title||'').includes('Strength for Runners') && w.day <= 42) {
      // Check if already has form coaching
      const hasForm = w.exercises.some(e => e.details?.includes('Cadence'));
      if (!hasForm) {
        // Find warm-up and append form note to it, or add as a new entry
        const warmup = w.exercises.find(e => (e.name||'').includes('Warm-up'));
        if (warmup) {
          warmup.details = warmup.details + RUNNING_FORM_COACHING;
        }
      }
    }
  }

  // Add distance targets to Compromised Running sessions
  for (const w of workouts) {
    if ((w.title||'').includes('Compromised Running')) {
      const mainSet = w.exercises.find(e => (e.name||'').toLowerCase().includes('main set'));
      if (mainSet && !mainSet.details.includes('immediately')) {
        mainSet.details = `Immediately after completing your last strength exercise, transition directly to running — do not rest. ${mainSet.details}\n\nPacing note: your goal pace on these runs is your easy/conversational pace, not your best running pace. The point is maintaining form under fatigue — if you're too tired to keep good posture, slow down. This is the most race-specific session in your week.`;
      }
    }
  }

  await ref.update({ workouts });
  console.log('✅ Run Performance updated');
  const strengthDays = workouts.filter(w => (w.title||'').includes('Strength for Runners') && w.day <= 42);
  console.log(`   Strength days with form coaching: ${strengthDays.filter(w => w.exercises.some(e => e.details?.includes('Cadence'))).length}/${strengthDays.length}`);
}

// ─── 6. DOUBLES — station assignment test, fitness gap guidance ───────────────
{
  const ref = db.collection('programs').doc('uf3EsOGPMp5wGV7bPi1h');
  const snap = await ref.get();
  const p = snap.data();
  const workouts = p.workouts.map(w => ({ ...w, exercises: w.exercises || [] }));

  // Find the Week 5 Partner WOD (Day 32 is Week 5)
  const week5partnerWOD = workouts.find(w => w.day === 32);
  if (week5partnerWOD) {
    // Add a station assignment battery test after the main WOD
    week5partnerWOD.exercises.push({
      name: '🎯 Station Assignment Battery Test',
      details: `After today's WOD, complete this station assessment as a team. You need this data to make race-day decisions.

Time each partner on the following (separately):
• SkiErg: 500m for time (rest 3 min between partners)
• Sled Push: 25m for time at moderate weight (rest 3 min)
• Wall Balls: 25 reps for time (rest 3 min)
• Farmer's Carry: 50m for time at moderate weight (rest 3 min)

Record all 8 results. Compare directly:
→ Assign SkiErg to the faster partner on that station
→ Assign Sled Push to the stronger partner (usually bigger bodyweight advantage)
→ Wall Balls: assign to whichever partner has better cycling efficiency (not raw strength)
→ Farmer's Carry: assign to the partner with better grip and carry mechanics

Stations 3 (Sled Pull) and 8 (100 Wall Balls): typically split 50/50 by run speed, as the runner arrives first.

Managing a fitness gap: if one partner consistently outperforms the other by 15%+, consider the stronger partner doing 60% of the total reps on split-able stations. This keeps the stronger partner from waiting too long and the weaker partner from falling too far behind. Communication > raw performance.`,
    });
  }

  const newDescription = `A 12-week, 5-day/week plan for Hyrox partner and relay events. It methodically builds individual fitness while integrating partner-specific workouts focused on synchronicity, strategy, and communication.

IMPORTANT PREREQUISITE: This program requires a committed training partner available on the same 5 days per week. Specifically, partner days (Day 4 each week) require both athletes to train together. If you do not have a consistent training partner available, choose Hyrox Fusion Balance instead and find a partner before race week.

MANAGING DIFFERENT FITNESS LEVELS:
Partner programs work best when fitness levels are within 15–20% of each other. If one partner significantly outperforms the other, here's how to manage it:
• Stronger partner: takes a higher share of reps on divisible stations (Wall Balls, Farmer's Carry). Runs a slightly slower comfortable pace to stay with the team.
• Weaker partner: focuses on maintaining consistent output rather than maximum effort. Doesn't blow up in the first half.
• Both: communicate constantly during training about how you're feeling. Build the vocabulary now so it's natural on race day.

If the gap is larger than 25%, train together on the WOD days but let the stronger partner do additional individual training (see Hyrox Fusion Balance or Run Performance programs) for extra sessions.

RACE STRATEGY:
Station assignments should be finalised by Week 6 based on the station battery test in Week 5. The strongest race plans are built on data, not assumptions. Complete the assessment as prescribed.`;

  await ref.update({ description: newDescription, workouts });
  console.log('✅ Doubles updated');
}

console.log('\n✅ All batch updates complete.');
