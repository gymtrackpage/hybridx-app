import { describe, it, expect } from 'vitest';
import { WORKOUT_MILESTONES, crossedMilestones } from '../activity';

describe('crossedMilestones', () => {
  it('reports nothing when the counter did not move', () => {
    expect(crossedMilestones(10, 10)).toEqual([]);
  });

  it('reports nothing for ordinary sessions between milestones', () => {
    expect(crossedMilestones(11, 12)).toEqual([]);
    expect(crossedMilestones(1, 9)).toEqual([]);
  });

  it('reports a milestone landed on exactly', () => {
    expect(crossedMilestones(9, 10)).toEqual([10]);
    expect(crossedMilestones(99, 100)).toEqual([100]);
  });

  it('does NOT re-report a milestone already passed', () => {
    // The whole point of taking a before-and-after rather than a total: an
    // athlete on 10 sessions must not be congratulated again on their 11th.
    expect(crossedMilestones(10, 11)).toEqual([]);
    expect(crossedMilestones(25, 26)).toEqual([]);
  });

  it('reports every milestone in the interval, not just the highest', () => {
    // A Strava import can jump someone from 8 to 30 in one pass. They have
    // genuinely passed both 10 and 25, and which ones fire must not depend on
    // how many sessions happened to be in the batch.
    expect(crossedMilestones(8, 30)).toEqual([10, 25]);
    expect(crossedMilestones(0, 250)).toEqual([...WORKOUT_MILESTONES]);
  });

  it('never reports a milestone for a counter going backwards', () => {
    expect(crossedMilestones(30, 8)).toEqual([]);
  });

  it('treats the first workout as no milestone — that has its own event', () => {
    expect(crossedMilestones(0, 1)).toEqual([]);
  });
});

describe('WORKOUT_MILESTONES', () => {
  it('is strictly ascending, which crossedMilestones relies on for ordering', () => {
    const sorted = [...WORKOUT_MILESTONES].sort((a, b) => a - b);
    expect([...WORKOUT_MILESTONES]).toEqual(sorted);
    expect(new Set(WORKOUT_MILESTONES).size).toBe(WORKOUT_MILESTONES.length);
  });

  it('stays sparse enough that a milestone email remains an event', () => {
    // Guards against someone adding every multiple of five later: at that
    // density the mail stops reading as encouragement and starts as noise.
    expect(WORKOUT_MILESTONES.length).toBeLessThanOrEqual(6);
  });
});
