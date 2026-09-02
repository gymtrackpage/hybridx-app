// scripts/propose-garmin-fixes.ts
//
// First-pass proposal of what each Garmin step *should* carry, derived from the
// stored program data rather than from the mapper's current output. Produces a
// review artefact only — nothing here writes to Firestore or changes the sync.
//
// The three things it recomputes:
//   duration  — a robust parse of the session's own text, falling back to the
//               stored distance. The live parseDurationMinutes() takes the first
//               "N min" it sees, so "1 hr 45 min" becomes 45 minutes.
//   target    — every step currently ships targetType OPEN because no program
//               sets targetPace. effortLevel (RPE) is stored on every run and
//               maps to an HR zone the mapper already knows how to compute.
//               Training API V2 §3.2.1: a zone target is expressed as
//               targetValue 1-5 with low/high null, so buildStep() cannot
//               currently express one — it hardcodes targetValue to null.
//   exercise  — Garmin exerciseCategory/Name via the repo's own lookup table.
//
// Usage:
//   npx tsx scripts/propose-garmin-fixes.ts plans.json proposals.json

import * as fs from 'fs';
import { lookupGarminExercise } from '@/lib/garmin/program-enricher';
import { rpeToHrZone } from '@/lib/garmin/workout-mapper';

// ── Duration parsing ─────────────────────────────────────────────────────────

/**
 * Seconds of planned work described in free text.
 *
 * Ordered longest-form first so "1 hr 45 min" is read whole rather than as its
 * trailing "45 min". Durations introduced by "every"/"each" are fuelling and
 * pacing notes ("fuel every 30-40 min"), not the length of the session.
 */
export function parseDurationSeconds(text: string): { secs: number; matched: string } | null {
  if (!text) return null;

  const hm = text.match(/(\d+)\s*(?:hrs?|hours?|h)\b\s*(?:and\s+)?(\d+)\s*(?:mins?|minutes?)\b/i);
  if (hm) {
    return { secs: +hm[1] * 3600 + +hm[2] * 60, matched: hm[0] };
  }

  const h = text.match(/(\d+(?:\.\d+)?)\s*(?:hrs?|hours?)\b/i);
  if (h) return { secs: Math.round(parseFloat(h[1]) * 3600), matched: h[0] };

  const clock = text.match(/\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b/);
  if (clock) {
    const secs = clock[3]
      ? +clock[1] * 3600 + +clock[2] * 60 + +clock[3]
      : +clock[1] * 60 + +clock[2];
    return { secs, matched: clock[0] };
  }

  // A range ("40-50 min") takes the midpoint; a lone figure takes itself.
  const m = text.match(/(?<!every\s)(?<!each\s)\b(\d+)\s*(?:[-–]\s*(\d+)\s*)?(?:mins?|minutes?)\b/i);
  if (m) {
    const secs = m[2] ? Math.round(((+m[1] + +m[2]) / 2) * 60) : +m[1] * 60;
    return { secs, matched: m[0] };
  }
  return null;
}

/** Sets and reps, in the shapes the plans actually use. */
export function parseSetsRepsWide(text: string):
  { sets: number; reps: number; unit: 'REPS' | 'TIME'; perSide: boolean; matched: string } | null {
  if (!text) return null;
  const perSide = /per side|each side|per leg|each leg|\bea\b/i.test(text);

  // "3 sets x 25 seconds", "4x30s"
  const timed = text.match(/(\d+)\s*(?:sets?)?\s*[x×]\s*(\d+)\s*(?:seconds?|secs?|s)\b/i);
  if (timed) {
    return { sets: +timed[1], reps: +timed[2], unit: 'TIME', perSide, matched: timed[0] };
  }

  // "3 sets x 20 reps", "3 x 20", "4x4" — the Unicode multiplication sign
  // included, which the live parseSetsReps() misses.
  const x = text.match(/(\d+)\s*(?:sets?)?\s*[x×]\s*(\d+)(?!\s*(?:m\b|km\b|sec|s\b))/i);
  if (x) return { sets: +x[1], reps: +x[2], unit: 'REPS', perSide, matched: x[0] };

  const of = text.match(/(\d+)\s*sets?\s+of\s+(\d+)/i);
  if (of) return { sets: +of[1], reps: +of[2], unit: 'REPS', perSide, matched: of[0] };

  return null;
}

// ── Proposal shapes ──────────────────────────────────────────────────────────

interface StepProposal {
  programId: string;
  entryIdx: number;
  day: number;
  sessionIdx: number;
  stepOrder: number;
  changed: boolean;
  /** True when the proposed duration differs from what is sent today. */
  durationChanged?: boolean;
  durationType?: string;
  /** Training API V2 sets this to METER alongside a DISTANCE duration. */
  durationValueType?: string;
  durationValue?: number | null;
  human?: string;
  target?: string;
  exerciseCategory?: string;
  exerciseName?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Restructure {
  programId: string;
  entryIdx: number;
  programName: string;
  day: number;
  title: string;
  current: string;
  proposed: string;
  reason: string;
}

function hhmmss(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
           : `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * A zone-based HR target in the shape the Training API defines: targetValue
 * carries the zone (1-5) and the low/high range fields stay null, which are
 * only for a custom bpm range.
 */
function hrTarget(rpe: number | undefined): string | undefined {
  if (rpe == null) return undefined;
  return `targetType HEART_RATE, targetValue ${rpeToHrZone(rpe)} (zone, from RPE ${rpe})`;
}

function flatten(steps: any[], inRepeat = false): Array<{ st: any; inRepeat: boolean }> {
  const out: Array<{ st: any; inRepeat: boolean }> = [];
  for (const st of steps) {
    if (st.type === 'WorkoutRepeatStep') out.push(...flatten(st.steps ?? [], true));
    else out.push({ st, inRepeat });
  }
  return out;
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
  const proposals: StepProposal[] = [];
  const restructures: Restructure[] = [];

  for (const p of data.programs) {
    if (!['running', 'hybrid'].includes(p.programType)) continue;

    for (const d of p.days) {
      for (const s of d.sessions) {
        const w = s.workout;
        if (!w) continue;
        const steps = flatten(w.segments.flatMap((seg: any) => seg.steps ?? []));

        // ── Runs ───────────────────────────────────────────────────────────
        if (w.sport === 'RUNNING' && d.runs.length) {
          const workRuns = d.runs.filter((r: any) => r.type !== 'recovery');
          const structured = d.runs.some((r: any) => (r.noIntervals ?? 0) > 1);

          // A day stored as warm-up / reps / recovery / cool-down rows carries
          // its own structure; rebuilding from the rows beats regexing the
          // concatenated prose.
          if (structured && steps.length <= 1) {
            const parts = d.runs.map((r: any) => {
              const dur = parseDurationSeconds(r.description || '');
              const per = dur ? hhmmss(dur.secs) : `${r.distance}km`;
              return (r.noIntervals ?? 0) > 1
                ? `${r.noIntervals}x ${per} (${r.type}, RPE ${r.effortLevel})`
                : `${per} ${r.type}`;
            });
            restructures.push({
              programId: p.id, entryIdx: d.entryIdx, programName: p.name, day: d.day, title: d.title,
              current: `1 step, ${w.estimatedDurationInSecs ?? '—'}s total`,
              proposed: parts.join(' → '),
              reason: 'Day is stored as separate warm-up / interval / recovery / cool-down run rows, '
                    + 'but classifyWorkout() did not read it as intervals, so it maps to one flat step. '
                    + 'Build the steps from the stored rows instead of re-parsing the joined text.',
            });
          }

          if (steps.length === 1) {
            const st = steps[0].st;
            const run = workRuns[0] ?? d.runs[0];
            const text = d.runs.map((r: any) => r.description || '').join(' ');
            const parsed = parseDurationSeconds(text);
            const km = d.runs.reduce((n: number, r: any) => n + (r.distance || 0), 0);

            let durationType: string, durationValue: number | null, human: string, reason: string;
            let confidence: StepProposal['confidence'] = 'high';

            if (parsed) {
              durationType = 'TIME';
              durationValue = parsed.secs;
              human = hhmmss(parsed.secs);
              reason = `Session text says "${parsed.matched.trim()}".`;
              if (st.durationType === 'TIME' && st.durationValue === parsed.secs) reason = '';
            } else if (km > 0) {
              durationType = 'DISTANCE';
              durationValue = Math.round(km * 1000);
              human = `${km} km`;
              reason = `No duration in the text; the stored distance is ${km}km, so this is a `
                     + 'distance-based run and should be sent as DISTANCE in metres, with '
                     + 'durationValueType METER as the spec\'s examples show.';
            } else {
              durationType = 'OPEN';
              durationValue = null;
              human = 'open';
              reason = 'No duration and no distance stored — nothing to target.';
              confidence = 'low';
            }

            const target = hrTarget(run?.effortLevel);
            const durationChanged = durationType !== st.durationType
                                 || durationValue !== st.durationValue;
            const changed = durationChanged || !!target;
            proposals.push({
              programId: p.id, entryIdx: d.entryIdx, day: d.day, sessionIdx: s.sessionIdx, stepOrder: st.stepOrder,
              changed, durationChanged, durationType, durationValue, human, target,
              ...(durationType === 'DISTANCE' ? { durationValueType: 'METER' } : {}),
              reason: [reason, target ? `RPE ${run.effortLevel} is stored on the run but no target is sent today.` : '']
                        .filter(Boolean).join(' '),
              confidence,
            });
            continue;
          }

          // Multi-step run sessions: duration already comes from the interval
          // pattern, so only the missing target is proposed.
          for (const { st } of steps) {
            const target = hrTarget(workRuns[0]?.effortLevel);
            if (!target || st.intensity === 'REST') continue;
            proposals.push({
              programId: p.id, entryIdx: d.entryIdx, day: d.day, sessionIdx: s.sessionIdx, stepOrder: st.stepOrder,
              changed: true, target,
              reason: 'Step ships targetType OPEN. RPE is stored on the run and maps to an HR zone.',
              confidence: 'medium',
            });
          }
          continue;
        }

        // ── Strength and cardio ────────────────────────────────────────────
        for (const { st, inRepeat } of steps) {
          if (st.intensity !== 'ACTIVE' && st.intensity !== 'INTERVAL') continue;

          const desc: string = st.description || '';
          const nm = desc.split(' — ')[0].split(':')[0].trim();
          const src = d.exercises.find((e: any) => (e.name || '').trim() === nm);
          if (!src) continue;

          const parsed = parseSetsRepsWide(src.details || '');
          const look = st.exerciseCategory
            ? null
            : lookupGarminExercise(src.name || '');

          // Already inside a repeat with a rep target: the structure is right.
          const structureOk = inRepeat && st.durationType !== 'OPEN';
          if (structureOk && !look) continue;

          const bits: string[] = [];
          let durationType: string | undefined;
          let durationValue: number | null | undefined;
          let human: string | undefined;

          if (!structureOk && parsed) {
            const sets = parsed.perSide ? parsed.sets * 2 : parsed.sets;
            durationType = parsed.unit;
            durationValue = parsed.reps;
            human = parsed.unit === 'REPS'
              ? `${sets} x ${parsed.reps} reps${parsed.perSide ? ' (per side, sets doubled)' : ''}`
              : `${sets} x ${hhmmss(parsed.reps)}${parsed.perSide ? ' (per side, sets doubled)' : ''}`;
            bits.push(`Details say "${parsed.matched.trim()}", which parseSetsReps() does not match, `
                    + `so the step carries no rep target. Wrap in a repeat of ${sets}.`);
          }
          if (look) {
            bits.push(`Exercise name matches the lookup table but no category is stored, `
                    + `so Garmin shows this step unnamed.`);
          }
          // "3 sets | RPE 7" states a set count and no reps at all. Nothing can
          // give the step a rep target until the plan itself says how many.
          let setsOnly: number | undefined;
          if (!structureOk && !parsed) {
            const m = (src.details || '').match(/(\d+)\s*sets?\b/i);
            if (m && !/\d+\s*reps?\b/i.test(src.details || '')) {
              setsOnly = +m[1];
              bits.push(`Details say "${m[0]}" but never give a rep count, so the step is one `
                      + `open-ended block. Wrapping it in a repeat of ${setsOnly} would at least `
                      + `restore the set structure; a rep target needs the plan data to specify reps.`);
              human = `${setsOnly} x open (reps not stated in the plan)`;
            }
          }

          if (!bits.length) continue;

          proposals.push({
            programId: p.id, entryIdx: d.entryIdx, day: d.day, sessionIdx: s.sessionIdx, stepOrder: st.stepOrder,
            changed: true, durationType, durationValue, human,
            exerciseCategory: look?.exerciseCategory,
            exerciseName: look?.exerciseName,
            reason: bits.join(' '),
            confidence: parsed || look ? 'high' : 'low',
          });
        }
      }
    }
  }

  fs.writeFileSync(process.argv[3], JSON.stringify({ proposals, restructures }, null, 2));
  console.error(`Wrote ${process.argv[3]}: ${proposals.length} step proposals, `
              + `${restructures.length} session restructures.`);
}

main();
