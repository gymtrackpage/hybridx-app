# HybridX Training Programs — Professional Coaching Review

**Reviewed by:** AI Athletic Coach Analysis  
**Date:** April 2026  
**Total Programs Reviewed:** 14  
**Database Collection:** Firestore `programs`

---

## Overview

This document is a full professional coaching review of all 14 programs currently live in the HybridX database. Programs have been assessed across training science principles, structure, progression, content clarity, safety, and competitive effectiveness. Where improvements are identified, specific, actionable recommendations are provided.

Programs are grouped by type: **Running** (6 programs) and **Hyrox/Hybrid** (8 programs).

---

## Executive Summary

The program library is genuinely strong. The foundations — periodization, progressive overload, exercise selection, and target audience differentiation — are well thought through. The enhancement work (technique cues, warm-up/cooldown protocols, weekly themes, core progressions) has added meaningful quality. The library covers a wide range of athletes from beginners to elite competitors.

**Key strengths:** Periodization, technique detail, program variety, exercise selection  
**Key gaps:** Data model inconsistencies, strength work missing from running programs, a few programs need clearer scope definitions

---

## Scoring Framework

Each program is rated 1–10 across five dimensions:

| Dimension | What it measures |
|-----------|-----------------|
| **Structure** | Periodization, weekly layout, progression logic |
| **Content Quality** | Exercise selection, cues, descriptions |
| **Safety** | Appropriateness for stated audience, injury risk management |
| **Effectiveness** | Will this program deliver on its promise? |
| **Completeness** | Is anything critical missing? |

---

---

# RUNNING PROGRAMS

---

## 1. Beginner 5K Plan
**ID:** `running-5k-beginner` (local JSON)  
**Type:** Running | **Duration:** 6 weeks (42 days) | **Level:** Beginner  
**Target:** Couch-to-5k

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 5/10 | 9/10 | 7/10 | 5/10 |

### What Works Well
- The run/walk progression is textbook correct — starting at 60 seconds jogging, building to continuous running. This is the right approach.
- A dedicated recovery week (days 22–28) at reduced volume is excellent programming. Many beginner plans skip this.
- The final week includes a shakeout run and appropriate race-day guidance.
- Effort levels (1–10 scale) are consistent and well-calibrated.

### Issues & Recommendations

**1. No running form cues whatsoever.**  
This is the most critical gap. Beginners have the worst form and the most to gain from instruction. The current descriptions tell athletes *what* to do but not *how*. Add 3–4 basic form cues to every session:
```
Good example to add:
"Focus on: tall posture, relaxed shoulders, midfoot landing under your hips,
arms swinging forward/back (not across body), 170–180 steps per minute cadence."
```

**2. No strength/injury prevention component.**  
Beginner runners are the highest injury risk cohort. At minimum, add 2 bodyweight strength sessions per week in the first 3 weeks:
- Glute bridges, calf raises, single-leg stands, step-ups
- These don't require a gym and directly prevent the common beginner injuries (shin splints, IT band syndrome, knee pain)

**3. Fartlek workout (Day 10) is mislabeled and under-explained.**  
"During your 20-minute jog, pick up the pace for 60 seconds 4–5 times" is fine, but calling it "Fartlek" without explaining the term creates confusion. Either name it "Speed Play" or add a one-sentence explanation of the concept.

**4. Day 40 uses `paceZone: "marathon"` which is incorrect.**  
A 5k race is run at 5k effort (interval pace), not marathon pace. This is a data error — likely copied from a longer-race template. Fix the data type.

**5. Missing: Post-race guidance beyond the 6-week plan.**  
Add a brief "What now?" section — this is where you retain users. Guide them toward the 10k plan or Hyrox beginner program.

### Verdict
Solid foundation with the right pedagogical approach, but thin on instruction. Needs form cues and strength supplementation to be a genuinely professional product.

---

## 2. Improve Your 5K Time
**ID:** `ve6fME6cJH6dDuSPrMSl`  
**Type:** Running | **Duration:** 8 weeks (56 workouts) | **Level:** Intermediate  
**Target:** Intermediate runners seeking a 5K PB

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 9/10 | 7/10 | 7/10 | 9/10 | 7/10 |

### What Works Well
- Session type variety is excellent: Easy runs, VO2 Max intervals, Threshold runs, Repetition Pace, Race Pace Practice, Final Sharpening, Taper.
- The taper week structure is appropriate — reducing volume while maintaining some intensity.
- 5 days per week is aggressive but correct for intermediate athletes wanting to PB.
- Repetition Pace work (short, fast intervals with full recovery) is a strength of this plan and often missing from amateur programs.

### Issues & Recommendations

**1. No strength work included.**  
For a 5k performance program, this is a significant omission. Single-leg strength, plyometrics, and calf work directly improve running economy. Without it, athletes are leaving free speed on the table and increasing injury risk from 5 days/week of running.

Add 1 optional strength session per week (20–30 min, bodyweight/minimal equipment):
```
Recommended: 3x15 single-leg calf raises, 3x10 Bulgarian split squats,
3x12 glute bridges, 4x8 Nordic hamstring curls (or hamstring sliders),
2x10 bounding strides after an easy run.
```

**2. Week 1 volume may spike too aggressively for some intermediate athletes.**  
Starting week 1 at 5 days with VO2 Max intervals (Day 2) is a lot. Consider shifting the first interval session to Week 2 and making the first week easy/threshold only to establish baseline fitness. Add a note in the program description: "If coming off a break or at the lower end of intermediate, repeat Week 1 before advancing."

**3. Race Pace Practice sessions need actual target paces.**  
"Run at Race Pace" is vague. The session should prompt athletes to calculate their target pace and write it down. Add:
```
"Before this session: Calculate your goal 5k pace (e.g., if goal is 22:00,
your pace is 4:24/km or 7:05/mile). Write it here: ____. Run all race-pace
reps within 5 seconds per km of this target."
```

**4. Final Sharpening session needs more specificity.**  
What does "final sharpening" mean? Strides? Short intervals? Define the session concretely.

### Verdict
A well-designed intermediate 5K plan with strong session variety. Would be excellent with strength supplementation and more pace-specific guidance.

---

## 3. 10K Running Plan
**ID:** `jYNyJoDcdJVCLCq3zxZw`  
**Type:** Running | **Duration:** 12 weeks (84 workouts) | **Level:** Intermediate  
**Target:** Intermediate runners seeking a 10K PB, 5 days/week

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 9/10 | 7/10 | 7/10 | 9/10 | 7/10 |

### What Works Well
- 12-week duration with a 2-week taper is correct for a 10k. Well structured.
- VO2 max intervals are built on solid science — 800m and 1km intervals at 5k–10k pace are the right tools.
- Time Trial in mid-plan is excellent — athletes can see their progress and adjust goal pace accordingly. This is professional coaching practice.
- The variety across 12 weeks (progression from base to race-specific) follows proper periodization.

### Issues & Recommendations

**1. Same issue as the 5K plan — no strength work.**  
10k training at 5 days/week for 12 weeks is substantial. Posterior chain and calf work is critical. Recommend one supplemental strength session.

**2. Long runs may be underdeveloped.**  
From the data, the long run appears to stay at a consistent easy pace throughout without pace variation within the long run. Add some sessions where the long run includes a progressive element:
```
"Week 8 Long Run: 16km. First 10km at easy/conversational pace.
Final 6km at marathon pace. This builds fatigue resistance."
```

**3. Recovery run intensity needs monitoring guidance.**  
Recovery runs are listed at "effort: 2" but athletes notoriously run these too fast. Add: "If you're running with someone faster than you on this day, run alone. Recovery pace means you can sing aloud without getting out of breath."

**4. The Time Trial session needs protocol specificity.**  
Define: distance (5k? 10k?), warm-up protocol, and how to use the result. "Run a time trial" without context is unhelpful.

### Verdict
A professional intermediate 10K plan with sound structure. The session variety and Time Trial inclusion are standout features. Would benefit from strength supplementation.

---

## 4. Half Marathon Improver
**ID:** `5wjLfv0N4VWxxPT0ZxiO`  
**Type:** Running | **Duration:** 16 weeks (84 workouts) | **Level:** Intermediate  
**Target:** Intermediate runners seeking a half marathon PB

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 9/10 | 8/10 | 8/10 | 9/10 | 7/10 |

### What Works Well
- The 3-week taper for a half marathon is exactly right. Many amateur plans taper too little.
- Session variety is excellent: Easy, VO2 Max, Threshold, Repetition Pace, Time Trial, Race Pace Practice. These are the full toolkit of an experienced running coach.
- Starting Week 1 at 8km easy runs indicates this is genuinely calibrated for intermediate athletes, not beginners disguised as intermediate.
- The threshold volume (6.5km continuous in Week 1 growing to more in later weeks) is well-targeted for half marathon performance.

### Issues & Recommendations

**1. Workout count (84) doesn't align with 16-week duration.**  
16 weeks × 7 days = 112 days. 84 workouts = 12 weeks of content. This is a data inconsistency — either the program is actually 12 weeks, or workouts are missing for 4 weeks. Clarify and fix. This could confuse athletes significantly.

**2. No strength work.**  
Most important gap for a 16-week program. Half marathon training at 5 days/week over 16 weeks without strength work is a significant injury risk. Add at minimum: weekly hip/glute activation, calf strengthening, and core work.

**3. Long run distances not visible in summary.**  
The long run progression is the backbone of half marathon training. Need to confirm long runs are building appropriately (e.g., should peak around 18–20km in Week 12–13 before tapering).

**4. Add race morning protocol to the final week.**  
```
"Race Day Warm-up (20 min before start):
10 min easy jog → 5 min dynamic drills → 3x100m progressive strides
(50% → 70% → 85% effort) → arrive at start line warm and ready."
```

### Verdict
The strongest running plan in the library from a periodization standpoint. Fix the workout count discrepancy and add strength work to make it a top-tier product.

---

## 5. Trail Runner
**ID:** `ncYgpWVba8fxHre91CeD`  
**Type:** Running | **Duration:** 8 weeks (56 workouts) | **Level:** Intermediate  
**Target:** Intermediate runners tackling a hilly trail race

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 8/10 | 8/10 | 8/10 | 8/10 |

### What Works Well
- "Time on Feet" approach for long trail runs is correct — trail running is about duration, not pace. This shows genuine trail-specific coaching knowledge.
- Hill repeats (both short/steep and long climbs) are perfectly selected for trail race preparation.
- "Strength for Trail Stability" inclusion is a standout — most trail programs ignore this.
- Technical practice sessions for trail running are a great inclusion — navigating terrain is a real skill.
- Power hiking uphill during long runs is correctly prescribed.

### Issues & Recommendations

**1. Strength for Trail Stability needs more specificity.**  
What exercises? Currently it appears to be described without specific movements. Trail stability requires: single-leg work (lunges, pistol squat progressions), lateral hip strength (clamshells, side-lying leg raises), ankle stability drills, and eccentric calf work. Make this explicit.

**2. Technical Practice session needs more detail.**  
"Technical Practice" for trail running should specify: descent technique (forward lean, arm position, relaxed quads, foot placement), root/rock navigation, creek crossings if relevant. These are teachable skills.

**3. 8 weeks may be insufficient for a demanding course.**  
If the target race has significant elevation gain (1000m+), 8 weeks is on the short side for adequate adaptation. Add a note: "This plan works best if you already have a base of hill running. If coming from flat road running, complete 2–4 weeks of general hill conditioning before starting."

**4. Add elevation gain tracking guidance.**  
Provide guidance on how to incorporate elevation tracking: "For your long runs, target X meters of elevation gain per week to prepare for race conditions."

### Verdict
The most trail-specific and thoughtful of the running programs. Small gaps in exercise specificity, but the coaching concepts are sound.

---

## 6. Dual Peak: Trail & Strength
**ID:** `BtijMgolHGvf2P8QsZEK`  
**Type:** Running | **Duration:** 8 weeks (56 workouts) | **Level:** Elite  
**Target:** Elite multi-sport athlete peaking for both a trail half marathon AND a lifting competition

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 7/10 | 6/10 | 7/10 | 6/10 |

### What Works Well
- The two-phase concept is genuinely creative and serves a real athlete type (those who compete in both endurance and strength sports).
- Phase 1 (weeks 1–4) keeps strength at maintenance while building trail-specific fitness — this is the correct approach to dual peaking.
- Phase 2 (weeks 5–8) transition to strength focus with reduced running mirrors professional periodization used by CrossFit Games athletes and hybrid sports competitors.
- Hill repeats in Phase 1 are well-structured.

### Issues & Recommendations

**1. Critical Data Model Error: Strength sessions coded as "running" workouts.**  
Day 3 (Strength Maintenance A) and Day 10 (Strength Maintenance B) are coded as run type "recovery" with 0 distance. This is wrong — these are strength sessions with barbell work. The data model needs to store these correctly:
```
Current: type: "recovery", distance: 0, description: "1. Back Squat: 2 singles at 85%..."
Fix: These should be exercise-based workouts, not run entries.
```
This affects how these workouts display to users and how AI coaching interprets training load.

**2. Specificity of strength sessions is inconsistent.**  
Day 3 gives approximate weights (e.g., "~135kg for Back Squat") which is helpful but assumes all athletes are at that level. Change to percentage-based: "Work up to 2 singles at 85% of your 1RM Back Squat."

**3. Target audience needs stronger framing.**  
This is a very specialized program. Someone who doesn't have both a trail race AND a lifting competition within 8 weeks shouldn't do this plan. The description needs to be clearer about prerequisites: established strength base (1RM back squat, bench press, Clean & Jerk), intermediate trail running background.

**4. Recovery between high-intensity days needs more attention.**  
In Phase 1, athletes are doing Hill Repeats (Day 2) then a Strength session (Day 3) then Tempo on Hills (Day 4). Three consecutive hard days is aggressive. Recommend shifting the strength session to Day 5 (or making it a true active recovery/maintenance session).

**5. Phase transition week is missing.**  
Going from trail-focused Phase 1 to strength-focused Phase 2 with no transition workout is a sharp cut. Add a "Phase Bridge" day at the start of Week 5 with easy movement and performance reflection.

### Verdict
An innovative program for a genuine athlete type, but it has structural issues around the data model and day sequencing. With fixes, this could be a premium offering for elite multi-sport competitors.

---

---

# HYROX / HYBRID PROGRAMS

---

## 7. First Steps to Hyrox
**ID:** `JrHDGwFm0Cn4sRJosApH`  
**Type:** Hyrox | **Duration:** 12 weeks (84 workouts) | **Level:** Beginner  
**Target:** Gym-experienced athletes new to Hyrox, 4 days/week

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 9/10 | 9/10 | 9/10 | 9/10 | 8/10 |

### What Works Well
- The progression from Goblet Squats (Week 1) to Barbell Back Squats (Week 7) is perfectly executed. Movement complexity increases with athlete capability.
- Run/walk intervals building to continuous running is textbook beginner running development.
- Technique cues are excellent — arguably the best in the library.
- Warmup and cooldown protocols are detailed and specific.
- Core progression (Foundation → Load → Anti-rotation) follows sound principles.
- Farmer Carry progression with race application context is a smart inclusion.
- Week themes (e.g., "Movement Quality & Technique Foundation") help athletes understand the purpose of each week.
- Deload weeks are present and appropriately placed.

### Issues & Recommendations

**1. Finisher workouts lack Hyrox-specific context in early weeks.**  
Week 1 Finisher: "AMRAP 6 mins: 8 Kettlebell Swings, 10 Box Step-ups." While appropriate, these sessions should increasingly mirror Hyrox station formats. From Week 3 onwards, finishers should use actual Hyrox equipment (or alternatives) to build movement familiarity:
```
"Week 3 Finisher: Mini Hyrox Taste:
400m Run → 10 Wall Balls → 400m Run → 10 Burpee Broad Jumps
(This is your first experience of running between stations. Notice how your legs feel.)"
```

**2. Running sessions are standalone days without post-run strength.**  
Hyrox is a compromised running sport. Even in the beginner program, athletes should begin experiencing running while fatigued from Week 4 onwards. Consider adding a light (5–10 min) bodyweight circuit to the end of 1 running session per week from Week 4.

**3. Weekly structure has too many rest days in early weeks.**  
Three rest/active recovery days per week for a beginner is fine, but the active recovery days (Days 5 and 6) need more structure. Many beginners will just skip these. Provide a specific 20-minute mobility routine to do on these days rather than "Optional."

**4. Missing: Race format education.**  
Beginners new to Hyrox don't know what the race format is. Add a Week 1 overview explaining the 8-station format, typical race distances, and what to expect. This context motivates training.

**5. Running descriptions truncated in the UI.**  
From the data, running session descriptions are cut off mid-sentence in the stored data (e.g., "💡 Hyrox " with nothing following). This appears to be a data storage truncation issue. Check and fix the stored workout descriptions.

### Verdict
This is the strongest overall program in the library from a beginner coaching perspective. The exercise progression, technique instruction, and structure are genuinely professional-grade. Small refinements to add Hyrox context and compromised running elements.

---

## 8. Hyrox Fusion Balance
**ID:** `j5qE8awNGl8IPoNzaVFH`  
**Type:** Hyrox | **Duration:** 12 weeks (84 workouts) | **Level:** Intermediate  
**Target:** Intermediate Hyrox athletes, 4 days/week, balanced hybrid development

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 9/10 | 8/10 | 9/10 | 10/10 | 8/10 |

### What Works Well
- Best overall balance between running, strength, and Hyrox-specific work.
- The transition from Threshold Introduction (early weeks) → Threshold Progression → VO2 Max Introduction follows a logical physiological development sequence.
- Compromised Running sessions are correctly placed (after strength days) to simulate race conditions.
- Week 7 shift to Power (heavy 3RM squats, push press, weighted chin-ups) shows an understanding of the strength-endurance continuum required for Hyrox.
- 4 days/week is the right commitment level for the intermediate athlete.

### Issues & Recommendations

**1. Race Simulations should begin earlier.**  
Based on the session types, the first race simulation appears late in the program. For an intermediate athlete, short race simulations (30–40 min, 3–4 stations) should start by Week 4:
```
"Week 4 Mini Simulation (30 minutes):
800m Run → 500m SkiErg → 800m Run → 25m Sled Push (moderate weight)
Purpose: Learn transitions and feel what running-into-stations is like."
```

**2. Long Aerobic Runs lack progressive distance guidance.**  
Zone 2 long runs are listed without explicit distance increases week-over-week. Specify target distances for each week. The long run should peak around 10–14km for this program level before tapering.

**3. Strength sessions need more power development in early weeks.**  
The program jumps to 3RM squats in Week 7, but the progression from volume to intensity isn't explicitly mapped. Add power elements earlier (Box jumps, broad jumps) to build the neuromuscular qualities needed for explosive Hyrox movements.

**4. Compromised Running prescription needs more detail.**  
"Compromised Running" as a session title is correct, but the prescription needs specificity: "Immediately after completing your last strength exercise, walk/jog to the treadmill and begin your run. Target your easy run pace — your goal is to maintain form when your legs are pre-fatigued."

### Verdict
The best all-around Hyrox program in the library. This should be the flagship program for intermediate athletes. Small gaps in simulation timing and distance specificity.

---

## 9. Hyrox Run Performance
**ID:** `mTSbnEGsI9nzqDccm90B`  
**Type:** Hyrox | **Duration:** 12 weeks (84 workouts) | **Level:** Intermediate  
**Target:** Athletes making running their primary Hyrox weapon, 5 days/week

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 8/10 | 8/10 | 9/10 | 8/10 |

### What Works Well
- The Run Ladder workout (400–800–1200–800–400m with jog recovery) in Week 7 is sophisticated and effective for developing both VO2 max and pacing awareness. This is elite-level programming.
- The Compromised Running session correctly simulates the race fatigue state.
- Building on 10k principles is the right foundation — the 1km run segments in Hyrox are best trained through 10k-specific workouts.
- 5 days/week running volume is appropriate for athletes wanting to make running their strength.

### Issues & Recommendations

**1. Strength sessions are likely underdeveloped relative to Hyrox demands.**  
"Strength for Runners" — what does this session contain? From the data, 254 exercise entries across 84 workouts gives a relatively low exercise density. Hyrox still has 8 demanding stations beyond running. The strength sessions need to include sled work, SkiErg, wall balls, and rowing — not just general runner strength.

**2. Hill running is limited in early weeks.**  
Hills are introduced in Week 7 only (6x90-second hill repeats). For Hyrox run performance, hill strength should start Week 3–4. Running economy on flat course + strength on hills = faster Hyrox times.

**3. VO2 Max sessions need complete interval prescriptions.**  
Interval sessions should specify: number of reps, distance/duration, recovery time, target effort, and what pace zone to target. Currently some sessions reference "Run Ladder" which is excellent, but earlier sessions may be less specific.

**4. The Compromised Running sessions need a run distance target.**  
After a strength session, athletes should have a specific distance target: "Run 5km at easy pace immediately following strength work." Without a target, athletes will run too little or stop when it gets uncomfortable.

**5. Missing: Cadence and running form coaching.**  
This is a running-focused program. More than any other in the library, it should include explicit running mechanics coaching: cadence targets (170–180 spm), posture cues, foot strike guidance, breathing patterns. This distinguishes a professional running program from a generic training plan.

### Verdict
A well-designed program for the right athlete type. The Run Ladder and Compromised Running sessions show sophisticated coaching thinking. Gaps in running form coaching and strength session specificity prevent it from being elite-tier.

---

## 10. Hyrox Doubles & Relay Prep
**ID:** `uf3EsOGPMp5wGV7bPi1h`  
**Type:** Hyrox | **Duration:** 12 weeks (84 workouts) | **Level:** Intermediate  
**Target:** Partner/doubles event athletes, 5 days/week

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 7/10 | 8/10 | 8/10 | 6/10 |

### What Works Well
- Unique in the market — no other major Hyrox platform offers partner-specific programming.
- Individual training days alongside partner WODs is the correct approach.
- Week 7 hill repeats (6x90-second) for individual running development is appropriate.
- The combination of individual fitness building + team-specific sessions mirrors how good partner programs are structured.

### Issues & Recommendations

**1. Partner WOD content needs much more specificity.**  
"Partner WOD — Intro to Teamwork" is a session title without visible content detail. These sessions need explicit, named workouts. A vague "partner workout" in a partner-specific program is a missed opportunity. Each Partner WOD should be a named, designed session:
```
"Partner WOD — Week 3: Station Rotations
AMRAP 20 minutes:
Partner A: 400m Run
Partner B: 15 Wall Balls + 15 Burpees
Switch when Partner A returns from run.
Focus: Smooth handoffs, communication, consistent pace."
```

**2. Communication drills are listed but not defined.**  
Strategy, handoff practice, and communication training are listed as features but need concrete exercises: What signals do they use? What handoff protocols are practiced? How do they manage different fatigue levels?

**3. Station assignment strategy guide is critical and missing.**  
Which partner does sleds? Who does wall balls? Who is stronger at SkiErg? This should be addressed explicitly in Week 5–6 with a "Race Strategy Session":
```
"This week: Complete a full Hyrox station battery with your partner.
Time each of you on: SkiErg 1000m, Sled Push 25m, Wall Balls 30 reps.
Based on results, decide your station assignments for race day."
```

**4. What happens when partners have different fitness levels?**  
This is the most common challenge in doubles training. The program should address this directly — how to manage a fitness gap, how to pace the stronger/weaker partner, when to push vs. support.

**5. The program requires a partner to be useful, but this isn't clearly flagged before sign-up.**  
The prerequisite (must have a training partner available on all 5 days) should be prominently communicated during program selection.

### Verdict
A genuinely unique offering but the partner-specific content needs significant development. The individual training foundation is solid. The differentiating partner sessions — which justify why someone would choose this over a standard program — need full workout prescriptions.

---

## 11. Olympic Lifting & Power Cycle
**ID:** `QXpgKvrxjW4VfYspOlHQ`  
**Type:** Hyrox (Strength-focused) | **Duration:** 12 weeks (84 workouts) | **Level:** Advanced  
**Target:** Advanced athletes with Olympic lifting experience, building maximal strength

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 9/10 | 7/10 | 9/10 | 8/10 |

### What Works Well
- Percentage-based programming is correct for advanced strength athletes. Percentages force accountability and appropriate loading.
- The weekly split (Snatch+Squat Volume / Clean+Jerk+Squat Volume / Active Recovery / Pulling+Posterior Chain / Accessory+GPP) follows a proven Olympic weightlifting template.
- Progression from blocks work in Week 7 shows a sophisticated understanding of technical development (Snatch from blocks is an excellent positional drill).
- GPP accessory work keeps general fitness while focusing on strength.
- 362 exercise entries across 84 workouts (4.3 avg) shows good session density.

### Issues & Recommendations

**1. CRITICAL SAFETY ISSUE: No deload weeks are visible in the first 12 weeks.**  
Twelve consecutive weeks of heavy Olympic lifting without structured deload is a significant overtraining and injury risk. Mandatory deload at Week 4 and Week 8 at 60–65% volume:
```
"WEEK 4: DELOAD WEEK
This week, all percentages drop to 60-65% of normal working weights.
Volume drops by 40%. Focus on perfect technique, not loading.
This is not optional — your body needs this adaptation period."
```

**2. Active Recovery Day is too heavy.**  
Week 1 Day 3 (Active Recovery) includes: Full Warm-up + Easy Cardio + Core Finisher + Grip Strength Farmer Carries + Full Cool-down. Farmer Carries at 70–80% bodyweight is NOT recovery. Active recovery should be: 20–30 min Zone 2 cardio + light mobility. Remove the farmer carries and core finisher from recovery days.

**3. Safety prerequisites need to be firmer.**  
The existing program description mentions testing 1RMs, but there needs to be a stronger warning:
```
"PREREQUISITES (non-negotiable):
- Minimum 1 year of consistent Olympic lifting coaching
- Can demonstrate full squat snatch with empty bar with correct form
- Can perform overhead squat with appropriate load
- Know your current 1RM for: Back Squat, Snatch, Clean & Jerk
- Currently training 4+ days/week (do not start this cold)"
```

**4. Snatch Complex warm-up in Week 1 jumps straight to technical work.**  
Before doing complex technical Olympic lifts, athletes need adequate specific warm-up: ankle mobility, thoracic spine rotation, overhead position drills, empty bar warm-ups. Add a specific Olympic lifting warm-up protocol.

**5. The program is labeled "Hyrox" type but has minimal Hyrox elements.**  
Only 3/10 Hyrox specificity. This is an Olympic weightlifting program that can be used as a strength block before a Hyrox training cycle. Clarify this positioning: "Use this program as your strength foundation, then follow with 'Hyrox Fusion Balance' for race preparation."

### Verdict
A high-quality strength program that will genuinely build Olympic lifting proficiency. The safety gaps (no deload, overly heavy recovery days) need to be fixed. Reframe as a "strength block" program rather than a standalone Hyrox program.

---

## 12. Ultra Elite Performance
**ID:** `dBJAHOM8TqeMyanNG9s5`  
**Type:** Hyrox | **Duration:** 12 weeks (84 workouts) | **Level:** Advanced  
**Target:** Elite Hyrox competitors, 6 days/week, undulating periodization

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 9/10 | 9/10 | 8/10 | 9/10 | 8/10 |

### What Works Well
- Undulating periodization (Week A: Anaerobic / Week B: Base / Week C: Aerobic Capacity) is sophisticated, research-backed, and appropriate for elite athletes. This prevents accommodation and maximizes adaptation.
- Week A/B/C cycling matches energy system periodization used by top Hyrox coaches.
- Lower Body Speed-Strength in Week 7 (Dynamic Effort Deadlifts + KB Swings + Plyometrics) shows understanding of the force-velocity continuum.
- 6 days/week is only appropriate for truly elite athletes, and this program earns that commitment.
- Compromised Running correctly placed.
- 353 exercise entries provides excellent density.

### Issues & Recommendations

**1. HRV and readiness monitoring guidance should be at the start, not buried.**  
Elite athletes training 6 days/week at this intensity need a clear monitoring protocol at the front of the program. Add to the program description:
```
"DAILY CHECK-IN PROTOCOL:
Before each session, rate:
- Sleep quality (1–5)
- Muscle soreness (1–5)  
- Motivation/energy (1–5)
Score ≤ 7/15: Reduce session intensity by 20-30%
Score ≤ 5/15: Take rest day or swap to mobility session
Never train through a score of 3 or less in any single category."
```

**2. Only 1 rest day per week with no clear deload structure.**  
Even elite athletes at this volume need structured deload weeks. Add a full deload week at Week 4 and Week 8 (reduce to 4 days, 60% intensity). Provide explicit instructions: "Deload weeks are non-negotiable at this training volume. Adaptation happens during recovery, not training."

**3. Taper guidance for race week is missing.**  
The program ends at Week 12 with no post-program taper guidance. Provide a 2-week taper protocol:
```
"WEEKS 13–14: RACE TAPER
Week 13: 4 sessions (50% volume, maintain some intensity — 2x10-min tempo, 
  1 Hyrox simulation at 70%, 1 long easy run)
Week 14: 3 sessions (30% volume, race-pace strides, shakeout)
Race Day: Detailed warm-up protocol provided."
```

**4. Week B (Base Training) sessions need more specificity.**  
High Volume Base Training is described as a concept but needs explicit workout prescriptions showing the volume difference from Week A.

**5. Missing: Sleep and recovery protocols.**  
At 6 days/week, recovery is the limiting factor. Add a recovery protocol section: sleep duration targets (8–9 hours mandatory at this volume), ice bath timing, compression guidance, and nutrition windows.

### Verdict
The most sophisticated Hyrox program in the library. The periodization model is genuinely elite-level. Needs a proper taper plan and more explicit deload weeks to be safe at the stated intensity.

---

## 13. 50K Ultra Marathon Plan
**ID:** `RQDomx9rFVLnJNUCkkKh`  
**Type:** Listed as "hyrox" (should be "running") | **Duration:** 13 weeks (91 workouts) | **Level:** Intermediate+  
**Target:** 50km ultra marathon preparation with CrossFit gym background

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 8/10 | 8/10 | 9/10 | 7/10 |

### What Works Well
- Genuinely excellent program concept — ultra marathon prep designed for athletes with CrossFit background.
- Three-phase structure (Foundation → Build → Specificity) is textbook ultramarathon periodization.
- Eccentric strength work for downhill resilience (Eccentric Back Squat: 5-second lowering) is a mark of experienced coaching. This directly addresses the most common ultra-related injury cause.
- CrossFit gym sessions with thematic names (Trail Legs, The Climber) are well-conceived.
- 13 weeks is an appropriate duration for a 50k first-timer.
- Peak volume of 58km/week is realistic for a 50k.

### Issues & Recommendations

**1. CRITICAL: Program type is set to "hyrox" — this should be "running" or a new "ultra" type.**  
This affects how the program is displayed, recommended, and described to users. An athlete being recommended Hyrox programs should not see an ultra marathon plan. Fix the programType in the database.

**2. CrossFit gym sessions coded as exercise entries but need clarity.**  
The gym sessions appear to mix CrossFit-style workouts (named WODs) with more traditional strength. Excellent concept, but the descriptions stored in exercise entries need to be self-contained — athletes may not have a CrossFit coach to guide them.

**3. Phase 3 (4 runs + 1 gym session) may drop strength too soon.**  
For a 50k, reducing gym sessions to 1/week in Phase 3 risks fatigue-induced form breakdown in the race's final 15–20km. Consider keeping 2 gym sessions in Phase 3 with reduced volume.

**4. Race simulation is critical and its structure needs verification.**  
A 50k requires practicing specific conditions: fueling every 30–45 minutes, running through fatigue, managing kit. Confirm the race simulation sessions explicitly cover these elements.

**5. Missing: Nutrition and fueling protocol.**  
Ultra marathons are as much a nutrition challenge as a physical one. The program needs at minimum a basic fueling framework: when to start eating (30–45 min into run), what to practice using (gels, real food), how to practice gut training during long runs. This is a fundamental coaching requirement for ultra programs.

**6. Post-race recovery protocol.**  
50k is a serious physiological undertaking. Add Week 14: Post-Race Recovery with guidance on activity, nutrition, and return-to-training timeline.

### Verdict
A genuinely impressive and well-constructed ultra marathon program. Fix the program type immediately and add fueling guidance to make it professionally complete.

---

## 14. Hyrox to CrossFit: Skill & Strength Bridge
**ID:** `hI2ziHSOkazjrbObnOOj`  
**Type:** Listed as "hyrox" | **Duration:** 16 weeks (112 workouts) | **Level:** Intermediate/Advanced  
**Target:** Hyrox athletes learning CrossFit skills and building CrossFit-specific strength

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 8/10 | 8/10 | 7/10 | 8/10 | 7/10 |

### What Works Well
- The "bridge" concept is excellent and fills a real market gap. Many Hyrox athletes want to transition to CrossFit competition or open gyms.
- Block structure (Block 1: Foundation → Block 4: Peak) provides clear long-term progression.
- Wave loading (3-2-1 rep schemes: 80%/87%/92%) in Block 3 is sophisticated strength programming.
- Benchmark testing gives athletes measurable progress markers — a key engagement feature.
- Engine Maintenance blocks keep aerobic conditioning during the strength-focused program.
- 16 weeks is appropriate for genuine skill acquisition in Olympic lifts and gymnastics movements.

### Issues & Recommendations

**1. "Skill & Strength Bridge" is asking athletes to learn a lot simultaneously.**  
16 weeks to learn Olympic lifts AND gymnastics skills (kipping pull-ups, muscle-ups, handstands) AND build CrossFit strength is ambitious. Be honest about realistic expectations: "By Week 16, you will have a strong foundation in these skills. Mastery takes 1–2 years of consistent practice."

**2. Gymnastics skill progressions need prerequisite criteria.**  
Can the athlete do strict pull-ups? Proper push-ups? Hollow body hold? These are prerequisites for kipping and muscle-up progressions. Add: "If you cannot do 5 strict pull-ups, substitute ring rows and band-assisted pull-ups for all pulling movements until Week 8."

**3. The Metcon in Block 3 (1000m Row / 50 Thrusters / 30 Kipping Pull-ups) is a famous benchmark.**  
This appears to reference "Fran" or a named workout. Label it correctly. Using standard CrossFit benchmarks is smart — athletes can compare their result to the broader CrossFit community.

**4. Block 1 requires "Engine Maintenance" — specify what this means.**  
Engine Maintenance is a session type. Provide explicit prescriptions: "30 min Zone 2 steady state, or 3x10 min at aerobic threshold with 3 min rest. Keep all effort below 75% max HR."

**5. How does this program connect back to Hyrox?**  
Athletes who complete this 16-week bridge program — what should they do next? Add a post-program pathway: "After completing this program, you are ready for 'Hyrox Fusion Balance' (intermediate) or 'Ultra Elite Performance' (advanced)."

**6. Program is labeled "hyrox" type — consider adding "crossfit" as a new program type.**  
Or at minimum, update the description to clarify that this is a CrossFit-focused training program for Hyrox athletes, not a Hyrox race-specific program.

### Verdict
A creative and professionally structured program for a genuine athlete transition. The coaching concepts are sound. Needs clearer prerequisite screening and post-program pathway guidance.

---

## 15. HybridX Master 12-Week Integrated Schedule
**ID:** `y6RDOMpnfmpW6yZMFNRL`  
**Type:** Hyrox | **Duration:** 12 weeks (84 workouts) | **Level:** Elite  
**Target:** Jon — Sub 1:05 Hyrox Pro

| Structure | Content Quality | Safety | Effectiveness | Completeness |
|-----------|----------------|--------|---------------|--------------|
| 9/10 | 9/10 | 7/10 | 9/10 | 7/10 |

### What Works Well
- The RP100 (100-rep sets) methodology for metabolic conditioning is advanced and backed by Hyrox-specific research. Ultra-high rep work trains the muscle endurance required for race stations.
- Mikko's Triangle inclusion shows awareness of elite Hyrox performance frameworks.
- PHA (Peripheral Heart Action) circuits are an intelligent tool for maintaining cardiovascular load while building muscular endurance.
- 511 exercise entries across 84 workouts (6+ per workout) reflects very high session density — this is elite training.
- Compromised Running correctly integrated.
- Century Sets with progressive difficulty (highest ever first-burst rep count) is effective for building mental toughness alongside physical capacity.

### Issues & Recommendations

**1. This program is built for a specific person and cannot function as a general public program.**  
"Athlete: Jon. Target: Sub 1:05 Hyrox Pro." The program is personalized to Jon's specific metrics. Loading like "100 reps @ 60kg Goblet Squat" and "100 reps @ 32kg KB Swing" are specific to Jon's strength levels. A user with different strength levels will either undertrain or injure themselves.

**Solutions:**
- Remove this from the general programs library and move to Jon's personalPrograms collection, OR
- Create a templatized version with RPE-based or percentage-based loading that works for any elite athlete

**2. RP100 (100-rep sets) carries high injury risk if loading is inappropriate.**  
100 reps at any significant weight demands progressive adaptation. If a new user picks this program without the base strength Jon has, injury is likely. Add explicit prerequisite loading tests:
```
"Before starting this program, test:
- Can you complete 100 Walking Lunges in <8 minutes at bodyweight? 
  If no: build to this before starting.
- Can you KB Swing 24kg for 50 consecutive reps with good form?
  If no: this program is not right for you yet."
```

**3. The session naming is too personal/specific.**  
"RP100 Peak – Push First Burst" and references to "Mikko's Triangle Baseline" won't mean anything to a new user. Either add explanations of these methodologies or use more universal terminology.

**4. Missing: Post-race plan.**  
For an athlete targeting a specific race (Sub 1:05 Hyrox Pro), the program should include a 2-week race-specific taper and race day protocol.

### Verdict
An elite-level program with genuinely sophisticated methodology. Either make this a true personal program (Jon's private program) or create a properly templatized elite version accessible to other high-level athletes with appropriate prerequisites.

---

---

# CROSS-PROGRAM GAPS & SYSTEM-LEVEL RECOMMENDATIONS

---

## Structural/Data Issues

| Issue | Programs Affected | Priority |
|-------|------------------|----------|
| Data truncation in workout descriptions | First Steps to Hyrox, others | HIGH — Fix immediately |
| programType="hyrox" on non-Hyrox programs | 50k Ultra Plan, Hyrox→CrossFit Bridge | HIGH — Affects recommendations |
| Strength sessions coded as running entries | Dual Peak: Trail & Strength | HIGH — Breaks workout display |
| Workout count doesn't match program duration | Half Marathon Improver (84 workouts, 16 weeks) | MEDIUM |
| Personal-specific program in public library | HybridX Master Schedule | MEDIUM |

## Coaching Content Gaps (All Programs)

### 1. Running programs have no strength work
All 6 running programs lack supplemental strength sessions. This is the single biggest gap from a professional coaching standpoint. Running-only athletes get injured. Add optional (or mandatory) 1x/week bodyweight strength sessions to all running plans.

### 2. No race day protocols in most programs
Elite athletes know how to race — beginners don't. Add a race day protocol to every program:
- Night before: sleep target, meal timing
- Morning: wake time, breakfast, hydration
- Warm-up: specific protocol by event type
- First 10 minutes of race: pace restraint
- Recovery protocol post-race

### 3. Injury prevention guidance is absent
No program currently has a "warning signs" section. Add to every program:
```
"STOP and rest (don't push through):
- Sharp joint pain (knee, hip, ankle)
- Pain that increases during exercise
- Pain that changes your gait
MONITOR (reduce intensity, don't stop):
- General muscle soreness
- Low energy/motivation on one day
- Mild tightness that warms up"
```

### 4. Breathing technique is underserved
Breathing is the single most undercoached element in both Hyrox and running. Add breathing cues to key sessions:
- Easy runs: nasal breathing only (develops aerobic efficiency)
- Intervals: rhythmic breathing (in-2-3, out-2)
- Strength: exhale on exertion
- Hyrox stations: individual rhythm for each station

### 5. Progression pathway between programs is missing
Athletes finishing one program don't know what to do next. Add a "What's Next?" section to every program linking to the recommended subsequent program.

---

## Priority Action List

### Immediate (Data/Technical Fixes)
1. Fix programType for 50k Ultra Plan (hyrox → running or ultra)
2. Fix Dual Peak strength sessions coded as running entries
3. Fix truncated workout descriptions (First Steps to Hyrox running sessions)
4. Move HybridX Master Schedule to personalPrograms or create a templatized version
5. Fix Beginner 5K race day paceZone (marathon → interval)

### High Priority (Coaching Content)
6. Add deload weeks to Olympic Lifting & Power Cycle
7. Reduce Olympic Lifting Active Recovery day load (remove farmer carries)
8. Add race taper protocols to Ultra Elite Performance, Hyrox Fusion Balance, Hyrox Run Performance
9. Add strength supplementation to all 6 running programs
10. Add Partner WOD specific workout prescriptions to Doubles & Relay Prep

### Medium Priority (Quality Improvements)
11. Add running form cues to all running programs
12. Add race format education to First Steps to Hyrox
13. Add mini race simulations from Week 4 in Hyrox Fusion Balance
14. Add injury prevention warning signs to all programs
15. Add "What's Next?" pathway links between programs
16. Add fueling protocol to 50k Ultra Plan
17. Add prerequisites page to Olympic Lifting & Power Cycle and HybridX Master Schedule

### Low Priority (Premium Additions)
18. Add breathing technique cues to key sessions
19. Add sleep and recovery protocols to advanced programs
20. Add race day morning protocols to all programs
21. Add benchmark testing to First Steps to Hyrox (Weeks 4 and 12)
22. Add mental skills / visualization content to race simulation workouts

---

## Overall Library Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| Program Variety | 10/10 | Excellent range from beginner to elite, running to Hyrox |
| Periodization Quality | 9/10 | Solid throughout; deload weeks needed in some programs |
| Exercise Selection | 9/10 | Appropriate and Hyrox-specific where needed |
| Technical Instruction | 8/10 | Enhanced programs have excellent cues; running programs lag |
| Safety Protocols | 6/10 | Missing deloads, injury warnings, prerequisite screening |
| Completeness | 7/10 | Strength work missing from running plans; taper guidance sparse |
| Data Integrity | 6/10 | Several data model and classification issues need fixing |

**Overall: A genuinely professional training library that, with targeted fixes, can compete at the top of the market. The bones are excellent — the gaps are fillable.**

---

*End of review. For implementation support, prioritize data fixes first (they affect all users), then coaching content additions by priority tier.*
