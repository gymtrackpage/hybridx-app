// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { getAdminDb } from '@/lib/firebase-admin';
import type { User, SubscriptionStatus } from '@/models/types';
import { Timestamp } from 'firebase-admin/firestore';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const buf = await req.text();
  const sig = headers().get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        // Only handle for subscriptions, not one-off payments
        if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            await handleSubscriptionChange(subscription);
        }
        break;
      
      case 'invoice.payment_failed':
          const failedInvoice = event.data.object as Stripe.Invoice;
          if (failedInvoice.subscription) {
              const subscription = await stripe.subscriptions.retrieve(failedInvoice.subscription as string);
              await handleSubscriptionChange(subscription);
          }
        break;
      
      default:
        // console.log(`Unhandled event type: ${event.type}`);
    }

    return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const firebaseUID = customer.metadata.firebaseUID;

    if (!firebaseUID) {
        console.error(`No firebaseUID found for customer ${customerId}`);
        return;
    }
    
    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(firebaseUID);
    
    const newStatus = subscription.status as SubscriptionStatus;
    
    const userData: Partial<User> = {
        subscriptionId: subscription.id,
        subscriptionStatus: newStatus,
    };
    
    // For new subscriptions, ensure the trial status is overridden.
    if (subscription.status === 'active') {
        userData.subscriptionStatus = 'active';
    }

    await userRef.update(userData as { [key: string]: any });
    console.log(`Updated subscription for user ${firebaseUID} to status ${newStatus}`);
}
