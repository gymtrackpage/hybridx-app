// src/lib/marketing/brief.ts
//
// Weekly performance compilation.
//
// The dashboard shows lifetime figures, which answer "how are we doing" but
// never "what changed". A brief needs deltas, so each run stores its own
// snapshot in `marketingBriefs` and the next one measures against it. The first
// run has nothing to compare with and says so, rather than presenting the
// lifetime total as if it were a week's work.

import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { CAMPAIGNS } from './queue';
import { SUBSCRIBERS } from './subscribers';
import { JOURNEYS, JOURNEY_RUNS } from './journeys';
import type { Campaign } from './types';

export const BRIEFS = 'marketingBriefs';

export interface BriefCampaign {
  id: string;
  subject: string;
  recipients: number;
  openRate: number;
  clickRate: number;
  unsubscribes: number;
}

export interface WeeklyBrief {
  periodStart: string;
  periodEnd: string;
  /** Absent on the first run, when there is no previous snapshot to diff. */
  hasComparison: boolean;

  list: {
    mailable: number;
    mailableChange: number | null;
    newThisWeek: number;
    unsubscribedThisWeek: number;
    bouncedThisWeek: number;
    complainedThisWeek: number;
  };

  sending: {
    campaignsSent: number;
    emailsDelivered: number;
    averageOpenRate: number | null;
    averageClickRate: number | null;
    openRateChange: number | null;
  };

  journeys: {
    live: number;
    activeRuns: number;
    completedThisWeek: number;
    /**
     * Runs set aside as failed this week.
     *
     * Counted over the week rather than in total so this reports new breakage
     * and clears itself once fixed — the standing figure lives in the console,
     * where it persists until someone deals with it. Reported here because
     * every other health signal in this system has to be gone and looked at,
     * and an automation that has stopped sending is exactly the thing nobody
     * thinks to check.
     */
    stuckThisWeek: number;
  };

  campaigns: BriefCampaign[];
  /** Things worth a human's attention, in plain words. */
  observations: string[];
}

function since(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

/**
 * Compile the week.
 *
 * Counting uses aggregation queries wherever a count is all that is needed;
 * campaigns are read in full because the brief quotes their subject lines.
 */
export async function compileWeeklyBrief(): Promise<WeeklyBrief> {
  const db = getAdminDb();
  const weekAgo = since(7);
  const subs = db.collection(SUBSCRIBERS);

  const [mailable, newSubs, campaignsSnap, liveJourneys, activeRuns] = await Promise.all([
    subs.where('status', '==', 'active').where('consent.marketing', '==', true).count().get(),
    subs.where('createdAt', '>=', weekAgo).count().get(),
    db.collection(CAMPAIGNS).where('sentAt', '>=', weekAgo).get(),
    db.collection(JOURNEYS).where('status', '==', 'live').count().get(),
    db.collection(JOURNEY_RUNS).where('status', '==', 'active').count().get(),
  ]);

  // Status changes have no timestamp of their own beyond updatedAt, so these
  // are "changed to this status in the last week" rather than exact counts.
  const [unsubbed, bounced, complained, completedRuns, stuckRuns] = await Promise.all([
    subs.where('status', '==', 'unsubscribed').where('updatedAt', '>=', weekAgo).count().get(),
    subs.where('status', '==', 'bounced').where('updatedAt', '>=', weekAgo).count().get(),
    subs.where('status', '==', 'complained').where('updatedAt', '>=', weekAgo).count().get(),
    db
      .collection(JOURNEY_RUNS)
      .where('status', '==', 'completed')
      .where('completedAt', '>=', weekAgo)
      .count()
      .get(),
    // `completedAt` is stamped when a run is set aside, so this is "gave up on
    // it this week" rather than every failure ever recorded.
    db
      .collection(JOURNEY_RUNS)
      .where('status', '==', 'failed')
      .where('completedAt', '>=', weekAgo)
      .count()
      .get(),
  ]);

  const campaigns = campaignsSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as Campaign)
    .filter((c) => (c.recipientCount ?? 0) > 0);

  const briefCampaigns: BriefCampaign[] = campaigns.map((c) => ({
    id: c.id,
    subject: c.subject,
    recipients: c.recipientCount,
    openRate: (c.openCount ?? 0) / c.recipientCount,
    clickRate: (c.clickCount ?? 0) / c.recipientCount,
    unsubscribes: c.unsubscribeCount ?? 0,
  }));

  const delivered = campaigns.reduce((sum, c) => sum + (c.recipientCount ?? 0), 0);
  const averageOpenRate = briefCampaigns.length
    ? briefCampaigns.reduce((s, c) => s + c.openRate, 0) / briefCampaigns.length
    : null;
  const averageClickRate = briefCampaigns.length
    ? briefCampaigns.reduce((s, c) => s + c.clickRate, 0) / briefCampaigns.length
    : null;

  // Previous snapshot, for the deltas.
  const previousSnap = await db
    .collection(BRIEFS)
    .orderBy('periodEnd', 'desc')
    .limit(1)
    .get();
  const previous = previousSnap.empty ? null : (previousSnap.docs[0].data() as WeeklyBrief);

  const brief: WeeklyBrief = {
    periodStart: weekAgo.toISOString(),
    periodEnd: new Date().toISOString(),
    hasComparison: Boolean(previous),
    list: {
      mailable: mailable.data().count,
      mailableChange: previous ? mailable.data().count - previous.list.mailable : null,
      newThisWeek: newSubs.data().count,
      unsubscribedThisWeek: unsubbed.data().count,
      bouncedThisWeek: bounced.data().count,
      complainedThisWeek: complained.data().count,
    },
    sending: {
      campaignsSent: briefCampaigns.length,
      emailsDelivered: delivered,
      averageOpenRate,
      averageClickRate,
      openRateChange:
        previous?.sending.averageOpenRate != null && averageOpenRate != null
          ? averageOpenRate - previous.sending.averageOpenRate
          : null,
    },
    journeys: {
      live: liveJourneys.data().count,
      activeRuns: activeRuns.data().count,
      completedThisWeek: completedRuns.data().count,
      stuckThisWeek: stuckRuns.data().count,
    },
    campaigns: briefCampaigns,
    observations: [],
  };

  brief.observations = deriveObservations(brief);
  return brief;
}

/**
 * Plain-language notes on what the numbers mean.
 *
 * Computed here rather than asked of the model: these are arithmetic
 * comparisons with known thresholds, and a language model adds nothing to them
 * except the possibility of getting them wrong.
 */
export function deriveObservations(brief: WeeklyBrief): string[] {
  const notes: string[] = [];
  const { list, sending, journeys } = brief;

  // Ahead of the engagement notes deliberately. A journey that has stopped
  // sending is a broken machine, not a metric that drifted.
  if (journeys.stuckThisWeek > 0) {
    const n = journeys.stuckThisWeek;
    notes.push(
      `${n} journey run${n === 1 ? '' : 's'} stopped with an error this week and ${n === 1 ? 'was' : 'were'} set aside. ` +
        'Those people are part-way through a sequence that will not finish on its own — ' +
        'the journeys page shows which automation is affected.',
    );
  }

  if (list.complainedThisWeek > 0) {
    notes.push(
      `${list.complainedThisWeek} spam complaint${list.complainedThisWeek === 1 ? '' : 's'} this week. ` +
        'Complaints damage delivery for everyone on the list — worth checking what those campaigns promised.',
    );
  }

  // The rule of thumb across the industry is that sustained complaints above
  // roughly 0.1% of volume put a sending domain at risk.
  if (sending.emailsDelivered > 0) {
    const unsubRate = list.unsubscribedThisWeek / sending.emailsDelivered;
    if (unsubRate > 0.005) {
      notes.push(
        `Unsubscribe rate was ${(unsubRate * 100).toFixed(2)}% of emails sent — above the 0.5% mark where frequency or relevance is usually the cause.`,
      );
    }
  }

  if (list.bouncedThisWeek > 10) {
    notes.push(
      `${list.bouncedThisWeek} addresses bounced and were removed. A spike usually means an imported list rather than organic signups.`,
    );
  }

  if (sending.averageOpenRate !== null && sending.averageOpenRate < 0.15) {
    notes.push(
      `Average open rate was ${(sending.averageOpenRate * 100).toFixed(1)}%, which is low. Subject lines are the usual first thing to change.`,
    );
  }

  if (sending.openRateChange !== null && Math.abs(sending.openRateChange) > 0.05) {
    const direction = sending.openRateChange > 0 ? 'up' : 'down';
    notes.push(
      `Open rate moved ${direction} ${Math.abs(sending.openRateChange * 100).toFixed(1)} points on last week.`,
    );
  }

  if (sending.campaignsSent === 0 && journeys.live === 0) {
    notes.push('Nothing was sent this week and no journeys are live — the list is going cold.');
  }

  if (list.mailableChange !== null && list.mailableChange < 0) {
    notes.push(
      `The mailable list shrank by ${Math.abs(list.mailableChange)} this week — more people left than joined.`,
    );
  }

  if (!notes.length) {
    notes.push('Nothing unusual in the numbers this week.');
  }

  return notes;
}

/** Persist the brief so next week has something to compare against. */
export async function saveBrief(brief: WeeklyBrief): Promise<string> {
  const ref = await getAdminDb().collection(BRIEFS).add(brief);
  logger.log(`[marketing/brief] saved brief ${ref.id}`);
  return ref.id;
}
