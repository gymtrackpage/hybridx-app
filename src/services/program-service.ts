// src/services/program-service.ts
'use server';

import { getAdminDb } from '@/lib/firebase-admin';
import type { Program } from '@/models/types';

// SERVER-SIDE function using Admin SDK
export async function getProgram(programId: string): Promise<Program | null> {
    const adminDb = getAdminDb();
    const programsCollection = adminDb.collection('programs');
    const docRef = programsCollection.doc(programId);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        const data = docSnap.data();
        if (data) {
            return { id: docSnap.id, ...data } as Program;
        }
    }
    return null;
}
