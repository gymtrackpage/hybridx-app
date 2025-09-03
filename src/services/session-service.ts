// src/services/session-service.ts
'use server';

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
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
        isRunning: data.isRunning,
        completedExercises: data.completedExercises,
        notes: data.notes || '',
    };
}

// SERVER-SIDE function using Admin SDK
export async function getOrCreateWorkoutSessionAdmin(userId: string, programId: string, workoutDate: Date, workout: Workout): Promise<WorkoutSession> {
    const adminDb = getAdminDb();
    const sessionsCollectionAdmin = adminDb.collection('workoutSessions');
    const q = sessionsCollectionAdmin
        .where('userId', '==', userId)
        .where('workoutDate', '==', Timestamp.fromDate(workoutDate))
        .limit(1);

    const snapshot = await q.get();

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
        isRunning: false,
        completedExercises: initialCompleted,
        finishedAt: null,
        notes: '',
    };

    const docRef = await sessionsCollectionAdmin.add(newSessionData);
    
    return {
        id: docRef.id,
        userId,
        programId,
        workoutDate,
        startedAt: new Date(),
        isRunning: false,
        completedExercises: initialCompleted,
        notes: '',
    };
}
