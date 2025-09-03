
// src/services/stripe-service.ts
'use server';

import Stripe from 'stripe';
import { headers } from 'next/headers';
import { getUser, updateUserAdmin } from './user-service';

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
        const user = await getUser(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found.`);
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
                // Use the new server-side function to update the user
                await updateUserAdmin(userId, { stripeCustomerId: customerId });
            } catch (err: any) {
                console.error('Error creating Stripe customer:', err);
                throw new Error(`Failed to create Stripe customer: ${err.message}`);
            }
        }
        
        const priceId = process.env.STRIPE_PRICE_ID;
        const appUrl = process.env.NEXT_PUBLIC_APP_URL;

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
        // Re-throw the specific error message
        throw new Error(error.message);
    }
}
