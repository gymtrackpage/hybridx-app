import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;

    const { endpoint } = await request.json();

    const db = getAdminDb();

    if (endpoint) {
      const docId = Buffer.from(endpoint).toString('base64').slice(0, 100);
      await db.collection('pushSubscriptions').doc(docId).delete();
    } else {
      // Remove all subscriptions for this user
      const snap = await db.collection('pushSubscriptions').where('userId', '==', userId).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    await db.collection('users').doc(userId).update({ pushEnabled: false });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    return NextResponse.json({ error: 'Failed to remove subscription' }, { status: 500 });
  }
}
