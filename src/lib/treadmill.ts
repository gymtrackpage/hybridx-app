// src/lib/treadmill.ts
//
// Treadmill activity "file fixer" — core logic.
//
// Ported from the HybridX web Treadmill TCX Generator (src/lib/tcx.ts in the
// web repo) and adapted for the app:
//   - sensor data comes from the Strava streams API (time/heartrate/cadence
//     arrays) instead of an uploaded GPX/TCX file, so it runs on the server
//     with no DOM APIs;
//   - units are km-only to match PlannedRun (distance in km, pace in sec/km);
//   - prescribed workouts (PlannedRun[]) can be prefilled into an editable
//     segment list.
//
// Pure functions only — shared by the fix-treadmill API route (TCX build)
// and the fix-treadmill dialog (editing, validation, totals).

import type { PlannedRun, PaceZone, WorkoutSession } from '@/models/types';
import { hasRuns } from '@/lib/type-guards';

/**
 * Whether the treadmill file fixer can be offered for a session: it must have
 * a linked Strava activity to rebuild, and be a run (running program session
 * or a workout containing planned runs) — never a pure strength session.
 */
export function canFixTreadmill(session: Pick<WorkoutSession, 'stravaId' | 'programType' | 'workoutDetails'>): boolean {
  if (!session.stravaId) return false;
  return session.programType === 'running' || hasRuns(session.workoutDetails);
}

/* ── segment model ──────────────────────────────────────────────────────── */

/** Editable segment as shown in the fix dialog. All values are strings so the
 *  user can type freely; computeSegment() validates and converts. */
export interface TreadmillSegmentDraft {
  id: number;
  name: string;
  mode: 'time' | 'distance';
  /** mm:ss (or decimal minutes) when mode=time; km when mode=distance */
  value: string;
  /** pace as mm:ss per km */
  pace: string;
  /** percent grade */
  incline: string;
}

/** Fully-resolved segment used for simulation and TCX generation. */
export interface FlatSegment {
  name: string;
  timeSec: number;
  distanceM: number;
  speedMps: number;
  incline: number;
}

/* ── parsing & formatting ───────────────────────────────────────────────── */

/** "5:30" -> 330, "5" -> 300, "5.5" -> 330 (decimal minutes). Null when invalid. */
export function parseMinSec(str: string): number | null {
  const s = String(str).trim();
  if (s === '') return null;
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length !== 2) return null;
    const m = parseFloat(parts[0]);
    const sec = parseFloat(parts[1]);
    if (isNaN(m) || isNaN(sec) || sec >= 60 || m < 0 || sec < 0) return null;
    return m * 60 + sec;
  }
  const v = parseFloat(s);
  if (isNaN(v) || v < 0) return null;
  return v * 60;
}

export function parseDurationSec(str: string): number | null {
  const v = parseMinSec(str);
  return v !== null && v > 0 ? v : null;
}

export function parsePaceSecPerKm(str: string): number | null {
  const v = parseMinSec(str);
  return v !== null && v > 0 ? v : null;
}

export function parseDistanceKmToMeters(str: string): number | null {
  const v = parseFloat(str);
  if (isNaN(v) || v <= 0) return null;
  return v * 1000;
}

export function parseIncline(str: string): number | null {
  const v = parseFloat(String(str).trim() === '' ? '0' : str);
  if (isNaN(v)) return null;
  return Math.max(-10, Math.min(40, v));
}

export function secPerKmToPaceStr(secPerKm: number): string {
  let m = Math.floor(secPerKm / 60);
  let s = Math.round(secPerKm % 60);
  if (s === 60) {
    m++;
    s = 0;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function fmtHMS(totalSec: number): string {
  const t = Math.round(totalSec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Total minutes:seconds (e.g. 75:30) — round-trips through parseMinSec even past 1h. */
export function fmtMinSecTotal(totalSec: number): string {
  const t = Math.round(totalSec);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function xmlEscape(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── segment computation & totals ───────────────────────────────────────── */

export function computeSegment(seg: TreadmillSegmentDraft): FlatSegment | null {
  const paceSecPerKm = parsePaceSecPerKm(seg.pace);
  const incline = parseIncline(seg.incline);
  if (paceSecPerKm === null || incline === null) return null;
  const speedMps = 1000 / paceSecPerKm;
  let timeSec: number;
  let distanceM: number;
  if (seg.mode === 'time') {
    const t = parseDurationSec(seg.value);
    if (t === null) return null;
    timeSec = t;
    distanceM = speedMps * t;
  } else {
    const d = parseDistanceKmToMeters(seg.value);
    if (d === null) return null;
    distanceM = d;
    timeSec = d / speedMps;
  }
  return { name: seg.name || 'Segment', timeSec, distanceM, speedMps, incline };
}

export interface FlattenResult {
  segments: FlatSegment[];
  hasErrors: boolean;
}

export function flattenDrafts(drafts: TreadmillSegmentDraft[]): FlattenResult {
  const out: FlatSegment[] = [];
  let hasErrors = false;
  for (const d of drafts) {
    const c = computeSegment(d);
    if (c) out.push(c);
    else hasErrors = true;
  }
  return { segments: out, hasErrors };
}

export interface Totals {
  timeSec: number;
  distanceM: number;
  climbM: number;
}

export function computeTotals(segments: FlatSegment[]): Totals {
  let timeSec = 0;
  let distanceM = 0;
  let climbM = 0;
  for (const s of segments) {
    timeSec += s.timeSec;
    distanceM += s.distanceM;
    const rise = s.distanceM * (s.incline / 100);
    if (rise > 0) climbM += rise;
  }
  return { timeSec, distanceM, climbM };
}

/**
 * Estimated energy cost from the ACSM metabolic equations
 * (walking below 8 km/h, running at or above). Returns kcal.
 */
export function estimateCalories(segments: FlatSegment[], weightKg: number): number {
  if (!(weightKg > 0)) return 0;
  let kcal = 0;
  for (const s of segments) {
    const vMPerMin = s.speedMps * 60;
    const grade = Math.max(0, s.incline / 100);
    const running = s.speedMps >= 8000 / 3600;
    const vo2 = running
      ? 3.5 + 0.2 * vMPerMin + 0.9 * vMPerMin * grade
      : 3.5 + 0.1 * vMPerMin + 1.8 * vMPerMin * grade;
    kcal += ((vo2 * weightKg) / 200) * (s.timeSec / 60);
  }
  return Math.round(kcal);
}

/* ── sensor stream (from Strava streams API) ────────────────────────────── */

export interface SensorPoint {
  /** seconds since activity start */
  t: number;
  hr: number | null;
  cad: number | null;
}

/**
 * Convert Strava stream arrays (GET /activities/{id}/streams with
 * keys=time,heartrate,cadence & key_by_type=true) into a sensor point list.
 * Strava run cadence is single-leg (steps/min ÷ 2), which is also what the
 * TCX <RunCadence> field expects, so no conversion is needed.
 */
export function stravaStreamsToSensorPoints(streams: {
  time?: { data: number[] };
  heartrate?: { data: (number | null)[] };
  cadence?: { data: (number | null)[] };
}): SensorPoint[] {
  const time = streams.time?.data;
  if (!time || !time.length) return [];
  const hr = streams.heartrate?.data;
  const cad = streams.cadence?.data;
  const points: SensorPoint[] = [];
  for (let i = 0; i < time.length; i++) {
    const t = time[i];
    if (typeof t !== 'number' || isNaN(t)) continue;
    points.push({
      t,
      hr: typeof hr?.[i] === 'number' ? (hr![i] as number) : null,
      cad: typeof cad?.[i] === 'number' ? (cad![i] as number) : null,
    });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

/**
 * Binary-search interpolating sampler over the sensor stream.
 * O(log n) per lookup instead of the naive O(n) scan.
 */
export function createSensorSampler(points: SensorPoint[]) {
  return function sample(tSec: number, key: 'hr' | 'cad'): number | null {
    if (!points.length) return null;
    if (tSec <= points[0].t) return points[0][key];
    const last = points[points.length - 1];
    if (tSec >= last.t) return last[key];
    let lo = 0;
    let hi = points.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (points[mid].t <= tSec) lo = mid;
      else hi = mid;
    }
    const a = points[lo];
    const b = points[hi];
    const av = a[key];
    const bv = b[key];
    if (av === null) return bv;
    if (bv === null) return av;
    const frac = b.t - a.t === 0 ? 0 : (tSec - a.t) / (b.t - a.t);
    return av + (bv - av) * frac;
  };
}

/* ── activity simulation ────────────────────────────────────────────────── */

/** stretch: map the sensor timeline onto the prescribed workout duration;
 *  realtime: 1:1 from the start (holds the last value past the recording). */
export type SensorAlign = 'stretch' | 'realtime';

export interface ActivityOptions {
  name: string;
  startTime: Date;
  segments: FlatSegment[];
  /** seconds between trackpoints */
  resolutionSec?: number;
  startElevationM?: number;
  sensorPoints?: SensorPoint[] | null;
  sensorAlign?: SensorAlign;
  /** body weight for the calorie estimate; omit to write 0 calories */
  weightKg?: number | null;
}

export interface ActivityPoint {
  elapsedSec: number;
  cumDistM: number;
  elevationM: number;
  speedMps: number;
  hr: number | null;
  cad: number | null;
}

export interface ActivityLap {
  segment: FlatSegment;
  startElapsedSec: number;
  points: ActivityPoint[];
  calories: number;
  avgHr: number | null;
  maxHr: number | null;
}

/**
 * Run the workout simulation once: one lap per segment, with elapsed time,
 * cumulative distance and elevation carried across the whole activity and the
 * real sensor data re-timed onto the prescribed structure.
 */
export function buildActivity(opts: ActivityOptions): ActivityLap[] {
  const {
    segments,
    resolutionSec = 3,
    startElevationM = 0,
    sensorPoints,
    sensorAlign = 'stretch',
    weightKg,
  } = opts;

  const totals = computeTotals(segments);
  const sensorDuration = sensorPoints?.length ? sensorPoints[sensorPoints.length - 1].t : 0;
  const sample = sensorPoints?.length ? createSensorSampler(sensorPoints) : null;

  const sensorAt = (elapsedSec: number, key: 'hr' | 'cad'): number | null => {
    if (!sample) return null;
    if (sensorAlign === 'realtime') return sample(elapsedSec, key);
    const frac = totals.timeSec > 0 ? elapsedSec / totals.timeSec : 0;
    return sample(frac * sensorDuration, key);
  };

  let elapsed = 0;
  let cumDist = 0;
  let elevation = startElevationM;

  return segments.map((seg) => {
    const startElapsedSec = elapsed;
    const points: ActivityPoint[] = [];
    const hrs: number[] = [];
    let t = 0;
    while (t < seg.timeSec - 1e-9) {
      const dt = Math.min(resolutionSec, seg.timeSec - t);
      const dDist = seg.speedMps * dt;
      cumDist += dDist;
      elevation += dDist * (seg.incline / 100);
      elapsed += dt;
      t += dt;

      const hr = sensorAt(elapsed, 'hr');
      const cad = sensorAt(elapsed, 'cad');
      if (hr !== null) hrs.push(hr);

      points.push({
        elapsedSec: elapsed,
        cumDistM: cumDist,
        elevationM: elevation,
        speedMps: seg.speedMps,
        hr,
        cad,
      });
    }

    return {
      segment: seg,
      startElapsedSec,
      points,
      calories: weightKg && weightKg > 0 ? estimateCalories([seg], weightKg) : 0,
      avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
      maxHr: hrs.length ? Math.round(Math.max(...hrs)) : null,
    };
  });
}

/* ── TCX generation ─────────────────────────────────────────────────────── */

export function generateTcx(opts: ActivityOptions): string {
  const { name, startTime } = opts;
  const laps = buildActivity(opts);

  const isoAt = (elapsedSec: number) =>
    new Date(startTime.getTime() + elapsedSec * 1000).toISOString().split('.')[0] + 'Z';

  const lapXml = laps
    .map((lap) => {
      const seg = lap.segment;
      const trkpts = lap.points.map((p) => {
        const tpx =
          `<Speed>${p.speedMps.toFixed(3)}</Speed>` +
          (p.cad !== null ? `<RunCadence>${Math.round(p.cad)}</RunCadence>` : '');
        return (
          `<Trackpoint><Time>${isoAt(p.elapsedSec)}</Time>` +
          `<AltitudeMeters>${p.elevationM.toFixed(1)}</AltitudeMeters>` +
          `<DistanceMeters>${p.cumDistM.toFixed(2)}</DistanceMeters>` +
          (p.hr !== null ? `<HeartRateBpm><Value>${Math.round(p.hr)}</Value></HeartRateBpm>` : '') +
          `<Extensions><TPX xmlns="http://www.garmin.com/xmlschemas/ActivityExtension/v2">${tpx}</TPX></Extensions>` +
          `</Trackpoint>`
        );
      });

      const avgHrXml =
        lap.avgHr !== null ? `<AverageHeartRateBpm><Value>${lap.avgHr}</Value></AverageHeartRateBpm>` : '';
      const maxHrXml =
        lap.maxHr !== null ? `<MaximumHeartRateBpm><Value>${lap.maxHr}</Value></MaximumHeartRateBpm>` : '';

      return (
        `<Lap StartTime="${isoAt(lap.startElapsedSec)}">` +
        `<TotalTimeSeconds>${seg.timeSec.toFixed(1)}</TotalTimeSeconds>` +
        `<DistanceMeters>${seg.distanceM.toFixed(2)}</DistanceMeters>` +
        `<MaximumSpeed>${seg.speedMps.toFixed(3)}</MaximumSpeed>` +
        `<Calories>${lap.calories}</Calories>` +
        avgHrXml +
        maxHrXml +
        `<Intensity>Active</Intensity>` +
        `<TriggerMethod>Manual</TriggerMethod>` +
        `<Track>\n        ${trkpts.join('\n        ')}\n      </Track>` +
        `<Notes>${xmlEscape(seg.name)}</Notes>` +
        `</Lap>`
      );
    })
    .join('\n      ');

  const safeName = xmlEscape(name || 'Treadmill Session');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd">\n' +
    '  <Activities>\n' +
    '    <Activity Sport="Running">\n' +
    `      <Id>${isoAt(0)}</Id>\n` +
    `      ${lapXml}\n` +
    `      <Notes>${safeName}</Notes>\n` +
    '    </Activity>\n' +
    '  </Activities>\n' +
    '</TrainingCenterDatabase>'
  );
}

/* ── prefill from the prescribed workout ────────────────────────────────── */

/** Fallback paces (sec/km) per zone when a run has no explicit targetPace. */
const ZONE_DEFAULT_PACE: Record<PaceZone, number> = {
  recovery: 450, // 7:30
  easy: 390, // 6:30
  marathon: 345, // 5:45
  threshold: 315, // 5:15
  interval: 285, // 4:45
  repetition: 260, // 4:20
};

/** Rest pace between interval reps (brisk walk). */
const REST_PACE_SEC_PER_KM = 600; // 10:00/km

let draftIdCounter = 1;
export function nextDraftId(): number {
  return draftIdCounter++;
}

function makeDraft(partial: Omit<TreadmillSegmentDraft, 'id'>): TreadmillSegmentDraft {
  return { id: nextDraftId(), ...partial };
}

/**
 * Turn the prescribed runs of a workout into an editable segment list.
 * Interval runs are expanded into work reps with a default 90s walking
 * recovery between them; everything is editable afterwards, so these are
 * sensible starting points rather than exact prescriptions.
 */
export function plannedRunsToDrafts(runs: PlannedRun[]): TreadmillSegmentDraft[] {
  const drafts: TreadmillSegmentDraft[] = [];
  for (const run of runs) {
    const paceSec = run.targetPace && run.targetPace > 0 ? run.targetPace : ZONE_DEFAULT_PACE[run.paceZone] ?? 390;
    const pace = secPerKmToPaceStr(paceSec);
    const reps = run.type === 'intervals' && run.noIntervals && run.noIntervals > 1 ? run.noIntervals : 1;

    if (reps > 1) {
      const repKm = run.distance > 0 ? run.distance / reps : 0.4;
      for (let i = 1; i <= reps; i++) {
        drafts.push(
          makeDraft({
            name: `Interval ${i}/${reps}`,
            mode: 'distance',
            value: String(Math.round(repKm * 100) / 100),
            pace,
            incline: '0',
          }),
        );
        if (i < reps) {
          drafts.push(
            makeDraft({
              name: `Recovery ${i}/${reps - 1}`,
              mode: 'time',
              value: '1:30',
              pace: secPerKmToPaceStr(REST_PACE_SEC_PER_KM),
              incline: '0',
            }),
          );
        }
      }
    } else {
      drafts.push(
        makeDraft({
          name: runTypeLabel(run.type),
          mode: 'distance',
          value: String(run.distance || 5),
          pace,
          incline: '0',
        }),
      );
    }
  }
  return drafts;
}

function runTypeLabel(type: PlannedRun['type']): string {
  switch (type) {
    case 'easy':
      return 'Easy Run';
    case 'tempo':
      return 'Tempo Run';
    case 'intervals':
      return 'Intervals';
    case 'long':
      return 'Long Run';
    case 'recovery':
      return 'Recovery Run';
    default:
      return 'Run';
  }
}

/* ── prefill from AI-parsed workout notes ───────────────────────────────── */

/** Segment shape returned by the parse-treadmill-workout AI flow. */
export interface AiParsedSegment {
  name?: unknown;
  mode?: unknown;
  value?: unknown;
  pace?: unknown;
  incline?: unknown;
}

const MAX_AI_SEGMENTS = 60;

/**
 * Convert AI-parsed segments into editable drafts, defensively: strings are
 * trimmed and length-capped, the segment count is capped, and obviously
 * useless rows (no parseable duration/distance AND no parseable pace) are
 * dropped. Fields the AI left empty stay empty so the per-field validation
 * highlights them for the user to fill in. Returns [] when nothing usable
 * survives, so callers can fall back to the next prefill source.
 */
export function aiSegmentsToDrafts(raw: unknown): TreadmillSegmentDraft[] {
  if (!Array.isArray(raw)) return [];
  const drafts: TreadmillSegmentDraft[] = [];
  for (const seg of raw.slice(0, MAX_AI_SEGMENTS) as AiParsedSegment[]) {
    if (!seg || typeof seg !== 'object') continue;
    const mode: 'time' | 'distance' = seg.mode === 'distance' ? 'distance' : 'time';
    const value = typeof seg.value === 'string' ? seg.value.trim().slice(0, 20) : '';
    const pace = typeof seg.pace === 'string' ? seg.pace.trim().slice(0, 20) : '';
    const incline = typeof seg.incline === 'string' ? seg.incline.trim().slice(0, 20) : '';
    const name =
      typeof seg.name === 'string' && seg.name.trim()
        ? seg.name.trim().slice(0, 120)
        : `Segment ${drafts.length + 1}`;

    const valueOk =
      mode === 'time' ? parseDurationSec(value) !== null : parseDistanceKmToMeters(value) !== null;
    const paceOk = parsePaceSecPerKm(pace) !== null;
    if (!valueOk && !paceOk) continue;

    drafts.push(
      makeDraft({
        name,
        mode,
        value: valueOk ? value : '',
        pace: paceOk ? pace : '',
        // Bad incline strings just become flat — incline is the least
        // critical field and '0' keeps the row immediately usable.
        incline: parseIncline(incline) !== null && incline !== '' ? incline : '0',
      }),
    );
  }
  return drafts;
}

/**
 * Compact text description of the prescribed runs for the AI parser prompt.
 * Includes the human description plus the structured fields.
 */
export function plannedRunsToText(runs: PlannedRun[]): string {
  return runs
    .map((run, i) => {
      const parts: string[] = [`Run ${i + 1}: ${run.type}`];
      if (run.distance > 0) parts.push(`${run.distance} km`);
      if (run.noIntervals && run.noIntervals > 1) parts.push(`${run.noIntervals} intervals`);
      if (run.targetPace && run.targetPace > 0)
        parts.push(`target pace ${secPerKmToPaceStr(run.targetPace)}/km`);
      parts.push(`zone ${run.paceZone}`);
      if (run.description) parts.push(`"${run.description}"`);
      return parts.join(', ');
    })
    .join('\n');
}

/** Single-segment fallback when there is no prescribed structure: match the
 *  actual activity's moving time and distance. */
export function activityToDrafts(movingTimeSec: number, distanceM: number): TreadmillSegmentDraft[] {
  const timeSec = movingTimeSec > 0 ? movingTimeSec : 1800;
  const paceSecPerKm = distanceM > 0 ? timeSec / (distanceM / 1000) : 360;
  return [
    makeDraft({
      name: 'Treadmill Run',
      mode: 'time',
      value: fmtMinSecTotal(timeSec),
      pace: secPerKmToPaceStr(Math.max(120, Math.min(1200, paceSecPerKm))),
      incline: '0',
    }),
  ];
}
