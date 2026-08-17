// src/lib/marketing/journey-queries.ts
//
// Read-side helpers for the journeys screens, flattening Firestore timestamps
// so server components can hand the results to client components.

import { getAdminDb } from '@/lib/firebase-admin';
import { JOURNEYS, JOURNEY_RUNS, type Journey, type JourneyStep } from './journeys';
import { CAMPAIGNS } from './queue';

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

export interface SerialisableJourney {
  id: string;
  name: string;
  goal: string;
  trigger: Journey['trigger'];
  steps: JourneyStep[];
  status: Journey['status'];
  entryRules: Journey['entryRules'];
  exitRules: Journey['exitRules'];
  stats: { entered: number; completed: number; exitedEarly: number };
  createdAt: string | null;
  activatedAt: string | null;
  /** Live run counts, which are the numbers that tell you whether it is working. */
  activeRuns?: number;
}

function serialise(id: string, data: FirebaseFirestore.DocumentData): SerialisableJourney {
  return {
    id,
    name: data.name ?? 'Untitled journey',
    goal: data.goal ?? '',
    trigger: data.trigger ?? { type: 'manual' },
    steps: data.steps ?? [],
    status: data.status ?? 'draft',
    entryRules: data.entryRules ?? { onceOnly: true },
    exitRules: data.exitRules ?? {},
    stats: {
      entered: data.stats?.entered ?? 0,
      completed: data.stats?.completed ?? 0,
      exitedEarly: data.stats?.exitedEarly ?? 0,
    },
    createdAt: iso(data.createdAt),
    activatedAt: iso(data.activatedAt),
  };
}

export async function listJourneys(): Promise<SerialisableJourney[]> {
  const db = getAdminDb();
  const snap = await db.collection(JOURNEYS).orderBy('createdAt', 'desc').limit(100).get();
  const journeys = snap.docs.map((d) => serialise(d.id, d.data()));

  // Active-run counts come from aggregation queries rather than reading runs,
  // which on a busy journey would be thousands of documents to render one number.
  await Promise.all(
    journeys.map(async (j) => {
      const count = await db
        .collection(JOURNEY_RUNS)
        .where('journeyId', '==', j.id)
        .where('status', '==', 'active')
        .count()
        .get();
      j.activeRuns = count.data().count;
    }),
  );

  return journeys;
}

export interface JourneyDetail extends SerialisableJourney {
  emails: Array<{
    stepId: string;
    campaignId: string;
    subject: string;
    previewText: string;
    htmlBody: string;
    sent: number;
    opened: number;
    clicked: number;
  }>;
  runCounts: { active: number; completed: number; exited: number };
}

export async function getJourney(id: string): Promise<JourneyDetail | null> {
  const db = getAdminDb();
  const snap = await db.collection(JOURNEYS).doc(id).get();
  if (!snap.exists) return null;

  const journey = serialise(snap.id, snap.data()!);

  const emailSteps = journey.steps.filter(
    (s): s is Extract<JourneyStep, { type: 'sendEmail' }> =>
      s.type === 'sendEmail' && !!s.campaignId,
  );

  const campaigns = emailSteps.length
    ? await db.getAll(...emailSteps.map((s) => db.collection(CAMPAIGNS).doc(s.campaignId!)))
    : [];

  const emails = emailSteps.map((step, i) => {
    const data = campaigns[i]?.data();
    return {
      stepId: step.id,
      campaignId: step.campaignId!,
      subject: data?.subject ?? '(missing)',
      previewText: data?.previewText ?? '',
      htmlBody: data?.htmlBody ?? '',
      sent: data?.sendState?.sent ?? 0,
      opened: data?.openCount ?? 0,
      clicked: data?.clickCount ?? 0,
    };
  });

  const [active, completed, exited] = await Promise.all(
    (['active', 'completed', 'exited'] as const).map((status) =>
      db
        .collection(JOURNEY_RUNS)
        .where('journeyId', '==', id)
        .where('status', '==', status)
        .count()
        .get(),
    ),
  );

  return {
    ...journey,
    emails,
    runCounts: {
      active: active.data().count,
      completed: completed.data().count,
      exited: exited.data().count,
    },
  };
}
