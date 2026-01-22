// src/services/program-service-client.ts
// This file contains functions for client-side components. NO 'use server' here.
import { collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Program } from '@/models/types';

const programsCollectionClient = collection(db, 'programs');

export async function getProgramClient(programId: string): Promise<Program | null> {
    // 1. Try fetching from global programs
    const docRef = doc(db, 'programs', programId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Program;
    }
    
    // 2. If not found, it might be a personal program. We can't search subcollections easily without userId.
    // However, usually we have the context.
    // For now, if we pass a "path" or handle it in the caller, it's better.
    // But let's assume we might need to look up personal programs if we store their ID in user.programId.
    // This is tricky because `user.programId` doesn't say WHERE it lives.
    
    // STRATEGY: We will assume the caller knows if it's personal or not, OR we try to find it.
    // Actually, for this function, let's keep it focused on global programs for now, 
    // and add a specific function for personal ones.
    
    return null;
}

export async function getPersonalProgram(userId: string, programId: string): Promise<Program | null> {
    const docRef = doc(db, `users/${userId}/personalPrograms`, programId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Program;
    }
    return null;
}

export async function getAllPrograms(): Promise<Program[]> {
    const snapshot = await getDocs(programsCollectionClient);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
}

export async function getPersonalPrograms(userId: string): Promise<Program[]> {
    const personalCollection = collection(db, `users/${userId}/personalPrograms`);
    const snapshot = await getDocs(personalCollection);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Program));
}

export async function createProgram(data: Omit<Program, 'id'>): Promise<string> {
    const docRef = await addDoc(programsCollectionClient, data);
    return docRef.id;
}

export async function savePersonalProgram(userId: string, data: Omit<Program, 'id'>): Promise<string> {
    const personalCollection = collection(db, `users/${userId}/personalPrograms`);
    const docRef = await addDoc(personalCollection, data);
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

export async function deletePersonalProgram(userId: string, programId: string): Promise<void> {
    const docRef = doc(db, `users/${userId}/personalPrograms`, programId);
    await deleteDoc(docRef);
}
