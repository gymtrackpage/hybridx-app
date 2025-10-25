
// src/app/api/stripe/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { headers } from 'next/headers';
import { getAdminDb } from '@/lib/firebase-admin';
import type { User, SubscriptionStatus } from '@/models/types';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const buf = await req.text();
  const headersList = await headers();
  const sig = headersList.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(buf, sig, webhookSecret);
    console.log(`[Stripe Webhook] Received event: ${event.type}`);
  } catch (err: any) {
    console.error(`[Stripe Webhook] Signature verification failed: ${err.message}`);
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionChange(subscription, event.type);
        break;

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
            const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
            await handleSubscriptionChange(subscription, 'invoice.payment_succeeded');
        }
        break;
      
      case 'invoice.payment_failed':
          const failedInvoice = event.data.object as Stripe.Invoice;
          if (failedInvoice.subscription) {
              const subscription = await stripe.subscriptions.retrieve(failedInvoice.subscription as string);
              await handleSubscriptionChange(subscription, 'invoice.payment_failed');
          }
        break;
      
      default:
        // console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
    }

    return new NextResponse(JSON.stringify({ received: true }), { status: 200 });
  } catch (error: any) {
    console.error(`[Stripe Webhook] Error processing webhook for event ${event.type}:`, error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

async function handleSubscriptionChange(subscription: Stripe.Subscription, eventType: string) {
    const customerId = subscription.customer as string;
    
    console.log(`[Stripe Webhook] Handling subscription change for Stripe Customer ID: ${customerId}`);
    console.log(`[Stripe Webhook] Subscription status: ${subscription.status}`);
    console.log(`[Stripe Webhook] Subscription ID: ${subscription.id}`);

    const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
    const firebaseUID = customer.metadata.firebaseUID;

    if (!firebaseUID) {
        console.error(`[Stripe Webhook] No firebaseUID found in metadata for customer ${customerId}`);
        return;
    }
    
    console.log(`[Stripe Webhook] Found Firebase UID: ${firebaseUID}`);

    const adminDb = getAdminDb();
    const userRef = adminDb.collection('users').doc(firebaseUID);
    
    const newStatus = subscription.status as SubscriptionStatus;
    
    const userData: Partial<User> = {
        subscriptionId: subscription.id,
        subscriptionStatus: newStatus,
        cancel_at_period_end: subscription.cancel_at_period_end,
    };
    
    // If the subscription is active but collection is paused, set our internal status to 'paused'
    if (subscription.status === 'active' && subscription.pause_collection) {
        userData.subscriptionStatus = 'paused';
    }

    // Stripe uses 'canceled' for subscriptions that are terminated (e.g., after non-payment).
    // We will map this to our 'expired' state.
    if (subscription.status === 'canceled') {
        userData.subscriptionStatus = 'expired';
    }

    // When a subscription is truly deleted/cancelled immediately (rare)
    if (eventType === 'customer.subscription.deleted') {
        userData.subscriptionStatus = 'expired';
        userData.subscriptionId = null;
    }


    await userRef.update(userData as { [key: string]: any });
    console.log(`[Stripe Webhook] Successfully updated subscription for user ${firebaseUID} to status ${userData.subscriptionStatus}`);
}
