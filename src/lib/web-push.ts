// Server-side web push sender — never import from client code
import webpush from 'web-push';
import { getAdminDb } from '@/lib/firebase-admin';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:training@hybridx.club';

let initialized = false;
function ensureInit() {
  if (initialized) return;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  initialized = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  userId: string;
  createdAt: Date;
  platform?: string;
}

/** Send a push notification to a single subscription. Returns true on success. */
export async function sendPushToSubscription(
  subscription: webpush.PushSubscription,
  payload: PushPayload
): Promise<boolean> {
  ensureInit();
  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? '/dashboard',
        icon: payload.icon ?? '/icons/icon-192x192.png',
        badge: payload.badge ?? '/icons/icon-192x192.png',
      })
    );
    return true;
  } catch (err: any) {
    // 410 Gone = subscription expired/unsubscribed
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      return false; // caller should clean up the subscription
    }
    console.error('Push send error:', err?.statusCode, err?.body);
    return false;
  }
}

/** Send to all subscriptions for a user. Cleans up expired ones. */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; cleaned: number }> {
  ensureInit();
  const db = getAdminDb();
  const snap = await db
    .collection('pushSubscriptions')
    .where('userId', '==', userId)
    .get();

  if (snap.empty) return { sent: 0, cleaned: 0 };

  let sent = 0;
  let cleaned = 0;
  const cleanupBatch = db.batch();
  let needsCleanup = false;

  for (const doc of snap.docs) {
    const sub = doc.data() as PushSubscriptionRecord;
    const success = await sendPushToSubscription(
      { endpoint: sub.endpoint, keys: sub.keys },
      payload
    );
    if (success) {
      sent++;
    } else {
      cleanupBatch.delete(doc.ref);
      needsCleanup = true;
      cleaned++;
    }
  }

  if (needsCleanup) await cleanupBatch.commit();
  return { sent, cleaned };
}
