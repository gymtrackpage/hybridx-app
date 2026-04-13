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
  [key: string]: string | undefined; // For flexible additional records
}

export interface UserRunningProfile {
  benchmarkPaces: {
    mile?: number;      // total time in seconds
    fiveK?: number;     // total time in seconds
    tenK?: number;      // total time in seconds
    halfMarathon?: number; // total time in seconds
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
  unitSystem?: UnitSystem; // Preference for metric vs imperial
  programId?: string | null;
  startDate?: Date;
  personalRecords?: PersonalRecords;
  runningProfile?: UserRunningProfile;
  strava?: StravaTokens;
  lastStravaSync?: Date;
  // AI-adjusted program for the user
  customProgram?: WorkoutDay[] | null;
  // Subscription fields
  isAdmin?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  stripeCustomerId?: string;
  subscriptionId?: string | null;
  trialStartDate?: Date;
  cancel_at_period_end?: boolean;
  cancellation_effective_date?: Date;
  completedWorkouts?: number; // Added for admin view
  // Notification preferences
  notificationTime?: { hour: number; minute: number };
}

export type ProgramType = 'hyrox' | 'running' | 'hybrid';

export type TargetRace = 'mile' | '5k' | '10k' | 'half-marathon' | 'marathon' | 'hyrox' | 'ultra';

export type PaceZone = 'recovery' | 'easy' | 'marathon' | 'threshold' | 'interval' | 'repetition';

export interface PlannedRun {
  type: 'easy' | 'tempo' | 'intervals' | 'long' | 'recovery';
  distance: number; // kilometers
  paceZone: PaceZone;
  description: string;
  targetPace?: number; // calculated automatically in seconds per kilometer
  effortLevel: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  noIntervals?: number;
}

export interface Exercise {
  name: string;
  details: string;
}

/**
 * A single day in a training program.
 * Both `exercises` and `runs` can be populated simultaneously to support
 * hybrid sessions (e.g. compromised running, gym + run days).
 * Either array may be empty — use the hasExercises / hasRuns helpers
 * from type-guards.ts to check for content rather than inspecting programType.
 */
export interface WorkoutDay {
  day: number;
  title: string;
  exercises: Exercise[];  // [] when no strength/gym work scheduled
  runs: PlannedRun[];     // [] when no running scheduled
}

export interface Program {
  id: string;
  name: string;
  description: string;
  programType: ProgramType;
  workouts: WorkoutDay[];
  targetRace?: TargetRace;
}

// ─── Legacy aliases kept for backwards compatibility ─────────────────────────
// These let existing imports continue to resolve while the codebase is migrated.
/** @deprecated Use WorkoutDay instead */
export type Workout = WorkoutDay;
/** @deprecated Use WorkoutDay instead */
export type RunningWorkout = WorkoutDay;
/** @deprecated Use Program instead */
export type RunningProgram = Program;

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
    duration?: string; // Optional duration for custom workouts
    extendedExercises?: Exercise[]; // AI-generated exercises
    skipped?: boolean; // Flag to indicate if workout was skipped

    // Details of the workout that was performed, for sessions not linked to a program
    workoutDetails?: WorkoutDay;

    // Per-exercise checklist for ticking off exercises during a workout
    exerciseChecklist?: Record<string, boolean>;

    // Strava integration fields
    stravaId?: string;
    uploadedToStrava?: boolean;
    stravaUploadedAt?: Date;
    stravaActivity?: { // Store key details from the linked activity
        distance?: number; // in meters
        moving_time?: number; // in seconds
        name?: string;
    };
}

export interface Article {
  id: string;
  title: string;
  content: string; // The full article content in Markdown format
  prompt: string; // The user's original search query
  tags: string[]; // Keywords for searching
  createdAt: Date;
}
