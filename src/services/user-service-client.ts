
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
            lastStravaSync: data.lastStravaSync instanceof Timestamp ? data.lastStravaSync.toDate() : undefined,
            customProgram: data.customProgram || null,
            isAdmin: data.isAdmin || false,
            // Fallback for subscription status if it's missing
            subscriptionStatus: data.subscriptionStatus || 'trial',
            stripeCustomerId: data.stripeCustomerId,
            subscriptionId: data.subscriptionId,
            trialStartDate: trialStartDate,
            cancel_at_period_end: data.cancel_at_period_end,
            cancellation_effective_date: data.cancellation_effective_date instanceof Timestamp ? data.cancellation_effective_date.toDate() : undefined,
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
        customProgram: null,
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
    if (data.lastStravaSync) {
        dataToUpdate.lastStravaSync = Timestamp.fromDate(data.lastStravaSync);
    }
    
    await updateDoc(userRef, dataToUpdate);
}

// Helper function to wait for auth state
async function waitForAuth(auth: any, timeoutMs = 10000): Promise<any> {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            unsubscribe();
            reject(new Error('Authentication timeout'));
        }, timeoutMs);

        const unsubscribe = auth.onAuthStateChanged((user: any) => {
            if (user) {
                clearTimeout(timeout);
                unsubscribe();
                resolve(user);
            }
        });

        // If user is already available, resolve immediately
        if (auth.currentUser) {
            clearTimeout(timeout);
            unsubscribe();
            resolve(auth.currentUser);
        }
    });
}

// Admin function to get all users
export async function getAllUsersClient(): Promise<User[]> {
    console.log('🔄 Starting getAllUsersClient...');

    try {
        // First ensure we have a valid session cookie
        const { getAuthInstance } = await import('@/lib/firebase');
        const auth = await getAuthInstance();

        console.log('🔐 Auth instance created, checking current user...');
        console.log('👤 Current user exists:', !!auth.currentUser);

        let currentUser = auth.currentUser;

        // If no current user, wait for auth state to be ready
        if (!currentUser) {
            console.log('⏳ No current user, waiting for auth state...');
            try {
                currentUser = await waitForAuth(auth, 5000); // 5 second timeout
                console.log('✅ Auth state resolved, user found:', !!currentUser);
            } catch (authError) {
                console.error('❌ Auth state timeout or error:', authError);
                throw new Error('Please log in to access admin features');
            }
        }

        // Create session cookie if needed
        console.log('🔑 Getting fresh ID token...');
        const idToken = await currentUser.getIdToken(true);

        console.log('🍪 Creating session cookie...');
        const sessionResponse = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
            credentials: 'include',
        });

        if (!sessionResponse.ok) {
            console.error('❌ Session creation failed:', sessionResponse.status);
            throw new Error('Failed to create authentication session');
        }

        console.log('✅ Session cookie created successfully');

        // First try the cookie-based approach
        console.log('🔄 Making API call to /api/admin/users (cookie-based)...');
        let response = await fetch('/api/admin/users', {
            method: 'GET',
            credentials: 'include',
        });

        console.log('📡 API response status:', response.status, response.statusText);

        // If cookie-based fails, try the alternative approach with direct token
        if (!response.ok && response.status === 401) {
            console.log('🔄 Cookie approach failed, trying alternative with direct token...');
            response = await fetch('/api/admin/users-alt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
                credentials: 'include',
            });
            console.log('📡 Alternative API response status:', response.status, response.statusText);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('❌ API error response:', errorData);
            throw new Error(errorData.error || 'Failed to fetch users');
        }

        const userData = await response.json();
        console.log('📊 Received user data:', {
            isArray: Array.isArray(userData),
            length: userData?.length,
            firstUser: userData?.[0] ? {
                id: userData[0].id,
                email: userData[0].email,
                hasRequiredFields: !!(userData[0].email && userData[0].experience && userData[0].goal)
            } : null
        });

        return userData;

    } catch (error) {
        console.error('❌ getAllUsersClient error:', error);
        throw error;
    }
}
