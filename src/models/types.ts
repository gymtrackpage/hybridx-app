// src/models/types.ts

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  athleteId: number;
}

export interface PersonalRecords {
  backSquat?: string;
  deadlift?: string;
  benchPress?: string;
  run1k?: string;
  run5k?: string;
  run10k?: string;
  [key: string]: string | undefined;
}

export interface UserRunningProfile {
  benchmarkPaces: {
    mile?: number;
    fiveK?: number;
    tenK?: number;
    halfMarathon?: number;
  };
  injuryHistory?: string[];
}

export type SubscriptionStatus = 'trial' | 'active' | 'canceled' | 'expired' | 'incomplete' | 'paused';

export type UnitSystem = 'metric' | 'imperial';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  frequency: '3' | '4' | '5+';
  goal: 'strength' | 'endurance' | 'hybrid';
  unitSystem?: UnitSystem;
  programId?: string | null;
  startDate?: Date;
  personalRecords?: PersonalRecords;
  runningProfile?: UserRunningProfile;
  strava?: StravaTokens;
  lastStravaSync?: Date;
  customProgram?: (Workout | RunningWorkout)[] | null;
  isAdmin?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  stripeCustomerId?: string;
  subscriptionId?: string | null;
  trialStartDate?: Date;
  cancel_at_period_end?: boolean;
  cancellation_effective_date?: Date;
  completedWorkouts?: number;
  notificationTime?: { hour: number; minute: number };
}

export type ProgramType = 'hyrox' | 'running';

export interface Program {
  id: string;
  name: string;
  description: string;
  programType: ProgramType;
  workouts: (Workout | RunningWorkout)[];
}

export interface RunningProgram extends Omit<Program, 'workouts'> {
  programType: 'running';
  targetRace?: 'mile' | '5k' | '10k' | 'half-marathon' | 'marathon';
  workouts: RunningWorkout[];
}

export interface Workout {
  day: number;
  title: string;
  exercises: Exercise[];
  programType: 'hyrox';
}

export interface RunningWorkout {
  day: number;
  title: string;
  runs: PlannedRun[];
  programType: 'running';
  targetRace?: 'mile' | '5k' | '10k' | 'half-marathon' | 'marathon';
  exercises: [];
}

export type PaceZone = 'recovery' | 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';

export interface PlannedRun {
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'recovery';
  distance: number;
  paceZone: PaceZone;
  description: string;
  targetPace?: number;
  effortLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  noIntervals?: number;
}

export interface Exercise {
  name: string;
  details: string;
}

// ── Timer types ───────────────────────────────────────────────────────────────

export type TimerMode = 'for-time' | 'amrap' | 'emom' | 'tabata' | 'reps';

export interface TimerSet {
  setNumber: number;
  duration: number; // seconds
}

export interface TimerRound {
  roundNumber: number;
  sets: TimerSet[];
  startTime: number;   // seconds elapsed when round started
  totalDuration: number; // seconds
}

/** Persisted timer result saved onto a WorkoutSession */
export interface TimerRecord {
  timerMode: TimerMode;
  totalTime: number;   // seconds
  completedAt: string; // ISO date string
  workoutLog?: TimerRound[];               // For Time: round/set splits
  amrapRounds?: number;                    // AMRAP: rounds completed
  repLog?: { set: number; reps: number }[]; // Reps: per-set counts
}

// ─────────────────────────────────────────────────────────────────────────────

export interface WorkoutSession {
    id: string;
    userId: string;
    programId: string;
    workoutDate: Date;
    workoutTitle: string;
    programType: ProgramType;
    startedAt: Date;
    finishedAt?: Date;
    notes?: string;
    duration?: string;
    extendedExercises?: Exercise[];
    skipped?: boolean;
    workoutDetails?: Workout | RunningWorkout;
    exerciseChecklist?: Record<string, boolean>;
    timerRecord?: TimerRecord;
    stravaId?: string;
    uploadedToStrava?: boolean;
    stravaUploadedAt?: Date;
    stravaActivity?: {
        distance?: number;
        moving_time?: number;
        name?: string;
    };
}

export interface Article {
  id: string;
  title: string;
  content: string;
  prompt: string;
  tags: string[];
  createdAt: Date;
}

// ── Journal types ─────────────────────────────────────────────────────────────

export type MoodLevel = 'great' | 'good' | 'okay' | 'tired' | 'struggling';

export type JournalTag =
  | 'form'
  | 'mental'
  | 'nutrition'
  | 'achievement'
  | 'challenge'
  | 'recovery'
  | 'motivation'
  | 'technique'
  | 'injury'
  | 'progress';

export interface JournalEntry {
  id: string;
  userId: string;
  date: Date;               // Date the athlete is journaling about (defaults to today)
  content: string;          // Free-form journal text
  mood?: MoodLevel;         // Optional mood indicator
  tags?: JournalTag[];      // Optional category tags
  aiInsight?: string;       // AI coaching insight (generated on demand, stored)
  aiInsightGeneratedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
