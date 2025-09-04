
// src/services/stripe-service.ts
'use server';

import Stripe from 'stripe';
import { headers } from 'next/headers';
import { getUser, updateUserAdmin } from './user-service';
import { getAdminDb } from '@/lib/firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import type { User } from '@/models/types';


// Ensure environment variables are loaded
if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set in environment variables.');
}
if (!process.env.NEXT_PUBLIC_APP_URL) {
    throw new Error('NEXT_PUBLIC_APP_URL is not set in environment variables.');
}
if (!process.env.STRIPE_PRICE_ID) {
    throw new Error('STRIPE_PRICE_ID is not set in environment variables.');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-06-20',
});

/**
 * Creates a Stripe Checkout session for a user to subscribe.
 * @param userId - The ID of the user in Firebase.
 * @returns An object containing the URL to the checkout session.
 */
export async function createCheckoutSession(userId: string): Promise<{ url: string | null }> {
    try {
        // Configuration validation
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;
        if (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_') || process.env.STRIPE_SECRET_KEY.startsWith('rk_live_')) {
            if (appUrl.includes('localhost')) {
                throw new Error('Configuration error: You are using a live Stripe key with a localhost URL. NEXT_PUBLIC_APP_URL must be set to your public production URL in a live environment.');
            }
        }
        
        // This is a more robust way to ensure the user document exists.
        const adminDb = getAdminDb();
        const userRef = adminDb.collection('users').doc(userId);
        let userSnap = await userRef.get();
        
        if (!userSnap.exists) {
            console.warn(`User document for ${userId} not found. Creating it now.`);
            const authUser = await getAuth().getUser(userId);
            if (!authUser.email) throw new Error('User email not found in Firebase Auth.');

            const newUser: Omit<User, 'id'> = {
                email: authUser.email,
                firstName: '',
                lastName: '',
                experience: 'beginner',
                frequency: '3',
                goal: 'hybrid',
                trialStartDate: new Date(),
                subscriptionStatus: 'trial',
            };
            await userRef.set(newUser);
            userSnap = await userRef.get(); // Re-fetch the snapshot after creation
        }

        const user = { id: userSnap.id, ...userSnap.data() } as User;
        
        if (!user) {
            throw new Error(`User with ID ${userId} could not be found or created.`);
        }

        let customerId = user.stripeCustomerId;

        // Create a new Stripe customer if one doesn't exist
        if (!customerId) {
            try {
                const customer = await stripe.customers.create({
                    email: user.email,
                    name: `${user.firstName} ${user.lastName}`,
                    metadata: {
                        firebaseUID: userId,
                    },
                });
                customerId = customer.id;
                await updateUserAdmin(userId, { stripeCustomerId: customerId });
            } catch (err: any) {
                console.error('Error creating Stripe customer:', err);
                throw new Error(`Failed to create Stripe customer: ${err.message}`);
            }
        }
        
        const priceId = process.env.STRIPE_PRICE_ID;

        try {
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                mode: 'subscription',
                customer: customerId,
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                success_url: `${appUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${appUrl}/subscription`,
            });

            return { url: session.url };
        } catch (err: any) {
            console.error('Error creating Stripe checkout session:', err);
            throw new Error(`Failed to create Stripe checkout session: ${err.message}`);
        }

    } catch (error: any) {
        // This outer catch will now catch the more specific errors thrown from the inner blocks.
        console.error('An error occurred in createCheckoutSession:', error);
        
        // Add specific check for the access token error
        if (error.message && error.message.includes('Could not refresh access token')) {
            throw new Error('Could not authenticate with Firebase. Please check server permissions.');
        }

        // Re-throw the specific error message
        throw new Error(error.message);
    }
}
