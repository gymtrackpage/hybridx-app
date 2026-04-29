// src/models/types.ts

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
  athleteId: number;
}

export interface GarminTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token expiry. */
  expiresAt: Date;
  /** Refresh-token expiry (Garmin issues a new one on each refresh). */
  refreshExpiresAt?: Date;
  /** Garmin user UUID returned by the user-id endpoint. Used to dedupe webhooks. */
  garminUserId?: string;
  scope?: string;
  tokenType?: string;
}

/** Short-lived state stored on the user doc between /connect and /exchange. */
export interface PendingGarminAuth {
  codeVerifier: string;
  state: string;
  /** Epoch ms when the pending auth expires (10 minutes after creation). */
  expiresAt: number;
}

/** Mapping of program day → Garmin workout id, so we can push updates / deletes. */
export interface GarminPlanSync {
  programId: string;
  /** Map keyed by day number (as string for Firestore-friendly keys). */
  workouts: Record<string, { workoutId: string; scheduleId?: string; scheduledDate?: string }>;
  lastSyncedAt: Date;
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
  garmin?: GarminTokens;
  garminConnectedAt?: Date;
  pendingGarminAuth?: PendingGarminAuth;
  garminPlanSync?: GarminPlanSync;
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
  // Analytics fields
  lastSeenAt?: Date;
  lastLoginAt?: Date;
  /** Highest onboarding step reached (1–6); 6 = completed */
  onboardingCompletedStep?: number;
  /** Platform at last session: web | pwa | ios | android */
  platform?: string;
  sessionCount?: number;
  totalSessionMinutes?: number;
}

export type ProgramType = 'hyrox' | 'running' | 'hybrid';

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

export type WorkoutDay = Workout | RunningWorkout;

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
  // Optional structured fields for Garmin sync — invisible to all UI display components
  garminExerciseCategory?: string;
  garminExerciseName?: string;
  weightKg?: number;
  restSeconds?: number;
  sets?: number;
  reps?: number;
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
  date: Date;                    // Date the athlete is journaling about (defaults to today)
  content: string;               // Free-form journal text
  mood?: MoodLevel;              // Optional mood indicator
  tags?: JournalTag[];           // Optional category tags
  aiInsight?: string;            // Legacy: combined AI insight (kept for backward compat)
  aiInsightGeneratedAt?: Date;   // Legacy timestamp
  aiInterpretation?: string;     // What the coach hears / reads between the lines
  aiCoachResponse?: string;      // Direct coaching advice
  aiAnalysisGeneratedAt?: Date;  // When the split analysis was last generated
  createdAt: Date;
  updatedAt: Date;
}
