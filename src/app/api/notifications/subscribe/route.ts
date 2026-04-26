import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;

    const { subscription, platform } = await request.json();
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return NextResponse.json({ error: 'Invalid subscription object' }, { status: 400 });
    }

    const db = getAdminDb();

    // Use the endpoint as a stable document ID to prevent duplicates
    const docId = Buffer.from(subscription.endpoint).toString('base64').slice(0, 100);

    await db.collection('pushSubscriptions').doc(docId).set({
      userId,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      platform: platform ?? 'web',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Mark user as having push enabled
    await db.collection('users').doc(userId).update({
      pushEnabled: true,
      pushEnabledAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Subscribe error:', err);
    return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
  }
}
