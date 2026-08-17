// scripts/seed-journeys.ts
//
// Rebuilds the app's existing hard-coded email drips as editable journeys.
//
// Before this, three systems could email the same athlete:
//
//   1. /api/cron/onboarding-nudge and /api/cron/re-engagement, with copy
//      hard-coded in src/lib/email-service.ts;
//   2. functions/src/index.ts, a Cloud Functions drip on Gmail using the
//      deprecated functions.config() API;
//   3. the journeys engine.
//
// Once journeys are live, (1) and (2) are not merely redundant — they send the
// same nudges to the same people, with no shared frequency cap and no shared
// unsubscribe state. This script recreates their behaviour as journeys so the
// other two can be deleted.
//
// Seeded journeys are created PAUSED. Activating them is a decision, made once
// the old crons are gone, so the two systems never run simultaneously.
//
// Usage:
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' npx tsx scripts/seed-journeys.ts [--dry-run]

import * as admin from 'firebase-admin';
import { renderBlocks, renderBlocksAsText } from '../src/lib/marketing/render';
import type { EmailBlock } from '../src/lib/marketing/blocks';

const DRY_RUN = process.argv.includes('--dry-run');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hybridx.club';

function db(): admin.firestore.Firestore {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY is not set.');

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const existing = admin.apps.find((a) => a?.name === 'seed');
  const app =
    existing ?? admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, 'seed');
  return app.firestore();
}

interface SeedEmail {
  subject: string;
  previewText: string;
  blocks: EmailBlock[];
}

interface SeedJourney {
  /** Stable id, so re-running updates rather than duplicating. */
  id: string;
  name: string;
  goal: string;
  trigger: { type: string; days?: number };
  exitOnConversion?: 'workoutLogged' | 'subscriptionActive' | 'programStarted';
  /** Alternating email / wait, mirroring the cadence of the cron it replaces. */
  steps: Array<{ kind: 'email'; email: SeedEmail } | { kind: 'wait'; hours: number }>;
}

const cta = (label: string, path = '/dashboard'): EmailBlock => ({
  type: 'cta',
  label,
  url: `${APP_URL}${path}`,
});

/**
 * The journeys, with copy carried across from src/lib/email-service.ts and
 * public/onboarding-nudge-email-*.html, rebuilt as blocks so they are editable
 * and re-render if the brand changes.
 *
 * Timings match the crons they replace: nudges at day 2, 6 and 10 of the trial,
 * re-engagement at day 3 for athletes who never trained.
 */
const JOURNEYS: SeedJourney[] = [
  {
    id: 'seeded-onboarding-nudges',
    name: 'Onboarding nudges',
    goal: 'Get a new athlete to log their first workout during the trial.',
    // Replaces /api/cron/onboarding-nudge, which fired at days 2, 6 and 10.
    trigger: { type: 'onboardingStalled', days: 2 },
    exitOnConversion: 'workoutLogged',
    steps: [
      {
        kind: 'email',
        email: {
          subject: '[First Name], your HYROX starter workouts are ready to go',
          previewText: 'Your plan is built. The first session takes 45 minutes.',
          blocks: [
            { type: 'hero', heading: 'Your plan is waiting', subheading: 'Built for you at signup — all that is left is the first session.' },
            { type: 'paragraph', text: 'Hi [First Name], you signed up and your HYROX programme is already built around your goal, experience and the days you train. Nothing else to set up.' },
            { type: 'paragraph', text: 'The first session takes about 45 minutes. Most athletes find the hardest part is opening the app, not the training.' },
            cta('Start your first workout'),
          ],
        },
      },
      { kind: 'wait', hours: 96 }, // day 2 -> day 6
      {
        kind: 'email',
        email: {
          subject: 'One workout changes everything, [First Name]',
          previewText: 'You do not need a perfect week. You need one session.',
          blocks: [
            { type: 'hero', heading: 'Start smaller than you planned' },
            { type: 'paragraph', text: 'Hi [First Name] — the athletes who stick with HYROX training are rarely the ones who started with a perfect week. They are the ones who logged one session and came back.' },
            { type: 'bulletList', items: ['Pick any session in your plan', 'Do the parts you can', 'Log it — that is the whole task'] },
            cta('Open your plan'),
          ],
        },
      },
      { kind: 'wait', hours: 96 }, // day 6 -> day 10
      {
        kind: 'email',
        email: {
          subject: "10 days in, [First Name] — don't let your trial slip",
          previewText: 'Your trial ends soon. Your plan is still there.',
          blocks: [
            { type: 'hero', heading: 'Your trial is running out' },
            { type: 'paragraph', text: 'Hi [First Name], your free trial ends shortly and your programme is still sitting there untouched. It costs nothing to find out whether this works for you — but it does need one session.' },
            cta('Train today'),
            { type: 'paragraph', text: 'If HYROX training is not what you are after right now, no hard feelings — you can unsubscribe below.' },
          ],
        },
      },
    ],
  },
  {
    id: 'seeded-re-engagement',
    name: 'Re-engagement — never trained',
    goal: 'Bring back an athlete who signed up and never logged a workout.',
    // Replaces /api/cron/re-engagement, which fired at day 3 for athletes with
    // no sessions.
    trigger: { type: 'noWorkoutAfterNDays', days: 3 },
    exitOnConversion: 'workoutLogged',
    steps: [
      {
        kind: 'email',
        email: {
          subject: 'We miss you at HYBRIDX',
          previewText: 'Your programme is still ready when you are.',
          blocks: [
            { type: 'hero', heading: 'Still here when you are' },
            { type: 'paragraph', text: 'Hi [First Name], you have not logged a session yet. That is genuinely fine — but your programme is built and waiting, and the first one is the only difficult one.' },
            cta('Pick up where you left off'),
          ],
        },
      },
    ],
  },
];

async function seed() {
  console.log(`\n=== Seeding journeys ${DRY_RUN ? '(DRY RUN)' : '(LIVE)'} ===\n`);

  const firestore = db();
  let created = 0;
  let updated = 0;

  for (const journey of JOURNEYS) {
    const journeyRef = firestore.collection('marketingJourneys').doc(journey.id);
    const existing = await journeyRef.get();

    // Never touch a journey someone has already activated — re-running this
    // must not overwrite copy that has since been edited and put live.
    if (existing.exists && existing.data()?.status === 'live') {
      console.log(`  ${journey.name}: already live, leaving alone.`);
      continue;
    }

    const steps: Array<Record<string, unknown>> = [];

    for (const [index, step] of journey.steps.entries()) {
      const stepId = `step-${index}`;

      if (step.kind === 'wait') {
        steps.push({ id: stepId, type: 'wait', hours: step.hours });
        continue;
      }

      // Deterministic campaign ids so a re-run updates the same documents
      // rather than orphaning the previous set.
      const campaignId = `${journey.id}-${stepId}`;

      if (!DRY_RUN) {
        await firestore.collection('marketingCampaigns').doc(campaignId).set(
          {
            subject: step.email.subject,
            previewText: step.email.previewText,
            blocks: step.email.blocks,
            htmlBody: renderBlocks(step.email.blocks, { previewText: step.email.previewText }),
            plainBody: renderBlocksAsText(step.email.blocks),
            status: 'draft',
            journeyId: journey.id,
            journeyStepId: stepId,
            scheduledAt: null,
            sentAt: null,
            recipientCount: 0,
            openCount: 0,
            clickCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      }

      steps.push({ id: stepId, type: 'sendEmail', campaignId });
    }

    if (!DRY_RUN) {
      await journeyRef.set(
        {
          name: journey.name,
          goal: journey.goal,
          trigger: journey.trigger,
          entryRules: { onceOnly: true, segment: {} },
          exitRules: journey.exitOnConversion
            ? { exitOnConversion: { type: journey.exitOnConversion } }
            : {},
          steps,
          // Paused, not live. Activating is a separate decision, taken once the
          // legacy crons are gone — otherwise both systems mail the same people.
          status: 'paused',
          stats: { entered: 0, completed: 0, exitedEarly: 0 },
          seeded: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }

    const emailCount = journey.steps.filter((s) => s.kind === 'email').length;
    console.log(
      `  ${existing.exists ? 'Updated' : 'Created'} "${journey.name}" — ${emailCount} emails, trigger ${journey.trigger.type}`,
    );
    existing.exists ? updated++ : created++;
  }

  console.log(`\n${created} created, ${updated} updated.`);
  console.log('\nAll seeded journeys are PAUSED. Before activating:');
  console.log('  1. Open each in /admin/marketing/journeys and read the copy.');
  console.log('  2. Send yourself a test of each email.');
  console.log('  3. Confirm the legacy crons are removed and deployed.');
  console.log('  4. Then activate — never with the old crons still running.\n');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nSeeding failed:', err);
    process.exit(1);
  });
