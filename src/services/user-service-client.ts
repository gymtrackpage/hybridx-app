
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
        // Fallback for trial start date if it's missing
        const trialStartDate = data.trialStartDate instanceof Timestamp 
            ? data.trialStartDate.toDate() 
            : new Date();

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
            runningProfile: data.runningProfile || { benchmarkPaces: {} },
            strava: data.strava ? { ...data.strava, expiresAt: data.strava.expiresAt.toDate() } : undefined,
            isAdmin: data.isAdmin || false,
            // Fallback for subscription status if it's missing
            subscriptionStatus: data.subscriptionStatus || 'trial',
            stripeCustomerId: data.stripeCustomerId,
            subscriptionId: data.subscriptionId,
            trialStartDate: trialStartDate,
        };
        return user;
    }
    return null;
}

export async function createUser(userId: string, data: Omit<User, 'id' | 'startDate' | 'programId' | 'personalRecords'>): Promise<User> {
    const usersCollection = collection(db, 'users');
    const userRef = doc(usersCollection, userId);
    const trialStartDate = new Date();
    
    // This is the data that will be saved to Firestore.
    // It correctly includes the subscription status and trial start date.
    const userDataToSet = {
        ...data,
        programId: null,
        startDate: null,
        personalRecords: {},
        runningProfile: { benchmarkPaces: {} },
        strava: null,
        isAdmin: false,
        subscriptionStatus: 'trial',
        stripeCustomerId: null,
        subscriptionId: null,
        trialStartDate: Timestamp.fromDate(trialStartDate),
    };
    await setDoc(userRef, userDataToSet);

    // This is the user object returned to the application after creation.
    const createdUser: User = {
        id: userId,
        ...data,
        personalRecords: {},
        runningProfile: { benchmarkPaces: {} },
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
    if (data.strava?.expiresAt) {
        dataToUpdate.strava.expiresAt = Timestamp.fromDate(data.strava.expiresAt);
    }
    
    await updateDoc(userRef, dataToUpdate);
}
