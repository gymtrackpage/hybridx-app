// src/services/session-service-queries.ts
// This file contains specific, isolated query functions to avoid circular dependencies.

import { collection, query, where, Timestamp, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { WorkoutSession } from '@/models/types';

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
        duration: data.duration,
        extendedExercises: data.extendedExercises || [],
        workoutDetails: data.workoutDetails,
        stravaId: data.stravaId,
        uploadedToStrava: data.uploadedToStrava,
        stravaUploadedAt: data.stravaUploadedAt ? data.stravaUploadedAt.toDate() : undefined,
        stravaActivity: data.stravaActivity,
    };
}

const sessionsCollection = collection(db, 'workoutSessions');

/**
 * Fetches a one-off (AI generated) or custom workout session for a specific user and date.
 * @param userId The ID of the user.
 * @param workoutDate The specific date to check for a session.
 * @returns The workout session if found, otherwise null.
 */
export async function getTodaysOneOffSession(userId: string, workoutDate: Date): Promise<WorkoutSession | null> {
     const q = query(
        sessionsCollection, 
        where('userId', '==', userId),
        where('programId', 'in', ['one-off-ai', 'custom-workout']),
        where('workoutDate', '==', Timestamp.fromDate(workoutDate)),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return fromFirestore(snapshot.docs[0]);
    }
    return null;
}
