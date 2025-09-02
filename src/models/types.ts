export interface PersonalRecords {
  backSquat?: string;
  deadlift?: string;
  benchPress?: string;
  run1k?: string;
  run5k?: string;
  run10k?: string;
  [key: string]: string | undefined; // For flexible additional records
}

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
    isRunning: boolean;
    completedExercises: { [exerciseName: string]: boolean };
    notes?: string;
}
