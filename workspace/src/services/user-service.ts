
// src/services/user-service.ts
'use server';

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin'; // Use Admin SDK for server-side
import { getAuth } from 'firebase-admin/auth';
import type { User } from '@/models/types';

// Helper function to safely convert Firestore timestamp to Date
function safeToDate(timestamp: any): Date | undefined {
  if (!timestamp) return undefined;
  if (timestamp instanceof Date) return timestamp;
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (typeof timestamp === 'string' || typeof timestamp === 'number') return new Date(timestamp);
  return undefined;
}


// SERVER-SIDE function using Admin SDK
export async function getUser(userId: string): Promise<User | null> {
    const adminDb = getAdminDb();
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
            startDate: safeToDate(data.startDate),
            personalRecords: data.personalRecords || {},
            runningProfile: data.runningProfile || { benchmarkPaces: {} },
            strava: data.strava ? { ...data.strava, expiresAt: safeToDate(data.strava.expiresAt)! } : undefined,
            lastStravaSync: safeToDate(data.lastStravaSync),
            isAdmin: data.isAdmin || false,
            subscriptionStatus: data.subscriptionStatus || 'trial',
            stripeCustomerId: data.stripeCustomerId,
            subscriptionId: data.subscriptionId,
            trialStartDate: safeToDate(data.trialStartDate),
        };
        return user;
    } else {
        // The user exists in Auth but not in Firestore. Let's create their document.
        console.warn(`User document not found for UID: ${userId}. Creating one now.`);
        try {
            const authUser = await getAuth().getUser(userId);
            if (!authUser.email) {
                console.error(`User ${userId} does not have an email in Firebase Auth.`);
                return null;
            }

            const trialStartDate = new Date();
            const newUser: Omit<User, 'id'> = {
                email: authUser.email,
                firstName: '', // Default value, user can update in profile
                lastName: '',  // Default value, user can update in profile
                experience: 'beginner',
                frequency: '3',
                goal: 'hybrid',
                programId: null,
                startDate: undefined,
                personalRecords: {},
                runningProfile: { benchmarkPaces: {} },
                strava: undefined,
                isAdmin: false,
                subscriptionStatus: 'trial',
                trialStartDate: trialStartDate,
            };

            await docRef.set(newUser);
            console.log(`Successfully created Firestore document for user ${userId}`);
            
            return {
                id: userId,
                ...newUser,
            };

        } catch (error) {
            console.error(`Failed to create Firestore document for user ${userId}:`, error);
            return null;
        }
    }
}

// SERVER-SIDE update function
export async function updateUserAdmin(userId: string, data: Partial<Omit<User, 'id'>>): Promise<void> {
    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(userId);
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
    if (data.lastStravaSync) {
        dataToUpdate.lastStravaSync = Timestamp.fromDate(data.lastStravaSync);
    }

    await userRef.update(dataToUpdate);
}
