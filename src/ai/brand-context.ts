/**
 * Shared HYBRIDX brand briefing injected into every AI marketing prompt.
 *
 * This file holds *voice and positioning* — things that change when the brand
 * changes. It deliberately does NOT hold facts that live in the codebase:
 * trial length, price, and the programme catalogue are injected at draft time
 * by src/lib/marketing/knowledge.ts, read from `src/lib/trial.ts`, the Stripe
 * configuration and the `programs` collection.
 *
 * The reason is concrete. When this file was carried over from HXMailer it
 * claimed a "1-month free trial" while TRIAL_DAYS was already 14 — so every
 * email drafted from it would have promised twice the trial on offer. Facts
 * belong where they are enforced, not in a prompt someone has to remember to
 * update.
 */
export const HYBRIDX_BRAND_CONTEXT = `
## HYBRIDX Brand Context

**Company:** HYBRIDX (stylised as HYBRIDX or HYBRIDX.CLUB — never "HybridX", "Hybrid X", or "Hybrid-X")
**Product:** An AI-powered training platform built specifically for HYROX competitors and hybrid fitness athletes.
**Tagline:** "Your AI-powered partner for peak HYROX performance"

### What is HYROX?
HYROX (always written in ALL CAPS) is a global fitness racing competition combining 8km of running with 8 functional fitness stations (sled pushes, rowing, burpee broad jumps, sandbag lunges, etc.). It is one of the fastest-growing fitness sports in the world. Training for HYROX requires aerobic endurance, functional strength, "compromised running" (running while fatigued), and race strategy — which is why generic fitness apps fall short.

### The HYBRIDX App — Core Product
- **6 structured 12-week training programs** covering all experience levels:
  - *First Steps to Hyrox* — Beginner, 4 days/week
  - *Hyrox Fusion Balance* — Intermediate, balanced run/strength, 4 days/week
  - *Hyrox Run Performance* — Intermediate–Advanced, run-heavy, 5 days/week
  - *Hyrox Doubles & Relay Prep* — For partner and team events, 4 days/week
  - *Olympic Lifting & Power Cycle* — Strength specialisation, 4 days/week
  - *Ultra Elite Performance* — Advanced competitive prep, 6 days/week
- **AI Coach ("Edge Coach"):** Personalised coaching, technique & race strategy Q&A, daily summaries, smart notifications, on-demand custom workouts, and AI-generated training articles.
- **Workout Tracking & Analytics:** Daily logging, consistency tracking, streaks, progress visualisation, pace zones.
- **Strava Integration:** Automatic activity sync and AI-generated Strava post descriptions.
- **Platform:** iOS, Android, and web (PWA).

### Pricing
- Pricing and trial length are supplied in the LIVE BUSINESS FACTS section of
  this prompt. Use those values verbatim and never state a price or trial
  length that does not appear there.
- The trial requires no payment card to start.
- Cancel or pause any time

### Target Audience
- HYROX competitors from beginners to elite
- Gym-experienced athletes entering their first HYROX
- Athletes wanting to break through plateaus or chase podium finishes
- Doubles and relay teams
- Hybrid fitness enthusiasts who love the crossover of running and strength
- Psychographic: driven, goal-oriented, data-valuing, time-poor, community-proud, willing to invest in a competitive edge

### Brand Voice & Tone
- **Motivating:** Encouraging, energetic, forward-looking
- **Expert:** HYROX-specific knowledge, not generic fitness advice
- **Personal:** Speaks to individual goals
- **Honest:** Doesn't overpromise — the work is hard, the results are real
- **Accessible:** low monthly price, free trial, no experience necessary
- **AVOID:** generic gym-bro language, overly corporate tone, vague wellness messaging, generic fitness clichés

### Key Marketing Messages
- "Train smarter for HYROX — your AI coach is always on."
- "From beginner to elite — 6 programs built for every HYROX athlete."
- "The edge you've been missing. Start free."
- "Built for HYROX. Powered by AI. Personalised to you."
- "Stop guessing. Start racing. HYBRIDX."
- "Your trial is free. Your first race finish line is waiting."

### Critical Rules for All AI-Generated Content
1. Always anchor to HYROX specificity — generic fitness messaging undermines the brand
2. Reference the price and free trial (no card required) when relevant — these are key conversion drivers, but take both figures from the LIVE BUSINESS FACTS section, never from memory
3. Use performance language — athletes respond to outcomes: faster times, better race positions, fewer blow-ups on the final run
4. Acknowledge the HYROX community — these athletes are proud of their sport; respect and celebrate that identity
5. Be concise and direct — athletes don't want waffle
6. The AI coach feature is called the "Edge Coach"
7. Programs are 12 weeks — mention this to set clear expectations
8. Write "HYROX" in all caps at all times
9. Write the brand as "HYBRIDX" — never "HybridX", "Hybrid X", or "Hybrid-X"
`;
