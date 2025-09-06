export interface PersonalRecords {
  backSquat?: string;
  deadlift?: string;
  benchPress?: string;
  run1k?: string;
  run5k?: string;
  run10k?: string;
  [key: string]: string | undefined; // For flexible additional records
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
  // Subscription fields
  isAdmin?: boolean;
  subscriptionStatus?: SubscriptionStatus;
  stripeCustomerId?: string;
  subscriptionId?: string | null;
  trialStartDate?: Date;
  cancel_at_period_end?: boolean;
  cancellation_effective_date?: Date;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  workouts: Workout[];
}

export interface Workout {
  day: number;
  title: string;
  exercises: Exercise[];
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
    startedAt: Date;
    finishedAt?: Date;
    completedExercises: { [exerciseName: string]: boolean };
    notes?: string;
}
