// src/services/program-service.ts
'use server';

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import type { Program, Workout } from '@/models/types';
import { differenceInDays } from 'date-fns';

// SERVER-SIDE function using Admin SDK
export async function getProgram(programId: string): Promise<Program | null> {
    const adminDb = getAdminDb();
    const programsCollection = adminDb.collection('programs');
    const docRef = programsCollection.doc(programId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        const data = docSnap.data();
        if (data) {
            // Firestore Admin SDK might not automatically convert Timestamps in nested arrays.
            // Let's assume for now it does, but this can be a point of failure if dates are wrong.
            return { id: docSnap.id, ...data } as Program;
        }
    }
    return null;
}

// CLIENT-SIDE function using Client SDK
export async function getProgramClient(programId: string): Promise<Program | null> {
    const docRef = doc(db, 'programs', programId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Program;
    }
    return null;
}


// CLIENT-SIDE functions
const programsCollectionClient = collection(db, 'programs');

export async function getAllPrograms(): Promise<Program[]> {
    const snapshot = await getDocs(programsCollectionClient);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
}

export async function createProgram(data: Omit<Program, 'id'>): Promise<string> {
    const docRef = await addDoc(programsCollectionClient, data);
    return docRef.id;
}

export async function updateProgram(programId: string, data: Partial<Program>): Promise<void> {
    const docRef = doc(programsCollectionClient, programId);
    await updateDoc(docRef, data);
}

export async function deleteProgram(programId: string): Promise<void> {
    const docRef = doc(programsCollectionClient, programId);
    await deleteDoc(docRef);
}

// This is a pure function, doesn't need to be client or server specific but must be async due to 'use server'
export async function getWorkoutForDay(program: Program, startDate: Date, targetDate: Date): Promise<{ day: number; workout: Workout | null; }> {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);

    const dayOfProgram = differenceInDays(target, start) + 1;
    
    if (dayOfProgram < 1) {
        return { day: dayOfProgram, workout: null };
    }

    const cycleLength = Math.max(...program.workouts.map(w => w.day), 0);
    if (cycleLength === 0) {
        return { day: dayOfProgram, workout: null };
    }
    
    const dayInCycle = ((dayOfProgram - 1) % cycleLength) + 1;
    const workoutForDay = program.workouts.find(w => w.day === dayInCycle);

    return { day: dayOfProgram, workout: workoutForDay || null };
}
