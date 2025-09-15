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

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  frequency: '3' | '4' | '5+';
  goal: 'strength' | 'endurance' | 'hybrid';
  programId?: string | null;
  startDate?: Date;
  personalRecords?: PersonalRecords;
  runningProfile?: UserRunningProfile;
  strava?: StravaTokens;
  lastStravaSync?: Date;
  // Subscription fields
  isAdmin?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  stripeCustomerId?: string;
  subscriptionId?: string | null;
  trialStartDate?: Date;
  cancel_at_period_end?: boolean;
  cancellation_effective_date?: Date;
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
  programType: 'hyrox'; // Explicitly hyrox for this type
}

export interface RunningWorkout {
  day: number;
  title: string;
  runs: PlannedRun[];
  programType: 'running'; // Explicitly running for this type
  targetRace?: 'mile' | '5k' | '10k' | 'half-marathon' | 'marathon';
  exercises: []; // To satisfy base type if needed, but should be empty
}

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

export interface WorkoutSession {
    id: string;
    userId: string;
    programId: string;
    workoutDate: Date;
    workoutTitle: string;
    programType: ProgramType;
    startedAt: Date;
    finishedAt?: Date;
    completedItems: { [itemName: string]: boolean };
    notes?: string;
    duration?: string; // Optional duration for custom workouts
    extendedExercises?: Exercise[]; // AI-generated exercises
    
    // Details of the workout that was performed, for sessions not linked to a program
    workoutDetails?: Workout | RunningWorkout;
    
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
