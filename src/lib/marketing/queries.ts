// src/lib/marketing/queries.ts
//
// Read-side helpers for the marketing console's server components.
//
// Firestore timestamps are converted to plain ISO strings here, because
// anything a server component hands to a client component must be
// serialisable — a Timestamp is not.

import { getAdminDb } from '@/lib/firebase-admin';
import { CAMPAIGNS } from './queue';
import { SUBSCRIBERS } from './subscribers';
import type { Campaign, Send, Subscriber } from './types';

/** Firestore hands back Timestamps; the client needs strings. */
function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate(): Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return typeof value === 'string' ? value : null;
}

export type SerialisableCampaign = Omit<Campaign, 'scheduledAt' | 'sentAt' | 'createdAt' | 'updatedAt' | 'sendState'> & {
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sendState?: { total: number; sent: number; failed: number; startedAt: string | null; finishedAt: string | null };
};

export type SerialisableSubscriber = Omit<Subscriber, 'createdAt' | 'updatedAt' | 'lastSentAt' | 'consent'> & {
  createdAt: string | null;
  updatedAt: string | null;
  lastSentAt: string | null;
  consent: { marketing: boolean; at: string | null; method: string; ip?: string };
};

function serialiseCampaign(id: string, data: FirebaseFirestore.DocumentData): SerialisableCampaign {
  const state = data.sendState;
  return {
    ...(data as Campaign),
    id,
    scheduledAt: iso(data.scheduledAt),
    sentAt: iso(data.sentAt),
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    sendState: state
      ? {
          total: state.total ?? 0,
          sent: state.sent ?? 0,
          failed: state.failed ?? 0,
          startedAt: iso(state.startedAt),
          finishedAt: iso(state.finishedAt),
        }
      : undefined,
  };
}

function serialiseSubscriber(id: string, data: FirebaseFirestore.DocumentData): SerialisableSubscriber {
  return {
    ...(data as Subscriber),
    id,
    createdAt: iso(data.createdAt),
    updatedAt: iso(data.updatedAt),
    lastSentAt: iso(data.lastSentAt),
    consent: {
      marketing: data.consent?.marketing === true,
      at: iso(data.consent?.at),
      method: data.consent?.method ?? 'unknown',
      ...(data.consent?.ip ? { ip: data.consent.ip } : {}),
    },
  };
}

export async function listCampaigns(limit = 100): Promise<SerialisableCampaign[]> {
  const snap = await getAdminDb()
    .collection(CAMPAIGNS)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => serialiseCampaign(d.id, d.data()));
}

export async function getCampaign(id: string): Promise<SerialisableCampaign | null> {
  const snap = await getAdminDb().collection(CAMPAIGNS).doc(id).get();
  return snap.exists ? serialiseCampaign(snap.id, snap.data()!) : null;
}

export async function listSubscribers(limit = 500): Promise<SerialisableSubscriber[]> {
  const snap = await getAdminDb()
    .collection(SUBSCRIBERS)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  return snap.docs.map((d) => serialiseSubscriber(d.id, d.data()));
}

export interface DashboardStats {
  totalSubscribers: number;
  activeSubscribers: number;
  consentedSubscribers: number;
  unsubscribed: number;
  bounced: number;
  campaignsSent: number;
  campaignsDraft: number;
  campaignsInFlight: number;
  /** Averaged over campaigns that actually reached someone. */
  averageOpenRate: number | null;
  averageClickRate: number | null;
}

/**
 * Counts for the dashboard.
 *
 * Uses aggregation queries rather than reading every document — on a list of
 * any size, counting client-side would mean paying to read the whole collection
 * to render one number.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const db = getAdminDb();
  const subs = db.collection(SUBSCRIBERS);

  const [total, active, consented, unsub, bounced] = await Promise.all([
    subs.count().get(),
    subs.where('status', '==', 'active').count().get(),
    subs.where('consent.marketing', '==', true).where('status', '==', 'active').count().get(),
    subs.where('status', '==', 'unsubscribed').count().get(),
    subs.where('status', '==', 'bounced').count().get(),
  ]);

  const campaignsSnap = await db.collection(CAMPAIGNS).get();
  const campaigns = campaignsSnap.docs.map((d) => d.data() as Campaign);

  const sent = campaigns.filter((c) => c.status === 'sent');
  const delivered = sent.filter((c) => (c.recipientCount ?? 0) > 0);

  const rate = (pick: (c: Campaign) => number) =>
    delivered.length
      ? delivered.reduce((acc, c) => acc + pick(c) / c.recipientCount, 0) / delivered.length
      : null;

  return {
    totalSubscribers: total.data().count,
    activeSubscribers: active.data().count,
    consentedSubscribers: consented.data().count,
    unsubscribed: unsub.data().count,
    bounced: bounced.data().count,
    campaignsSent: sent.length,
    campaignsDraft: campaigns.filter((c) => c.status === 'draft').length,
    campaignsInFlight: campaigns.filter((c) => c.status === 'sending' || c.status === 'scheduled').length,
    averageOpenRate: rate((c) => c.openCount ?? 0),
    averageClickRate: rate((c) => c.clickCount ?? 0),
  };
}

/** Link clicks with the timestamp already flattened for the client. */
export interface SerialisableLinkClick {
  id: string;
  url: string;
  clickCount: number;
  lastClickedAt: string | null;
}

export interface CampaignReport {
  campaign: SerialisableCampaign;
  linkClicks: SerialisableLinkClick[];
  failures: Array<{ email: string; error: string }>;
}

export async function getCampaignReport(campaignId: string): Promise<CampaignReport | null> {
  const db = getAdminDb();
  const campaign = await getCampaign(campaignId);
  if (!campaign) return null;

  const ref = db.collection(CAMPAIGNS).doc(campaignId);
  const [linksSnap, failedSnap] = await Promise.all([
    ref.collection('linkClicks').orderBy('clickCount', 'desc').limit(25).get(),
    ref.collection('sends').where('status', '==', 'failed').limit(50).get(),
  ]);

  return {
    campaign,
    linkClicks: linksSnap.docs.map((d) => ({
      id: d.id,
      url: d.data().url,
      clickCount: d.data().clickCount ?? 0,
      lastClickedAt: iso(d.data().lastClickedAt),
    })),
    failures: failedSnap.docs.map((d) => {
      const s = d.data() as Send;
      return { email: s.email, error: s.lastError ?? 'Unknown error' };
    }),
  };
}

/** Every tag in use, with counts — powers the tag filter in the subscribers table. */
export async function listTags(): Promise<Array<{ tag: string; count: number }>> {
  const snap = await getAdminDb().collection(SUBSCRIBERS).select('tags').get();
  const counts = new Map<string, number>();

  for (const doc of snap.docs) {
    for (const tag of (doc.data().tags ?? []) as string[]) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
