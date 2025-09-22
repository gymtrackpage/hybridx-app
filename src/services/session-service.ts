// src/services/session-service.ts
'use server';

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { WorkoutSession, Workout, RunningWorkout } from '@/models/types';
import { z } from 'zod';

function fromFirestore(doc: any): WorkoutSession {
    const data = doc.data();
    return {
        id: doc.id,
        userId: data.userId,
        programId: data.programId,
        workoutDate: data.workoutDate.toDate(),
        workoutTitle: data.workoutTitle,
        programType: data.programType,
        startedAt: data.startedAt.toDate(),
        finishedAt: data.finishedAt ? data.finishedAt.toDate() : undefined,
        completedItems: data.completedItems,
        notes: data.notes || '',
        extendedExercises: data.extendedExercises,
        skipped: data.skipped,
        workoutDetails: data.workoutDetails,
        stravaId: data.stravaId,
        uploadedToStrava: data.uploadedToStrava,
        stravaUploadedAt: data.stravaUploadedAt,
        stravaActivity: data.stravaActivity,
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
        completedItems: initialCompleted,
        finishedAt: null,
        notes: '',
        workoutTitle: workout.title,
        programType: workout.programType,
        workoutDetails: workout, // Store the full workout details
    };

    const docRef = await sessionsCollectionAdmin.add(newSessionData);
    
    return {
        id: docRef.id,
        userId,
        programId,
        workoutDate,
        workoutTitle: workout.title,
        programType: workout.programType,
        startedAt: new Date(),
        completedItems: initialCompleted,
        notes: '',
        workoutDetails: workout,
    };
}


const SwapWorkoutsInputSchema = z.object({
  userId: z.string(),
  programId: z.string(),
  date1: z.date(),
  workout1: z.any(), // Using any because Zod struggles with recursive types in zod-to-json-schema
  date2: z.date(),
  workout2: z.any().nullable(),
});

type SwapWorkoutsInput = z.infer<typeof SwapWorkoutsInputSchema>;

export async function swapWorkouts(input: SwapWorkoutsInput): Promise<void> {
    const adminDb = getAdminDb();
    const sessionsCollection = adminDb.collection('workoutSessions');
  
    const { userId, programId, date1, workout1, date2, workout2 } = SwapWorkoutsInputSchema.parse(input);
  
    const batch = adminDb.batch();
  
    // Update or create session for date1 (today) with workout1 (from source day)
    const session1Query = await sessionsCollection
      .where('userId', '==', userId)
      .where('workoutDate', '==', Timestamp.fromDate(date1))
      .limit(1)
      .get();
      
    if (session1Query.empty) {
      const newSession1Ref = sessionsCollection.doc();
      batch.set(newSession1Ref, createSessionData(userId, programId, date1, workout1));
    } else {
      batch.update(session1Query.docs[0].ref, createSessionData(userId, programId, date1, workout1, false));
    }
  
    // Update or create session for date2 (source day) with workout2 (from today)
    const session2Query = await sessionsCollection
      .where('userId', '==', userId)
      .where('workoutDate', '==', Timestamp.fromDate(date2))
      .limit(1)
      .get();
  
    if (session2Query.empty) {
      if (workout2) { // Only create a session if there was a workout
        const newSession2Ref = sessionsCollection.doc();
        batch.set(newSession2Ref, createSessionData(userId, programId, date2, workout2));
      }
    } else {
      if (workout2) {
        batch.update(session2Query.docs[0].ref, createSessionData(userId, programId, date2, workout2, false));
      } else {
        // If there was no workout for today, we can delete the source day's placeholder session
        batch.delete(session2Query.docs[0].ref);
      }
    }
  
    await batch.commit();
}
  
  // Helper to create session data for batch operations
function createSessionData(userId: string, programId: string, date: Date, workout: Workout | RunningWorkout, isNew: boolean = true) {
    const items = workout.programType === 'running'
        ? (workout as RunningWorkout).runs
        : (workout as Workout).exercises;

    const completedItems = items.reduce((acc, item) => {
        const key = (item as any).name || (item as any).description;
        acc[key] = false;
        return acc;
    }, {} as { [key: string]: boolean });
    
    const data: any = {
      userId,
      programId,
      workoutDate: Timestamp.fromDate(date),
      workoutTitle: workout.title,
      programType: workout.programType,
      completedItems,
      finishedAt: null,
      notes: '',
      workoutDetails: workout, // <-- CRITICAL FIX: Ensure full workout object is saved
      skipped: false,
    };

    if (isNew) {
        data.startedAt = Timestamp.now();
    }
    
    return data;
}
