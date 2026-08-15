// src/services/program-service.ts
'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { Program } from '@/models/types';

// SERVER-SIDE function using Admin SDK
//
// Programs live in two collections that share an id space: `programs` (public)
// and `customPrograms` (assigned to specific athletes). Callers only have a
// program id — from user.programId or a workout session — so both are checked.
// The Admin SDK bypasses Firestore rules, so access is the caller's business:
// every call site here resolves the program the athlete is already training on.
export async function getProgram(programId: string): Promise<Program | null> {
    const adminDb = getAdminDb();

    const docSnap = await adminDb.collection('programs').doc(programId).get();
    if (docSnap.exists) {
        const data = docSnap.data();
        if (data) {
            return { id: docSnap.id, ...data } as Program;
        }
    }

    const customSnap = await adminDb.collection('customPrograms').doc(programId).get();
    if (customSnap.exists) {
        const data = customSnap.data();
        if (data) {
            return { id: customSnap.id, ...data } as Program;
        }
    }

    return null;
}
