// src/services/user-service.ts
'use server';

import { collection, doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase-admin'; // Use Admin SDK for server-side
import { db } from '@/lib/firebase'; // Keep client SDK for client-side
import type { User } from '@/models/types';

// SERVER-SIDE function using Admin SDK
export async function getUser(userId: string): Promise<User | null> {
    const usersCollection = adminDb.collection('users');
    const docRef = usersCollection.doc(userId);
    const docSnap = await docRef.get();

    if (docSnap.exists) {
        const data = docSnap.data();
        if (!data) return null;
        
        const user: User = {
            id: docSnap.id,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            experience: data.experience,
            frequency: data.frequency,
            goal: data.goal,
            programId: data.programId,
            startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : undefined,
            personalRecords: data.personalRecords || {},
        };
        return user;
    }
    return null;
}

// CLIENT-SIDE function using Client SDK
export async function createUser(userId: string, data: Omit<User, 'id' | 'startDate' | 'programId' | 'personalRecords'>): Promise<User> {
    const usersCollection = collection(db, 'users');
    const userRef = doc(usersCollection, userId);
    const userData = {
        ...data,
        programId: null,
        startDate: null,
        personalRecords: {},
    };
    await setDoc(userRef, userData);
    const createdUser: User = { 
        id: userId, 
        ...data, 
        personalRecords: {}
    };
    return createdUser;
}

// CLIENT-SIDE function using Client SDK
export async function updateUser(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
    const usersCollection = collection(db, 'users');
    const userRef = doc(usersCollection, userId);
    const dataToUpdate: { [key: string]: any } = { ...data };

    if (data.startDate) {
        dataToUpdate.startDate = Timestamp.fromDate(data.startDate);
    }
    
    await updateDoc(userRef, dataToUpdate);
}
