// scripts/rebuild-run-sessions.ts
//
// Rebuilds every run session's Garmin step list from the stored run rows,
// instead of regexing the joined prose the way the live mapper does.
//
// The rules, as agreed:
//
//   Unit          One unit per step, never a mix. A duration stated in the
//                 description wins; then a distance stated in the description;
//                 then the stored distance. Advisory times are not durations —
//                 "a pace you could hold for approx. 1 hour" describes an
//                 effort, "fuel every 30-40 min" is a fuelling note. A "time on
//                 feet" goal IS the target, by decision.
//   Warm-up       Honour the stored warm-up row in its own unit. Only where a
//                 session has none does it get a 15 min TIME warm-up.
//   Cool-down     Same; a session with none gets an OPEN lap-press cool-down.
//   Recovery      Never OPEN. Honour the recovery the row states, in its own
//                 unit ("400m easy jog recovery" stays 400 m). Where none is
//                 stated: 2 min for reps of 1 km or 3 min and over, else 90 s.
//   Target        Work steps carry the HR zone derived from the row's RPE, as
//                 targetValue 1-5 per Training API V2 §3.2.1.
//
// Usage:
//   npx tsx scripts/rebuild-run-sessions.ts plans.json rebuilt.json

import * as fs from 'fs';
import { rpeToHrZone } from '@/lib/garmin/workout-mapper';

// ── Text parsing ─────────────────────────────────────────────────────────────

/** Phrases that make a following time an aside rather than the session length. */
const ADVISORY = /(hold for|every|each|before|after)/i;

function statedDuration(text: string): number | null {
  if (!text) return null;
  const pats: Array<[RegExp, (m: RegExpMatchArray) => number]> = [
    [/(\d+)\s*(?:hrs?|hours?|h)\b\s*(?:and\s+)?(\d+)\s*(?:mins?|minutes?)\b/i,
      (m) => +m[1] * 3600 + +m[2] * 60],
    [/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/i, (m) => Math.round(parseFloat(m[1]) * 3600)],
    [/(\d+)\s*[-–]\s*(\d+)\s*(?:mins?|minutes?)\b/i, (m) => Math.round(((+m[1] + +m[2]) / 2) * 60)],
    [/(\d+)\s*(?:mins?|minutes?)\b/i, (m) => +m[1] * 60],
  ];
  for (const [re, toSecs] of pats) {
    const m = text.match(re);
    if (!m) continue;
    // Reject a time introduced by an advisory phrase in the run-up to it.
    const lead = text.slice(Math.max(0, m.index! - 30), m.index!);
    if (ADVISORY.test(lead)) continue;
    return toSecs(m);
  }
  return null;
}

function statedDistanceM(text: string): number | null {
  if (!text) return null;
  const km = text.match(/(\d+(?:\.\d+)?)\s*km\b/i);
  if (km) return Math.round(parseFloat(km[1]) * 1000);
  const m = text.match(/(\d+)\s*m\b(?!in)/i);
  return m ? +m[1] : null;
}

/** The recovery the work row spells out, in whichever unit it uses. */
function statedRecovery(text: string): { type: 'TIME' | 'DISTANCE'; value: number } | null {
  if (!text) return null;
  const dist = text.match(/(\d+(?:\.\d+)?)\s*(km|m)\b[^.]{0,30}?recover/i);
  if (dist) {
    const v = dist[2].toLowerCase() === 'km' ? parseFloat(dist[1]) * 1000 : parseFloat(dist[1]);
    return { type: 'DISTANCE', value: Math.round(v) };
  }
  const mins = text.match(/(\d+)\s*(?:mins?|minutes?)[^.]{0,30}?recover/i);
  if (mins) return { type: 'TIME', value: +mins[1] * 60 };
  const secs = text.match(/(\d+)\s*(?:secs?|seconds?)[^.]{0,30}?recover/i);
  if (secs) return { type: 'TIME', value: +secs[1] };
  return null;
}

// ── Step shapes ──────────────────────────────────────────────────────────────

interface Step {
  intensity: 'WARMUP' | 'ACTIVE' | 'INTERVAL' | 'RECOVERY' | 'COOLDOWN';
  description: string | null;
  durationType: 'TIME' | 'DISTANCE' | 'OPEN';
  durationValue: number | null;
  durationValueType: 'METER' | null;
  targetType: 'HEART_RATE' | 'OPEN';
  targetValue: number | null;
  repeatValue?: number;       // set on the container this step belongs to
  origin: string;             // which stored row, and why this unit
}

interface RebuiltSession {
  programId: string;
  programName: string;
  entryIdx: number;
  day: number;
  title: string;
  kind: 'interval' | 'steady' | 'rest';
  currentSteps: number;
  steps: Array<{ step: Step; repeatOf?: number }>;
  notes: string[];
}

function unitFor(row: any, label: string): Pick<Step, 'durationType' | 'durationValue' | 'durationValueType'> & { why: string } {
  const desc = row.description || '';
  const secs = statedDuration(desc);
  if (secs) {
    return { durationType: 'TIME', durationValue: secs, durationValueType: null,
             why: `${label}: description states a time` };
  }
  const dm = statedDistanceM(desc);
  if (dm) {
    return { durationType: 'DISTANCE', durationValue: dm, durationValueType: 'METER',
             why: `${label}: description states a distance` };
  }
  if (row.distance > 0) {
    return { durationType: 'DISTANCE', durationValue: Math.round(row.distance * 1000),
             durationValueType: 'METER', why: `${label}: no unit in the text, stored distance used` };
  }
  return { durationType: 'OPEN', durationValue: null, durationValueType: null,
           why: `${label}: neither a time nor a distance is stored` };
}

function hrZone(rpe: number | undefined): Pick<Step, 'targetType' | 'targetValue'> {
  return rpe == null
    ? { targetType: 'OPEN', targetValue: null }
    : { targetType: 'HEART_RATE', targetValue: rpeToHrZone(rpe) };
}

/**
 * A rest day stored as a run row with no distance. sessionType 'run' makes the
 * mapper skip the classifier and treat it as an easy run, so mapRunEasy's
 * 30-minute default currently sends these to the watch as half-hour runs.
 */
const REST_TITLE = /^(rest|rest or cross[- ]?train|what's next|active recovery \+ strength|full rest)/i;

const IS_WARMUP = /warm[- ]?up/i;
const IS_COOLDOWN = /cool[- ]?down/i;
const INTERVAL_TITLE =
  /interval|hill|threshold|tempo|vo2|repetition|treadmill incline|race[- ]pace|sharpening|race-sim/i;

function rebuild(p: any, d: any, s: any): RebuiltSession {
  const runs: any[] = d.runs;
  const warm = runs.find((r) => IS_WARMUP.test(r.description || ''));
  const cool = runs.find((r) => IS_COOLDOWN.test(r.description || ''));
  const recoveryRow = runs.find((r) => r.type === 'recovery' && /between reps|recovery between/i.test(r.description || ''));
  const work = runs.filter((r) => r !== warm && r !== cool && r !== recoveryRow);

  const repped = runs.some((r) => (r.noIntervals ?? 0) > 1);
  const noWork = runs.every((r) => !(r.distance > 0) && !statedDuration(r.description || ''));
  const kind: RebuiltSession['kind'] =
    REST_TITLE.test(d.title.trim()) && noWork ? 'rest'
      : repped || INTERVAL_TITLE.test(d.title) ? 'interval'
      : 'steady';

  const steps: Array<{ step: Step; repeatOf?: number }> = [];
  const notes: string[] = [];

  if (kind === 'rest') {
    notes.push('Rest day: no distance and no duration is stored, so nothing should be pushed. '
             + 'Today the run sessionType bypasses the classifier and mapRunEasy sends a 30 min run.');
  }

  // ── Warm-up ───────────────────────────────────────────────────────────────
  if (kind === 'interval') {
    if (warm) {
      const u = unitFor(warm, 'warm-up');
      steps.push({ step: { intensity: 'WARMUP', description: warm.description,
        ...u, ...hrZone(undefined), origin: u.why } });
    } else {
      steps.push({ step: { intensity: 'WARMUP', description: 'Easy jog warm-up',
        durationType: 'TIME', durationValue: 900, durationValueType: null,
        targetType: 'OPEN', targetValue: null,
        origin: 'warm-up: none stored, 15 min added' } });
      notes.push('No warm-up stored — a 15 min time-bound warm-up was added.');
    }
  }

  // ── Work ──────────────────────────────────────────────────────────────────
  for (const row of (kind === 'rest' ? [] : work)) {
    const u = unitFor(row, 'work');
    const reps = row.noIntervals ?? 0;

    if (reps > 1) {
      const stated = statedRecovery(row.description || '');
      let rec: { type: 'TIME' | 'DISTANCE'; value: number };
      let recWhy: string;

      if (stated) {
        rec = stated;
        recWhy = 'recovery: stated in the work row';
      } else if (recoveryRow) {
        // A dedicated recovery row carries its own unit.
        const secs = statedDuration(recoveryRow.description || '');
        rec = secs
          ? { type: 'TIME', value: secs }
          : { type: 'DISTANCE', value: Math.round((recoveryRow.distance || 0.4) * 1000) };
        recWhy = 'recovery: taken from the stored recovery row';
      } else {
        // No recovery anywhere. Longer reps get 2 min, shorter ones 90 s.
        const longRep = (u.durationType === 'DISTANCE' && (u.durationValue ?? 0) >= 1000)
                     || (u.durationType === 'TIME' && (u.durationValue ?? 0) >= 180);
        rec = { type: 'TIME', value: longRep ? 120 : 90 };
        recWhy = 'recovery: none stated, defaulted';
      }

      steps.push({ repeatOf: reps, step: { intensity: 'INTERVAL', description: row.description,
        ...u, ...hrZone(row.effortLevel), origin: u.why } });
      steps.push({ repeatOf: reps, step: { intensity: 'RECOVERY',
        description: stated ? 'Recovery as prescribed' : 'Recovery jog',
        durationType: rec.type, durationValue: rec.value,
        durationValueType: rec.type === 'DISTANCE' ? 'METER' : null,
        targetType: 'OPEN', targetValue: null, origin: recWhy } });

      if (!stated && !recoveryRow) {
        notes.push(`Rep recovery was open — defaulted to ${rec.value}${rec.type === 'TIME' ? 's' : 'm'}.`);
      }
    } else {
      steps.push({ step: { intensity: kind === 'interval' ? 'ACTIVE' : 'ACTIVE',
        description: row.description, ...u, ...hrZone(row.effortLevel), origin: u.why } });
    }
  }

  // ── Cool-down ─────────────────────────────────────────────────────────────
  if (kind === 'interval') {
    if (cool) {
      const u = unitFor(cool, 'cool-down');
      steps.push({ step: { intensity: 'COOLDOWN', description: cool.description,
        ...u, ...hrZone(undefined), origin: u.why } });
    } else {
      steps.push({ step: { intensity: 'COOLDOWN', description: 'Cool down — press lap when done',
        durationType: 'OPEN', durationValue: null, durationValueType: null,
        targetType: 'OPEN', targetValue: null,
        origin: 'cool-down: none stored, lap-press added' } });
      notes.push('No cool-down stored — an open lap-press cool-down was added.');
    }
  }

  const current = (s.workout?.segments ?? []).flatMap((seg: any) => seg.steps ?? []);
  const countCurrent = (ss: any[]): number =>
    ss.reduce((n, st) => n + (st.type === 'WorkoutRepeatStep' ? countCurrent(st.steps ?? []) : 1), 0);

  return {
    programId: p.id, programName: p.name, entryIdx: d.entryIdx, day: d.day,
    title: d.title, kind, currentSteps: countCurrent(current), steps, notes,
  };
}

function main() {
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
  const out: RebuiltSession[] = [];

  for (const p of data.programs) {
    if (!['running', 'hybrid'].includes(p.programType)) continue;
    for (const d of p.days) {
      if (!d.runs?.length) continue;
      for (const s of d.sessions) {
        if (s.sessionType !== 'run') continue;
        out.push(rebuild(p, d, s));
      }
    }
  }

  fs.writeFileSync(process.argv[3], JSON.stringify({ sessions: out }, null, 2));
  const steps = out.reduce((n, s) => n + s.steps.length, 0);
  const iv = out.filter((s) => s.kind === 'interval').length;
  console.error(`Wrote ${process.argv[3]}: ${out.length} run sessions rebuilt `
              + `(${iv} interval-type, ${out.length - iv} steady), ${steps} steps.`);
}

main();
