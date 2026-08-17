// src/lib/marketing/frequency.ts
//
// Global send-frequency cap.
//
// Once journeys run automatically alongside hand-sent broadcasts, nobody has a
// complete picture of what any individual is receiving. A welcome series, a
// trial-ending nudge and a Tuesday newsletter each look reasonable on their own;
// arriving in the same afternoon they read as spam, and the recipient's
// response is to unsubscribe or — far worse for the sending domain — to press
// "report spam".
//
// So campaigns and journeys draw on one shared weekly budget per person.

import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { CAMPAIGNS } from './queue';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface FrequencyDecision {
  allowed: boolean;
  sentThisWeek: number;
  cap: number;
}

/**
 * How many marketing emails this subscriber received in the last week.
 *
 * Counts `sends` rows across every campaign via a collection-group query, which
 * is why `sends` carries a COLLECTION_GROUP index on (subscriberId, sentAt).
 */
export async function countRecentSends(subscriberId: string, since = new Date(Date.now() - WEEK_MS)): Promise<number> {
  const snap = await getAdminDb()
    .collectionGroup('sends')
    .where('subscriberId', '==', subscriberId)
    .where('sentAt', '>=', since)
    .count()
    .get();

  return snap.data().count;
}

/**
 * Decide whether one more message may go to this person right now.
 */
export async function checkFrequencyCap(subscriberId: string, cap: number): Promise<FrequencyDecision> {
  // A cap of zero or less is treated as "no cap", so the feature can be turned
  // off without special-casing it at every call site.
  if (cap <= 0) return { allowed: true, sentThisWeek: 0, cap };

  const sentThisWeek = await countRecentSends(subscriberId);
  const allowed = sentThisWeek < cap;

  if (!allowed) {
    logger.log(`[marketing/frequency] holding ${subscriberId}: ${sentThisWeek} sends in the last week (cap ${cap})`);
  }

  return { allowed, sentThisWeek, cap };
}

/**
 * Filter a list of subscriber ids to those still inside their budget.
 *
 * Used at journey-send time rather than at broadcast-enqueue time. Broadcasts
 * are a deliberate act by a human who can see the audience; automated journeys
 * fire unattended, which is where the cap earns its keep. Applying it to both
 * would also make a large broadcast's enqueue step O(audience) count queries.
 */
export async function filterByFrequencyCap(
  subscriberIds: string[],
  cap: number,
): Promise<{ allowed: string[]; held: string[] }> {
  if (cap <= 0) return { allowed: subscriberIds, held: [] };

  const allowed: string[] = [];
  const held: string[] = [];

  // Sequential rather than parallel: this runs inside a cron with a time budget,
  // and a burst of aggregation queries is the kind of thing that trips quota.
  for (const id of subscriberIds) {
    const decision = await checkFrequencyCap(id, cap);
    (decision.allowed ? allowed : held).push(id);
  }

  return { allowed, held };
}

/**
 * Whether a campaign is exempt from the cap.
 *
 * Transactional mail never reaches this module at all — it goes through
 * src/lib/email-service.ts. This is for the rare marketing message that must
 * land regardless, such as a notice that a series someone subscribed to is
 * ending. Kept explicit so exemption is a decision, not an accident.
 */
export function isCapExempt(campaignTags: string[] | undefined): boolean {
  return (campaignTags ?? []).includes('bypass-frequency-cap');
}

/** Ids of campaigns a subscriber has already been sent, so a journey never repeats one. */
export async function alreadySentCampaigns(subscriberId: string): Promise<Set<string>> {
  const snap = await getAdminDb()
    .collectionGroup('sends')
    .where('subscriberId', '==', subscriberId)
    .select('campaignId')
    .limit(500)
    .get();

  return new Set(snap.docs.map((d) => d.data().campaignId as string).filter(Boolean));
}

/** Convenience for the studio: describe the cap in words. */
export function describeCap(cap: number): string {
  if (cap <= 0) return 'No frequency cap — subscribers may receive any number of emails.';
  return `At most ${cap} marketing email${cap === 1 ? '' : 's'} per person per week, shared across campaigns and journeys.`;
}

export { CAMPAIGNS };
