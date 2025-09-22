// src/services/session-service-client.ts
// This file contains functions for client-side components. NO 'use server' here.

import { collection, doc, getDocs, addDoc, updateDoc, query, where, Timestamp, limit, orderBy, getDoc } from 'firebase/firestore';
import { db, getAuthInstance } from '@/lib/firebase';
import type { WorkoutSession, Workout, RunningWorkout, Exercise, ProgramType } from '@/models/types';
import type { StravaActivity } from './strava-service';

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
        skipped: data.skipped || false,
        workoutDetails: data.workoutDetails,
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
        // Exclude one-off sessions from this specific query
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

    const workout: Workout = {
        title,
        programType: 'hyrox',
        day: 0,
        exercises: [{ name: 'Custom Activity', details: description }],
    };
    
    // For custom workouts, we always overwrite any existing session for today
    return getOrCreateWorkoutSession(userId, 'custom-workout', today, workout, true, duration);
}


export async function getOrCreateWorkoutSession(userId: string, programId: string, workoutDate: Date, workout: Workout | RunningWorkout, overwrite: boolean = false, duration?: string): Promise<any> {
    const q = query(
        sessionsCollection, 
        where('userId', '==', userId), 
        where('workoutDate', '==', Timestamp.fromDate(workoutDate)),
        limit(1)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty && !overwrite) {
        // If a session exists and we are not overwriting, return it, unless it's a one-off/custom session and a program session is being created
        const existingSession = fromFirestore(snapshot.docs[0]);
        if (['one-off-ai', 'custom-workout'].includes(existingSession.programId) && !['one-off-ai', 'custom-workout'].includes(programId)) {
             // We are creating a program session, it should take precedence
        } else {
            return existingSession;
        }
    }

    if (!snapshot.empty && (overwrite || (programId !== 'one-off-ai' && programId !== 'custom-workout' ))) {
        console.log(`Overwriting existing workout session for date: ${workoutDate.toISOString()}`);
    }

    const initialCompleted: { [key: string]: boolean } = {};
    const items = workout.programType === 'running' 
        ? (workout as RunningWorkout).runs 
        : [...((workout as Workout).exercises || [])];
        
    items.forEach(item => {
        const key = workout.programType === 'running' ? (item as any).description : (item as any).name;
        initialCompleted[key] = false;
    });

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
        duration: duration || null,
        extendedExercises: ['one-off-ai', 'custom-workout'].includes(programId) ? (workout as Workout).exercises : [],
        workoutDetails: ['one-off-ai', 'custom-workout'].includes(programId) ? workout : null,
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
        programType: workout.programType || 'hyrox',
        startedAt: new Date(),
        completedItems: initialCompleted,
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
    
    let sessionRef;
    let sessionData: WorkoutSession;

    const auth = await getAuthInstance();
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error("User not authenticated.");

    const activityDate = new Date(activity.start_date_local);
    activityDate.setHours(0,0,0,0);

    // Check for an existing session on that date
    const q = query(sessionsCollection, where('userId', '==', userId), where('workoutDate', '==', Timestamp.fromDate(activityDate)), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        sessionRef = snapshot.docs[0].ref;
        sessionData = fromFirestore(snapshot.docs[0]);
    } else {
        // If no session exists, create a new one based on the Strava activity
        const newSessionData = {
            userId,
            programId: 'strava-linked',
            workoutDate: Timestamp.fromDate(activityDate),
            workoutTitle: activity.name,
            programType: activity.sport_type.toLowerCase().includes('run') ? 'running' : 'hyrox',
            startedAt: Timestamp.fromDate(new Date(activity.start_date)),
            completedItems: { [activity.name]: true },
        };
        const docRef = await addDoc(sessionsCollection, newSessionData);
        sessionRef = docRef;
        sessionData = { id: docRef.id, ...newSessionData, workoutDate: activityDate, startedAt: new Date(activity.start_date) };
    }
    
    // Mark all original exercises as complete
    const completedItems: { [key: string]: boolean } = { ...sessionData.completedItems };
   if (sessionData.workoutDetails) {
        const items = sessionData.workoutDetails.programType === 'running' ? sessionData.workoutDetails.runs : sessionData.workoutDetails.exercises;
        items.forEach((item: any) => {
            completedItems[item.name || item.description] = true;
        });
    }

    const updateData = {
        finishedAt: Timestamp.fromDate(new Date(activity.start_date)),
        stravaId: activity.id.toString(),
        uploadedToStrava: false, // It's linked, not uploaded from our app
        stravaUploadedAt: Timestamp.now(),
        notes: sessionData.notes ? `${sessionData.notes}\n\nCompleted via Strava: ${activity.name}.` : `Completed via Strava: ${activity.name}.`,
        completedItems,
        stravaActivity: {
            distance: activity.distance,
            moving_time: activity.moving_time,
            name: activity.name
        },
        workoutTitle: activity.name, // Overwrite with Strava activity name
        skipped: false,
    };
    await updateDoc(sessionRef, updateData);
}
