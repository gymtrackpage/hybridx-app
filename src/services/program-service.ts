import { collection, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Program } from '@/models/types';

const programsCollection = collection(db, 'programs');

export async function getProgram(programId: string): Promise<Program | null> {
    const docRef = doc(programsCollection, programId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Program;
    }
    return null;
}

export function getWorkoutForDay(program: Program, startDate: Date, targetDate: Date): { day: number; workout: import('@/models/types').Workout | null; } {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const diffTime = Math.abs(target.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const dayOfProgram = diffDays + 1;

    const workout = program.workouts.find(w => w.day === dayOfProgram) || null;
    return { day: dayOfProgram, workout };
}
