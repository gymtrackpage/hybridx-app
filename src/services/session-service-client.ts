// src/services/session-service-client.ts
import { logger } from '@/lib/logger';
// This file contains functions for client-side components. NO 'use server' here.

import { collection, doc, getDocs, addDoc, updateDoc, query, where, Timestamp, limit, orderBy, getDoc, startAfter, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { db, getAuthInstance } from '@/lib/firebase';
import type { WorkoutSession, WorkoutDay, Exercise, ProgramType } from '@/models/types';
import type { StravaActivity } from './strava-service';

// Re-export WorkoutSession type for convenience
export type { WorkoutSession };

// Pagination result type
export interface PaginatedSessions {
    sessions: WorkoutSession[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
}

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
        notes: data.notes || '',
        duration: data.duration,
        extendedExercises: data.extendedExercises || [],
        skipped: data.skipped || false,
        exerciseChecklist: data.exerciseChecklist || {},
        workoutDetails: data.workoutDetails,
        timerRecord: data.timerRecord,
        stravaId: data.stravaId,
        uploadedToStrava: data.uploadedToStrava,
        stravaUploadedAt: data.stravaUploadedAt ? data.stravaUploadedAt.toDate() : undefined,
        stravaActivity: data.stravaActivity,
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

/**
 * Fetch user sessions with pagination
 * @param userId - The user ID
 * @param pageSize - Number of sessions per page (default: 20)
 * @param lastDoc - Last document from previous page for pagination
 * @returns Paginated sessions with cursor for next page
 */
export async function getPaginatedUserSessions(
    userId: string,
    pageSize: number = 20,
    lastDoc?: QueryDocumentSnapshot<DocumentData> | null
): Promise<PaginatedSessions> {
    let q = query(
        sessionsCollection,
        where('userId', '==', userId),
        orderBy('workoutDate', 'desc'),
        limit(pageSize + 1)
    );

    if (lastDoc) {
        q = query(
            sessionsCollection,
            where('userId', '==', userId),
            orderBy('workoutDate', 'desc'),
            startAfter(lastDoc),
            limit(pageSize + 1)
        );
    }

    const snapshot = await getDocs(q);
    const docs = snapshot.docs;
    const hasMore = docs.length > pageSize;
    const sessions = docs.slice(0, pageSize).map(fromFirestore);
    const newLastDoc = sessions.length > 0 ? docs[pageSize - 1] : null;

    return {
        sessions,
        lastDoc: hasMore ? newLastDoc : null,
        hasMore
    };
}

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

export async function getTodaysProgramSession(userId: string, workoutDate: Date): Promise<WorkoutSession | null> {
    const q = query(
        sessionsCollection,
        where('userId', '==', userId),
        where('workoutDate', '==', Timestamp.fromDate(workoutDate)),
        where('programId', 'not-in', ['one-off-ai', 'custom-workout']),
        limit(1)
    );
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
        return fromFirestore(snapshot.docs[0]);
    }
    return null;
}

export async function createCustomWorkoutSession(userId: string, title: string, type: ProgramType, description: string, duration?: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const q = query(
        sessionsCollection,
        where('userId', '==', userId),
        where('workoutDate', '==', Timestamp.fromDate(today)),
        limit(1)
    );
    const snapshot = await getDocs(q);

    const workout: WorkoutDay = {
        title,
        day: 0,
        exercises: [{ name: 'Custom Activity', details: description }],
        programType: 'hyrox',
    };

    await getOrCreateWorkoutSession(userId, 'custom-workout', today, workout, true, duration);
}


function deriveSessionProgramType(workout: WorkoutDay): ProgramType {
    const hasR = ('runs' in workout ? (workout as any).runs?.length ?? 0 : 0) > 0;
    const hasE = (workout.exercises?.length ?? 0) > 0;
    if (hasR && hasE) return 'hybrid';
    if (hasR) return 'running';
    return 'hyrox';
}

export async function getOrCreateWorkoutSession(userId: string, programId: string, workoutDate: Date, workout: WorkoutDay, overwrite: boolean = false, duration?: string): Promise<any> {
    const q = query(
        sessionsCollection,
        where('userId', '==', userId),
        where('workoutDate', '==', Timestamp.fromDate(workoutDate)),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty && !overwrite) {
        const existingSession = fromFirestore(snapshot.docs[0]);
        if (['one-off-ai', 'custom-workout'].includes(existingSession.programId) && !['one-off-ai', 'custom-workout'].includes(programId)) {
             // Program session takes precedence
        } else {
            return existingSession;
        }
    }

    if (!snapshot.empty && (overwrite || (programId !== 'one-off-ai' && programId !== 'custom-workout' ))) {
        logger.log(`Overwriting existing workout session for date: ${workoutDate.toISOString()}`);
    }

    const newSessionData = {
        userId,
        programId,
        workoutDate: Timestamp.fromDate(workoutDate),
        workoutTitle: workout.title,
        programType: deriveSessionProgramType(workout),
        startedAt: Timestamp.now(),
        finishedAt: null,
        notes: '',
        duration: duration || null,
        extendedExercises: ['one-off-ai', 'custom-workout'].includes(programId) ? workout.exercises : [],
        workoutDetails: workout,
        skipped: false,
    };

    if (!snapshot.empty && (overwrite || (programId !== 'one-off-ai' && programId !== 'custom-workout'))) {
        const docToUpdate = snapshot.docs[0];
        await updateDoc(docToUpdate.ref, newSessionData);
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
        programType: deriveSessionProgramType(workout),
        startedAt: new Date(),
        notes: '',
        duration: newSessionData.duration,
        extendedExercises: newSessionData.extendedExercises,
        workoutDetails: newSessionData.workoutDetails,
        skipped: false,
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

/**
 * Links a Strava activity to a workout session, marking it as complete.
 * If a session for that day doesn't exist, it creates one.
 */
export async function linkStravaActivityToSession(sessionId: string, activity: StravaActivity): Promise<void> {
    const auth = await getAuthInstance();
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("User not authenticated.");

    let sessionRef;
    let existingNotes = '';

    if (sessionId) {
        sessionRef = doc(sessionsCollection, sessionId);
        const snap = await getDoc(sessionRef);
        if (!snap.exists()) throw new Error("Session not found.");
        existingNotes = snap.data().notes || '';
    } else {
        const activityDate = new Date(activity.start_date_local || activity.start_date);
        activityDate.setHours(0, 0, 0, 0);

        const q = query(
            sessionsCollection,
            where('userId', '==', userId),
            where('workoutDate', '==', Timestamp.fromDate(activityDate)),
            limit(1),
        );
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
            sessionRef = snapshot.docs[0].ref;
            existingNotes = snapshot.docs[0].data().notes || '';
        } else {
            const activityDate2 = new Date(activity.start_date_local || activity.start_date);
            activityDate2.setHours(0, 0, 0, 0);
            const newSessionData = {
                userId,
                programId: 'strava-linked',
                workoutDate: Timestamp.fromDate(activityDate2),
                workoutTitle: activity.name,
                programType: (activity.sport_type.toLowerCase().includes('run') ? 'running' : 'hyrox') as ProgramType,
                startedAt: Timestamp.fromDate(new Date(activity.start_date)),
            };
            const docRef = await addDoc(sessionsCollection, newSessionData);
            sessionRef = docRef;
        }
    }

    const updateData = {
        finishedAt: Timestamp.fromDate(new Date(activity.start_date)),
        stravaId: activity.id.toString(),
        uploadedToStrava: false,
        stravaUploadedAt: Timestamp.now(),
        notes: existingNotes
            ? `${existingNotes}\n\nLinked Strava activity: ${activity.name}.`
            : `Linked Strava activity: ${activity.name}.`,
        stravaActivity: {
            distance: activity.distance,
            moving_time: activity.moving_time,
            name: activity.name,
        },
        ...(sessionId ? {} : { workoutTitle: activity.name }),
        skipped: false,
    };
    await updateDoc(sessionRef, updateData);
}
