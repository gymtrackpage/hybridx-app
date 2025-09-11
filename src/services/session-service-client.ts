
// src/services/session-service-client.ts
// This file contains functions for client-side components. NO 'use server' here.

import { collection, doc, getDocs, addDoc, updateDoc, query, where, Timestamp, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkoutSession, Workout, RunningWorkout, Exercise } from '@/models/types';

function fromFirestore(doc: any): WorkoutSession {
    const data = doc.data();
    return {
        id: doc.id,
        userId: data.userId,
        programId: data.programId,
        workoutDate: data.workoutDate.toDate(),
        workoutTitle: data.workoutTitle || 'Workout',
        programType: data.programType || 'hyrox',
        startedAt: data.startedAt.toDate(),
        finishedAt: data.finishedAt ? data.finishedAt.toDate() : undefined,
        completedItems: data.completedItems,
        notes: data.notes || '',
        extendedExercises: data.extendedExercises || [],
        stravaId: data.stravaId,
        uploadedToStrava: data.uploadedToStrava,
        stravaUploadedAt: data.stravaUploadedAt ? data.stravaUploadedAt.toDate() : undefined,
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

export async function getTodaysOneOffSession(userId: string, workoutDate: Date): Promise<WorkoutSession | null> {
     const q = query(
        sessionsCollection, 
        where('userId', '==', userId), 
        where('programId', '==', 'one-off-ai'),
        where('workoutDate', '==', Timestamp.fromDate(workoutDate)),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return fromFirestore(snapshot.docs[0]);
    }
    return null;
}

export async function getOrCreateWorkoutSession(userId: string, programId: string, workoutDate: Date, workout: Workout | RunningWorkout, overwrite: boolean = false): Promise<WorkoutSession> {
    const q = query(
        sessionsCollection, 
        where('userId', '==', userId), 
        where('workoutDate', '==', Timestamp.fromDate(workoutDate)),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty && !overwrite) {
        // If a session exists and we are not overwriting, return it, unless it's a one-off-ai session and a program session is being created
        const existingSession = fromFirestore(snapshot.docs[0]);
        if (existingSession.programId === 'one-off-ai' && programId !== 'one-off-ai') {
             // We are creating a program session, it should take precedence over the AI one
        } else {
            return existingSession;
        }
    }

    if (!snapshot.empty && (overwrite || (programId !== 'one-off-ai' && snapshot.docs[0].data().programId === 'one-off-ai'))) {
        // Overwrite if flag is set, or if we are creating a program day over an existing AI workout
        console.log(`Overwriting existing workout session for date: ${workoutDate.toISOString()}`);
    }

    const initialCompleted: { [key: string]: boolean } = {};
    const items = workout.programType === 'running' 
        ? (workout as RunningWorkout).runs 
        : [...((workout as Workout).exercises || [])]; // Use empty array as fallback
        
    // For AI workouts, the exercises are passed directly in the workout object
    if (programId === 'one-off-ai' && (workout as Workout).exercises) {
        (workout as Workout).exercises.forEach(item => {
            const key = (item as any).name;
            initialCompleted[key] = false;
        });
    } else {
        items.forEach(item => {
            const key = workout.programType === 'running' ? (item as any).description : (item as any).name;
            initialCompleted[key] = false;
        });
    }

    const newSessionData = {
        userId,
        programId,
        workoutDate: Timestamp.fromDate(workoutDate),
        workoutTitle: workout.title,
        programType: workout.programType || 'hyrox',
        startedAt: Timestamp.now(),
        completedItems: initialCompleted,
        finishedAt: null,
        notes: '',
        // For AI workouts, store the exercises in the extendedExercises field
        extendedExercises: programId === 'one-off-ai' ? (workout as Workout).exercises : [],
    };

    if (!snapshot.empty && (overwrite || (programId !== 'one-off-ai'))) {
        const docToUpdate = snapshot.docs[0];
        await updateDoc(docToUpdate.ref, newSessionData);
        // The data passed to fromFirestore should match the structure of a Firestore doc
        const updatedDocData = { ...docToUpdate.data(), ...newSessionData };
        return { ...fromFirestore({ id: docToUpdate.id, data: () => updatedDocData }) };
    }

    const docRef = await addDoc(sessionsCollection, newSessionData);
    
    return {
        id: docRef.id,
        userId,
        programId,
        workoutDate,
        workoutTitle: workout.title,
        programType: workout.programType || 'hyrox',
        startedAt: new Date(),
        completedItems: initialCompleted,
        notes: '',
        extendedExercises: newSessionData.extendedExercises,
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

    
