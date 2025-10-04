// src/utils/streak-calculator.ts
import { WorkoutSession } from '@/models/types';
import { isToday, isYesterday, isSameDay, subDays } from 'date-fns';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  totalWorkouts: number;
  thisWeekWorkouts: number;
  thisMonthWorkouts: number;
}

export function calculateStreakData(sessions: WorkoutSession[]): StreakData {
  // Filter only completed sessions and sort by date descending
  const completedSessions = sessions
    .filter(s => s.finishedAt && !s.skipped)
    .sort((a, b) => b.workoutDate.getTime() - a.workoutDate.getTime());

  if (completedSessions.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      totalWorkouts: 0,
      thisWeekWorkouts: 0,
      thisMonthWorkouts: 0,
    };
  }

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if most recent workout was today or yesterday
  const mostRecent = completedSessions[0].workoutDate;
  if (!isToday(mostRecent) && !isYesterday(mostRecent)) {
    // Streak is broken
    currentStreak = 0;
  } else {
    // Count consecutive days
    let checkDate = isToday(mostRecent) ? today : subDays(today, 1);

    for (const session of completedSessions) {
      const sessionDate = new Date(session.workoutDate);
      sessionDate.setHours(0, 0, 0, 0);

      if (isSameDay(sessionDate, checkDate)) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else if (sessionDate < checkDate) {
        // Gap in streak
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 0; i < completedSessions.length - 1; i++) {
    const current = new Date(completedSessions[i].workoutDate);
    const next = new Date(completedSessions[i + 1].workoutDate);
    current.setHours(0, 0, 0, 0);
    next.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor((current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      tempStreak++;
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  // Calculate this week's workouts
  const oneWeekAgo = subDays(today, 7);
  const thisWeekWorkouts = completedSessions.filter(
    s => s.workoutDate >= oneWeekAgo
  ).length;

  // Calculate this month's workouts
  const oneMonthAgo = subDays(today, 30);
  const thisMonthWorkouts = completedSessions.filter(
    s => s.workoutDate >= oneMonthAgo
  ).length;

  return {
    currentStreak,
    longestStreak,
    totalWorkouts: completedSessions.length,
    thisWeekWorkouts,
    thisMonthWorkouts,
  };
}
