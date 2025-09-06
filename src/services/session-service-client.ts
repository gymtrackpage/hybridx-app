// src/services/session-service-client.ts
// This file contains functions for client-side components. NO 'use server' here.

import { collection, doc, getDocs, addDoc, updateDoc, query, where, Timestamp, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkoutSession, Workout } from '@/models/types';

function fromFirestore(doc: any): WorkoutSession {
    const data = doc.data();
    return {
        id: doc.id,
        userId: data.userId,
        programId: data.programId,
        workoutDate: data.workoutDate.toDate(),
        startedAt: data.startedAt.toDate(),
        finishedAt: data.finishedAt ? data.finishedAt.toDate() : undefined,
        completedExercises: data.completedExercises,
        notes: data.notes || '',
    };
}

const sessionsCollection = collection(db, 'workoutSessions');

export async function getAllUserSessions(userId: string): Promise<WorkoutSession[]> {
    const q = query(
        sessionsCollection,
        where('userId', '==', userId),
        orderBy('workoutDate', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(fromFirestore);
}

export async function getOrCreateWorkoutSession(userId: string, programId: string, workoutDate: Date, workout: Workout): Promise<WorkoutSession> {
    const q = query(
        sessionsCollection, 
        where('userId', '==', userId), 
        where('workoutDate', '==', Timestamp.fromDate(workoutDate)),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        return fromFirestore(snapshot.docs[0]);
    }

    const initialCompleted: { [key: string]: boolean } = {};
    workout.exercises.forEach(ex => {
        initialCompleted[ex.name] = false;
    });

    const newSessionData = {
        userId,
        programId,
        workoutDate: Timestamp.fromDate(workoutDate),
        startedAt: Timestamp.now(),
        completedExercises: initialCompleted,
        finishedAt: null,
        notes: '',
    };

    const docRef = await addDoc(sessionsCollection, newSessionData);
    
    return {
        id: docRef.id,
        userId,
        programId,
        workoutDate,
        startedAt: new Date(),
        completedExercises: initialCompleted,
        notes: '',
    };
}


export async function updateWorkoutSession(sessionId: string, data: Partial<Omit<WorkoutSession, 'id'>>): Promise<void> {
    const docRef = doc(sessionsCollection, sessionId);
    const dataToUpdate: { [key: string]: any } = { ...data };

    if (data.finishedAt) {
        dataToUpdate.finishedAt = Timestamp.fromDate(data.finishedAt);
    }

    await updateDoc(docRef, dataToUpdate);
}
