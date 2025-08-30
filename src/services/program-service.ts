import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Program } from '@/models/types';
import { differenceInDays } from 'date-fns';

const programsCollection = collection(db, 'programs');

export async function getAllPrograms(): Promise<Program[]> {
    const snapshot = await getDocs(programsCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
}

export async function getProgram(programId: string): Promise<Program | null> {
    const docRef = doc(programsCollection, programId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Program;
    }
    return null;
}

export async function createProgram(data: Omit<Program, 'id'>): Promise<string> {
    const docRef = await addDoc(programsCollection, data);
    return docRef.id;
}

export async function updateProgram(programId: string, data: Partial<Program>): Promise<void> {
    const docRef = doc(programsCollection, programId);
    await updateDoc(docRef, data);
}

export async function deleteProgram(programId: string): Promise<void> {
    const docRef = doc(programsCollection, programId);
    await deleteDoc(docRef);
}


export function getWorkoutForDay(program: Program, startDate: Date, targetDate: Date): { day: number; workout: import('@/models/types').Workout | null; } {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const dayOfProgram = differenceInDays(target, start) + 1;
    
    if (dayOfProgram < 1) {
        return { day: dayOfProgram, workout: null };
    }

    const workoutForDay = program.workouts.find(w => w.day === dayOfProgram);

    // If there's no specific workout for that day number, maybe it's a rest day or not defined
    return { day: dayOfProgram, workout: workoutForDay || null };
}
