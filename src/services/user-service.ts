
// src/services/user-service.ts
'use server';

import { Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin'; // Use Admin SDK for server-side
import { getAuth } from 'firebase-admin/auth';
import type { User, SubscriptionStatus } from '@/models/types';

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
        
        // Correctly handle the nested expiresAt timestamp within the strava object
        const stravaData = data.strava ? { 
            ...data.strava, 
            expiresAt: safeToDate(data.strava.expiresAt)! 
        } : undefined;

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
            strava: stravaData,
            lastStravaSync: safeToDate(data.lastStravaSync),
            isAdmin: data.isAdmin || false,
            subscriptionStatus: data.subscriptionStatus || 'trial',
            stripeCustomerId: data.stripeCustomerId,
            subscriptionId: data.subscriptionId,
            trialStartDate: safeToDate(data.trialStartDate),
            cancel_at_period_end: data.cancel_at_period_end,
            cancellation_effective_date: safeToDate(data.cancellation_effective_date),
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

    // Convert any Date objects to Firestore Timestamps before updating
    if (data.startDate) {
        dataToUpdate.startDate = Timestamp.fromDate(data.startDate);
    }
    if (data.trialStartDate) {
        dataToUpdate.trialStartDate = Timestamp.fromDate(data.trialStartDate);
    }
    if (data.strava?.expiresAt) {
        // Ensure nested objects are handled correctly
        dataToUpdate.strava = {
            ...data.strava,
            expiresAt: Timestamp.fromDate(data.strava.expiresAt)
        };
    }
    if (data.lastStravaSync) {
        dataToUpdate.lastStravaSync = Timestamp.fromDate(data.lastStravaSync);
    }
    if (data.cancellation_effective_date) {
        dataToUpdate.cancellation_effective_date = Timestamp.fromDate(data.cancellation_effective_date);
    }


    await userRef.update(dataToUpdate);
}

// Helper function to determine correct subscription status
function determineSubscriptionStatus(
    storedStatus: string | undefined,
    stripeCustomerId: string | undefined,
    subscriptionId: string | undefined | null,
    trialStartDate: Date | undefined,
    cancel_at_period_end: boolean | undefined,
    cancellation_effective_date: Date | undefined
): SubscriptionStatus {
    const now = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(now.getMonth() - 1);

    // If user has an active Stripe subscription, they are active
    if (stripeCustomerId && subscriptionId && subscriptionId !== null) {
        // Check if subscription is cancelled but still active
        if (cancel_at_period_end && cancellation_effective_date) {
            return now > cancellation_effective_date ? 'canceled' : 'active';
        }
        return storedStatus === 'active' ? 'active' : (storedStatus as SubscriptionStatus) || 'active';
    }

    // If user has no Stripe data and signed up less than 1 month ago, they are trial
    if (trialStartDate && trialStartDate > oneMonthAgo) {
        return 'trial';
    }

    // If user signed up more than 1 month ago and has no Stripe subscription, they are expired
    if (trialStartDate && trialStartDate <= oneMonthAgo && (!stripeCustomerId || !subscriptionId)) {
        return 'expired';
    }

    // Fallback to stored status or default to trial
    return (storedStatus as SubscriptionStatus) || 'trial';
}

// SERVER-SIDE function to get all users (admin only)
export async function getAllUsers(): Promise<User[]> {
    console.log('🔄 getAllUsers: Starting to fetch all users...');

    const adminDb = getAdminDb();
    const usersCollection = adminDb.collection('users');

    console.log('📁 Collection reference created for "users"');

    let snapshot;

    try {
        // Try to order by email first
        console.log('🔄 Attempting to order by email...');
        snapshot = await usersCollection.orderBy('email').get();
        console.log('✅ Email ordering successful');
    } catch (emailOrderError: any) {
        console.log('⚠️ Email ordering failed:', emailOrderError.message);
        console.log('🔄 Falling back to unordered query...');

        // Fallback to unordered query
        snapshot = await usersCollection.get();
        console.log('✅ Unordered query successful');
    }

    console.log('📊 Query executed, found', snapshot.docs.length, 'documents');

    if (snapshot.docs.length === 0) {
        console.log('⚠️ No documents found in users collection');
        console.log('🔍 Double-checking with fresh query...');

        const allSnapshot = await usersCollection.get();
        console.log('📊 Fresh query found', allSnapshot.docs.length, 'documents');

        if (allSnapshot.docs.length > 0) {
            console.log('📋 First document sample:', allSnapshot.docs[0].data());
        }
    }

    const users = snapshot.docs.map(doc => {
        const data = doc.data();

        console.log('📄 Processing document:', doc.id, 'data keys:', Object.keys(data));

        // Correctly handle the nested expiresAt timestamp within the strava object
        const stravaData = data.strava ? {
            ...data.strava,
            expiresAt: safeToDate(data.strava.expiresAt)!
        } : undefined;

        const trialStartDate = safeToDate(data.trialStartDate);

        // Determine the correct subscription status based on business logic
        const subscriptionStatus = determineSubscriptionStatus(
            data.subscriptionStatus,
            data.stripeCustomerId,
            data.subscriptionId,
            trialStartDate,
            data.cancel_at_period_end,
            safeToDate(data.cancellation_effective_date)
        );

        const user: User = {
            id: doc.id,
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
            strava: stravaData,
            lastStravaSync: safeToDate(data.lastStravaSync),
            isAdmin: data.isAdmin || false,
            subscriptionStatus,
            stripeCustomerId: data.stripeCustomerId,
            subscriptionId: data.subscriptionId,
            trialStartDate,
            cancel_at_period_end: data.cancel_at_period_end,
            cancellation_effective_date: safeToDate(data.cancellation_effective_date),
        };

        console.log('👤 Processed user:', {
            id: user.id,
            email: user.email,
            isAdmin: user.isAdmin,
            subscriptionStatus: user.subscriptionStatus
        });

        return user;
    });

    console.log('🔍 Pre-filter user count:', users.length);

    const result = users.filter(user => {
        const hasEmail = !!(user.email && user.email.trim());
        console.log('🔍 Filtering user:', {
            id: user.id,
            email: user.email,
            emailType: typeof user.email,
            emailLength: user.email?.length,
            hasEmail: hasEmail,
            willInclude: hasEmail
        });
        return hasEmail; // Only return users with valid email addresses
    });

    console.log('✅ getAllUsers: Pre-filter:', users.length, 'Post-filter:', result.length, 'users');

    // If filtering removes all users, let's see what's wrong
    if (users.length > 0 && result.length === 0) {
        console.log('⚠️ All users were filtered out! Sample user emails:');
        users.slice(0, 3).forEach((user, index) => {
            console.log(`User ${index + 1}:`, {
                id: user.id,
                email: user.email,
                emailType: typeof user.email,
                emailValue: JSON.stringify(user.email)
            });
        });

        // Return all users without filtering to debug
        console.log('🚨 Returning unfiltered users for debugging');
        return users;
    }

    return result;
}
