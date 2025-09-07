
// src/services/user-service.ts
'use server';

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin'; // Use Admin SDK for server-side
import { getAuth } from 'firebase-admin/auth';
import type { User } from '@/models/types';

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
            startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : undefined,
            personalRecords: data.personalRecords || {},
            runningProfile: data.runningProfile || { benchmarkPaces: {} },
            isAdmin: data.isAdmin || false,
            subscriptionStatus: data.subscriptionStatus || 'trial',
            stripeCustomerId: data.stripeCustomerId,
            subscriptionId: data.subscriptionId,
            trialStartDate: data.trialStartDate instanceof Timestamp ? data.trialStartDate.toDate() : undefined,
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

    await userRef.update(dataToUpdate);
}
