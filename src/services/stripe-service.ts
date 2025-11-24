
import { logger } from '@/lib/logger';
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
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const stripeKey = process.env.STRIPE_SECRET_KEY;

        if (!stripeKey) {
            throw new Error('Configuration error: STRIPE_SECRET_KEY is not set');
        }

        if (stripeKey.startsWith('sk_live_') && (appUrl.includes('localhost') || appUrl.includes('127.0.0.1'))) {
           throw new Error('Configuration error: You are using a live Stripe key with a localhost URL. NEXT_PUBLIC_APP_URL must be set to your public production URL in a live environment.');
        }
        
        let user = await getUser(userId);
        
        if (!user) {
             const authUser = await getAuth().getUser(userId);
             if (!authUser || !authUser.email) {
                 throw new Error(`User with ID ${userId} could not be found in Firebase Auth.`);
             }
             const trialStartDate = new Date();
             const newUser: Omit<User, 'id'> = {
                email: authUser.email,
                firstName: '',
                lastName: '',
                experience: 'beginner',
                frequency: '3',
                goal: 'hybrid',
                subscriptionStatus: 'trial',
                trialStartDate,
             };
             await getAdminDb().collection('users').doc(userId).set(newUser);
             user = { id: userId, ...newUser };
             logger.log(`Created missing Firestore document for user ${userId} during checkout.`);
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
                logger.error('Error creating Stripe customer:', err);
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
            logger.error('Error creating Stripe checkout session:', err);
            throw new Error(`Failed to create Stripe checkout session: ${err.message}`);
        }

    } catch (error: any) {
        logger.error('An error occurred in createCheckoutSession:', error);
        
        if (error.message && error.message.includes('Could not refresh access token')) {
            throw new Error('Could not authenticate with Firebase. Please check server permissions.');
        }

        throw new Error(error.message);
    }
}

/**
 * Pauses a user's subscription.
 * @param userId - The ID of the user in Firebase.
 */
export async function pauseSubscription(userId: string): Promise<void> {
    const user = await getUser(userId);
    if (!user || !user.subscriptionId) {
        throw new Error('User or subscription not found.');
    }
    try {
        await stripe.subscriptions.update(user.subscriptionId, {
            pause_collection: {
                behavior: 'void',
            },
        });
        await updateUserAdmin(userId, { subscriptionStatus: 'paused' });
    } catch (error: any) {
        logger.error(`Failed to pause subscription for user ${userId}:`, error);
        throw new Error('Could not pause subscription. Please try again.');
    }
}

/**
 * Cancels a user's subscription at the end of the current billing period.
 * @param userId - The ID of the user in Firebase.
 */
export async function cancelSubscription(userId: string): Promise<void> {
    const user = await getUser(userId);
    if (!user || !user.subscriptionId) {
        throw new Error('User or subscription not found.');
    }
    try {
        const subscription = await stripe.subscriptions.update(user.subscriptionId, {
            cancel_at_period_end: true,
        });

        const cancelAt = subscription.cancel_at;
        await updateUserAdmin(userId, {
            subscriptionStatus: 'canceled',
            cancel_at_period_end: true,
            cancellation_effective_date: cancelAt ? new Date(cancelAt * 1000) : undefined
        });
    } catch (error: any) {
        logger.error(`Failed to cancel subscription for user ${userId}:`, error);
        throw new Error('Could not cancel subscription. Please try again.');
    }
}
