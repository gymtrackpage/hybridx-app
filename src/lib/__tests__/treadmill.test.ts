import { describe, it, expect } from 'vitest';
import {
  parseMinSec,
  parsePaceSecPerKm,
  parseIncline,
  secPerKmToPaceStr,
  fmtMinSecTotal,
  computeSegment,
  flattenDrafts,
  computeTotals,
  stravaStreamsToSensorPoints,
  createSensorSampler,
  buildActivity,
  generateTcx,
  plannedRunsToDrafts,
  activityToDrafts,
  type TreadmillSegmentDraft,
} from '@/lib/treadmill';
import type { PlannedRun } from '@/models/types';

let id = 0;
const draft = (partial: Partial<TreadmillSegmentDraft>): TreadmillSegmentDraft => ({
  id: ++id,
  name: 'Seg',
  mode: 'time',
  value: '10:00',
  pace: '5:00',
  incline: '0',
  ...partial,
});

describe('parsing', () => {
  it('parses mm:ss and decimal minutes', () => {
    expect(parseMinSec('5:30')).toBe(330);
    expect(parseMinSec('5')).toBe(300);
    expect(parseMinSec('5.5')).toBe(330);
    expect(parseMinSec('75:30')).toBe(4530);
    expect(parseMinSec('5:60')).toBeNull();
    expect(parseMinSec('abc')).toBeNull();
    expect(parseMinSec('')).toBeNull();
  });

  it('round-trips durations past one hour through fmtMinSecTotal', () => {
    expect(fmtMinSecTotal(4530)).toBe('75:30');
    expect(parseMinSec(fmtMinSecTotal(4530))).toBe(4530);
  });

  it('parses pace and incline with clamping', () => {
    expect(parsePaceSecPerKm('4:45')).toBe(285);
    expect(parseIncline('2.5')).toBe(2.5);
    expect(parseIncline('99')).toBe(40);
    expect(parseIncline('-99')).toBe(-10);
    expect(parseIncline('')).toBe(0);
  });

  it('formats sec/km paces', () => {
    expect(secPerKmToPaceStr(330)).toBe('5:30');
    expect(secPerKmToPaceStr(299.6)).toBe('5:00');
  });
});

describe('segment computation', () => {
  it('computes a time-mode segment', () => {
    const c = computeSegment(draft({ mode: 'time', value: '10:00', pace: '5:00' }))!;
    expect(c.timeSec).toBe(600);
    expect(c.distanceM).toBeCloseTo(2000, 3);
    expect(c.speedMps).toBeCloseTo(1000 / 300, 6);
  });

  it('computes a distance-mode segment', () => {
    const c = computeSegment(draft({ mode: 'distance', value: '5', pace: '6:00' }))!;
    expect(c.distanceM).toBe(5000);
    expect(c.timeSec).toBeCloseTo(1800, 3);
  });

  it('rejects invalid input', () => {
    expect(computeSegment(draft({ value: 'nope' }))).toBeNull();
    expect(computeSegment(draft({ pace: '0' }))).toBeNull();
  });

  it('flattens drafts and reports errors', () => {
    const { segments, hasErrors } = flattenDrafts([
      draft({}),
      draft({ pace: 'bad' }),
    ]);
    expect(segments).toHaveLength(1);
    expect(hasErrors).toBe(true);
  });

  it('totals time, distance and climb', () => {
    const { segments } = flattenDrafts([
      draft({ mode: 'time', value: '10:00', pace: '5:00', incline: '2' }),
      draft({ mode: 'distance', value: '1', pace: '5:00', incline: '-3' }),
    ]);
    const t = computeTotals(segments);
    expect(t.timeSec).toBeCloseTo(600 + 300, 3);
    expect(t.distanceM).toBeCloseTo(3000, 3);
    expect(t.climbM).toBeCloseTo(2000 * 0.02, 3); // downhill doesn't count
  });
});

describe('sensor streams', () => {
  it('converts Strava stream arrays to sensor points', () => {
    const pts = stravaStreamsToSensorPoints({
      time: { data: [0, 10, 20] },
      heartrate: { data: [120, 130, 140] },
      cadence: { data: [80, null, 84] },
    });
    expect(pts).toHaveLength(3);
    expect(pts[1]).toEqual({ t: 10, hr: 130, cad: null });
  });

  it('returns empty for missing time stream', () => {
    expect(stravaStreamsToSensorPoints({ heartrate: { data: [1] } })).toEqual([]);
  });

  it('interpolates between points and clamps at the edges', () => {
    const sample = createSensorSampler([
      { t: 0, hr: 100, cad: null },
      { t: 10, hr: 120, cad: 85 },
    ]);
    expect(sample(-5, 'hr')).toBe(100);
    expect(sample(5, 'hr')).toBe(110);
    expect(sample(99, 'hr')).toBe(120);
    expect(sample(5, 'cad')).toBe(85); // null side falls back to the known value
  });
});

describe('activity build & TCX', () => {
  const segments = flattenDrafts([
    draft({ name: 'Warmup', mode: 'time', value: '5:00', pace: '6:00', incline: '1' }),
    draft({ name: 'Work', mode: 'distance', value: '1', pace: '4:30', incline: '0' }),
  ]).segments;

  it('builds laps with continuous distance and elapsed time', () => {
    const laps = buildActivity({
      name: 'Test',
      startTime: new Date('2026-01-01T10:00:00Z'),
      segments,
      resolutionSec: 5,
    });
    expect(laps).toHaveLength(2);
    const lastWarmup = laps[0].points[laps[0].points.length - 1];
    expect(lastWarmup.elapsedSec).toBeCloseTo(300, 3);
    const lastWork = laps[1].points[laps[1].points.length - 1];
    expect(lastWork.cumDistM).toBeCloseTo(segments[0].distanceM + 1000, 1);
  });

  it('stretches sensor data onto the workout timeline', () => {
    const laps = buildActivity({
      name: 'Test',
      startTime: new Date('2026-01-01T10:00:00Z'),
      segments,
      resolutionSec: 30,
      // 100s recording vs ~570s workout: stretch maps ends to ends
      sensorPoints: [
        { t: 0, hr: 100, cad: 80 },
        { t: 100, hr: 180, cad: 90 },
      ],
      sensorAlign: 'stretch',
    });
    const allPoints = laps.flatMap((l) => l.points);
    expect(allPoints[allPoints.length - 1].hr).toBeCloseTo(180, 0);
    expect(allPoints[0].hr).toBeLessThan(120);
  });

  it('generates valid-looking TCX with HR and cadence', () => {
    const tcx = generateTcx({
      name: 'Fixed <Treadmill> Run',
      startTime: new Date('2026-01-01T10:00:00Z'),
      segments,
      resolutionSec: 10,
      sensorPoints: [
        { t: 0, hr: 120, cad: 82 },
        { t: 600, hr: 160, cad: 88 },
      ],
    });
    expect(tcx).toContain('<TrainingCenterDatabase');
    expect(tcx).toContain('Sport="Running"');
    expect(tcx).toContain('<Id>2026-01-01T10:00:00Z</Id>');
    expect(tcx).toContain('Fixed &lt;Treadmill&gt; Run');
    expect(tcx).toContain('<HeartRateBpm>');
    expect(tcx).toContain('<RunCadence>');
    expect((tcx.match(/<Lap /g) || []).length).toBe(2);
    // No GPS for treadmill files
    expect(tcx).not.toContain('<Position>');
  });
});

describe('prefill', () => {
  it('expands interval runs into work + recovery segments', () => {
    const run: PlannedRun = {
      type: 'intervals',
      distance: 4,
      paceZone: 'interval',
      description: '',
      effortLevel: 8,
      noIntervals: 4,
      targetPace: 270,
    };
    const drafts = plannedRunsToDrafts([run]);
    // 4 work reps + 3 recoveries
    expect(drafts).toHaveLength(7);
    expect(drafts[0].name).toBe('Interval 1/4');
    expect(drafts[0].value).toBe('1');
    expect(drafts[0].pace).toBe('4:30');
    expect(drafts[1].name).toContain('Recovery');
  });

  it('uses zone default pace when no target pace is set', () => {
    const run: PlannedRun = {
      type: 'easy',
      distance: 5,
      paceZone: 'easy',
      description: '',
      effortLevel: 3,
    };
    const drafts = plannedRunsToDrafts([run]);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].pace).toBe('6:30');
    expect(drafts[0].mode).toBe('distance');
  });

  it('falls back to a single segment matching the recorded activity', () => {
    const drafts = activityToDrafts(1800, 5000);
    expect(drafts).toHaveLength(1);
    expect(drafts[0].value).toBe('30:00');
    expect(drafts[0].pace).toBe('6:00');
    const c = computeSegment(drafts[0])!;
    expect(c.timeSec).toBe(1800);
    expect(c.distanceM).toBeCloseTo(5000, -1);
  });
});
