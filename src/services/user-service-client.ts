// src/services/user-service-client.ts
// This file contains functions for client-side components. NO 'use server' here.

import { collection, doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { User } from '@/models/types';

export async function getUserClient(userId: string): Promise<User | null> {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
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
            isAdmin: data.isAdmin || false,
            subscriptionStatus: data.subscriptionStatus || 'trial',
            stripeCustomerId: data.stripeCustomerId,
            subscriptionId: data.subscriptionId,
            trialStartDate: data.trialStartDate instanceof Timestamp ? data.trialStartDate.toDate() : undefined,
        };
        return user;
    }
    return null;
}

export async function createUser(userId: string, data: Omit<User, 'id' | 'startDate' | 'programId' | 'personalRecords'>): Promise<User> {
    const usersCollection = collection(db, 'users');
    const userRef = doc(usersCollection, userId);
    const trialStartDate = new Date();
    const userData = {
        ...data,
        programId: null,
        startDate: null,
        personalRecords: {},
        isAdmin: false,
        subscriptionStatus: 'trial',
        trialStartDate: Timestamp.fromDate(trialStartDate),
    };
    await setDoc(userRef, userData);
    const createdUser: User = { 
        id: userId, 
        ...data, 
        personalRecords: {},
        isAdmin: false,
        subscriptionStatus: 'trial',
        trialStartDate: trialStartDate,
    };
    return createdUser;
}

export async function updateUser(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
    const usersCollection = collection(db, 'users');
    const userRef = doc(usersCollection, userId);
    const dataToUpdate: { [key: string]: any } = { ...data };

    if (data.startDate) {
        dataToUpdate.startDate = Timestamp.fromDate(data.startDate);
    }
    if (data.trialStartDate) {
        dataToUpdate.trialStartDate = Timestamp.fromDate(data.trialStartDate);
    }
    
    await updateDoc(userRef, dataToUpdate);
}
