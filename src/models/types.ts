export interface User {
  id: string;
  email: string;
  experience: 'beginner' | 'intermediate' | 'advanced';
  frequency: '3' | '4' | '5+';
  goal: 'strength' | 'endurance' | 'hybrid';
  programId?: string | null;
  startDate?: Date;
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
