import { describe, it, expect } from 'vitest';
import { calculateStreakData } from '../streak-calculator';
import type { WorkoutSession } from '@/models/types';

function makeSession(overrides: Partial<WorkoutSession> & { workoutDate: Date }): WorkoutSession {
  return {
    id: Math.random().toString(36),
    userId: 'user-1',
    programId: 'program-1',
    workoutTitle: 'Workout',
    programType: 'hyrox',
    startedAt: overrides.workoutDate,
    finishedAt: overrides.workoutDate,
    skipped: false,
    ...overrides,
  };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

describe('calculateStreakData', () => {
  it('counts a single session per day as one day of streak', () => {
    const sessions = [
      makeSession({ workoutDate: daysAgo(0) }),
      makeSession({ workoutDate: daysAgo(1) }),
      makeSession({ workoutDate: daysAgo(2) }),
    ];
    const streak = calculateStreakData(sessions);
    expect(streak.currentStreak).toBe(3);
    expect(streak.longestStreak).toBe(3);
  });

  it('does not double-count or break the streak when a day has multiple finished sub-workouts (e.g. Run + Weight Training)', () => {
    const sessions = [
      // Today has two separate completed sessions (a run and a strength session)
      makeSession({ workoutDate: daysAgo(0), sessionIndex: 0, sessionCount: 2, workoutTitle: 'Easy Run' }),
      makeSession({ workoutDate: daysAgo(0), sessionIndex: 1, sessionCount: 2, workoutTitle: 'Lower Body Strength' }),
      makeSession({ workoutDate: daysAgo(1) }),
      makeSession({ workoutDate: daysAgo(2) }),
    ];
    const streak = calculateStreakData(sessions);
    // 3 unique days completed in a row, not broken/inflated by the duplicate date
    expect(streak.currentStreak).toBe(3);
    expect(streak.longestStreak).toBe(3);
    // But total/weekly workout counts still reflect every individual sub-workout completed
    expect(streak.totalWorkouts).toBe(4);
  });

  it('breaks the streak on a real gap even with multi-session days on both sides', () => {
    const sessions = [
      makeSession({ workoutDate: daysAgo(0), sessionIndex: 0, sessionCount: 2 }),
      makeSession({ workoutDate: daysAgo(0), sessionIndex: 1, sessionCount: 2 }),
      // gap at daysAgo(1)
      makeSession({ workoutDate: daysAgo(2), sessionIndex: 0, sessionCount: 2 }),
      makeSession({ workoutDate: daysAgo(2), sessionIndex: 1, sessionCount: 2 }),
    ];
    const streak = calculateStreakData(sessions);
    expect(streak.currentStreak).toBe(1);
  });

  it('ignores skipped sessions when computing the streak', () => {
    const sessions = [
      makeSession({ workoutDate: daysAgo(0), skipped: true, finishedAt: daysAgo(0) }),
      makeSession({ workoutDate: daysAgo(1) }),
    ];
    const streak = calculateStreakData(sessions);
    // Today was skipped (not counted), but yesterday was completed, so the streak is still alive at 1.
    expect(streak.currentStreak).toBe(1);
  });
});
