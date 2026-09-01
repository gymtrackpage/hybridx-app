// src/lib/garmin/sync-lock.ts
// A short-lived per-athlete lease so two plan syncs can never run at once.
//
// Three things can start a sync: the button on the Garmin card, the
// fire-and-forget call made when a program is scheduled, and the nightly cron.
// Without a lease, two overlapping runs each read the same bookkeeping record,
// each decide the same workouts are missing, and each push their own copy —
// duplicating everything on the watch.
import type { DocumentReference } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

/** Long enough to cover a full 14-day push, short enough to self-heal. */
export const SYNC_LOCK_TTL_MS = 5 * 60_000;

export interface SyncLockHandle {
  release: () => Promise<void>;
}

/**
 * Try to take the sync lease for a user.
 *
 * Returns `null` when another sync holds it — the caller should report "already
 * syncing" rather than pushing a second copy of the plan.
 */
export async function acquireGarminSyncLock(
  userRef: DocumentReference,
  now: Date = new Date(),
): Promise<SyncLockHandle | null> {
  const token = `${now.getTime()}-${Math.random().toString(36).slice(2, 10)}`;

  const acquired = await userRef.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const existing = snap.data()?.garminSyncLock as
      | { token?: string; acquiredAt?: { toDate?: () => Date } | Date }
      | undefined;

    if (existing?.acquiredAt) {
      const raw = existing.acquiredAt;
      const acquiredAt =
        raw instanceof Date ? raw : typeof raw.toDate === 'function' ? raw.toDate() : undefined;
      if (acquiredAt && now.getTime() - acquiredAt.getTime() < SYNC_LOCK_TTL_MS) {
        return false; // held by a live sync
      }
    }

    tx.set(userRef, { garminSyncLock: { token, acquiredAt: now } }, { merge: true });
    return true;
  });

  if (!acquired) return null;

  return {
    release: async () => {
      try {
        // Only clear our own lease — a lease that expired and was taken over by
        // another run must stay with that run.
        await userRef.firestore.runTransaction(async (tx) => {
          const snap = await tx.get(userRef);
          const existing = snap.data()?.garminSyncLock as { token?: string } | undefined;
          if (existing?.token !== token) return;
          tx.set(userRef, { garminSyncLock: null }, { merge: true });
        });
      } catch (e) {
        // The lease expires on its own; a failed release is not worth failing on.
        logger.error('Garmin: releasing sync lock failed:', e instanceof Error ? e.message : String(e));
      }
    },
  };
}
