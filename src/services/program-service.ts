// src/services/program-service.ts
'use server';

import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
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
