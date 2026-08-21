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
// Usage, from Cloud Shell or anywhere with gcloud signed in:
//   gcloud auth application-default login
//   npx tsx scripts/seed-journeys.ts --dry-run
//
// Or with an explicit service-account key, for CI:
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' npx tsx scripts/seed-journeys.ts [--dry-run]

import * as admin from 'firebase-admin';
import { renderBlocks, renderBlocksAsText } from '../src/lib/marketing/render';
import type { EmailBlock } from '../src/lib/marketing/blocks';

const DRY_RUN = process.argv.includes('--dry-run');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hybridx.club';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'hyroxedgeai';

/**
 * Credentials, preferring application default.
 *
 * An explicit service-account key still works and is what CI uses, but it
 * should not be the only way in. Running this from Cloud Shell otherwise means
 * creating a key, downloading it, and pasting a private key into a shell — a
 * long-lived credential minted and handled by hand for a one-off script. Any
 * environment with `gcloud auth application-default login` already has short-
 * lived credentials for the operator, which is both easier and safer.
 */
function credential(): admin.credential.Credential {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return admin.credential.applicationDefault();

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return admin.credential.cert(serviceAccount);
}

function db(): admin.firestore.Firestore {
  const existing = admin.apps.find((a) => a?.name === 'seed');
  const app =
    existing ??
    admin.initializeApp({ credential: credential(), projectId: PROJECT_ID }, 'seed');
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
  trigger: { type: string; days?: number; route?: string };
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

  // ── Lead nurture, one journey per intake route ─────────────────────────
  //
  // These are what the marketing site's magnets have never had. Each triggers
  // on `consentGranted` rather than `subscriberCreated`, so it begins at the
  // moment the person actually became mailable — which for the race card is
  // the confirmation click, not the original request.
  //
  // Each is narrowed to one route, so someone who took the VO2max guide is not
  // greeted as though they took the race card. Copy is a starting point: read
  // and edit it in the console before activating, exactly as with the nudges
  // above.
  {
    id: 'seeded-welcome-vo2max',
    name: 'Welcome — VO2max guide',
    goal: 'Turn a VO2max guide download into a trial signup.',
    trigger: { type: 'consentGranted', route: 'magnet-vo2max' },
    steps: [
      {
        kind: 'email',
        email: {
          subject: 'Your engine guide — and what to do with it',
          previewText: 'The three sessions that move VO2max fastest.',
          blocks: [
            { type: 'hero', heading: 'You have the guide. Here is where to start.' },
            { type: 'paragraph', text: 'Hi [First Name], thanks for picking up Build a Bigger Engine. Most people read it once and then wonder which session to do on Monday, so here is the short answer.' },
            { type: 'bulletList', items: ['One hard interval session a week — that is where VO2max actually moves', 'One long easy run, slower than feels productive', 'Everything else can be compromise work'] },
            { type: 'paragraph', text: 'The guide explains why. If you would rather not build the schedule yourself, HYBRIDX does it for you.' },
            cta('See a plan built round your race', '/'),
          ],
        },
      },
      { kind: 'wait', hours: 72 },
      {
        kind: 'email',
        email: {
          subject: 'The mistake that stalls most HYROX engines',
          previewText: 'Running every session at the same middling pace.',
          blocks: [
            { type: 'hero', heading: 'Too hard on easy days, too easy on hard days' },
            { type: 'paragraph', text: '[First Name], this is the single most common pattern we see. Easy runs creep up to moderate, intervals drift down to moderate, and everything becomes the same middling effort that improves nothing much.' },
            { type: 'paragraph', text: 'Fixing it costs nothing except discipline on the easy days. A structured plan makes it harder to get wrong, because the session tells you the target rather than your legs deciding on the day.' },
            cta('Try HYBRIDX free', '/'),
          ],
        },
      },
    ],
  },
  {
    id: 'seeded-welcome-race-card',
    name: 'Welcome — race day rules card',
    goal: 'Convert a race-card download into a trial before the athlete’s race.',
    // Confirmed opt-in: this fires on the confirmation click, not the request.
    trigger: { type: 'consentGranted', route: 'magnet-race-card' },
    steps: [
      {
        kind: 'email',
        email: {
          subject: 'Your race day card is confirmed',
          previewText: 'Print it, or keep it on your phone for the briefing.',
          blocks: [
            { type: 'hero', heading: 'Confirmed — here is your card' },
            { type: 'paragraph', text: 'Thanks [First Name]. The 2026 rules card is yours. Most athletes keep it on their phone and read it again during the race briefing, when the details actually matter.' },
            { type: 'paragraph', text: 'The rules that catch people out are rarely the obvious ones. Standards on wall balls and sled depth cost more races than any fitness gap.' },
            cta('Read the full 2026 rule changes', '/hyrox-rule-changes-2026'),
          ],
        },
      },
      { kind: 'wait', hours: 96 },
      {
        kind: 'email',
        email: {
          subject: 'Knowing the rules is the easy half',
          previewText: 'The other half is arriving able to hold the standard when tired.',
          blocks: [
            { type: 'hero', heading: 'No-repping happens when you are tired, not when you are ignorant' },
            { type: 'paragraph', text: '[First Name], almost nobody fails a wall ball standard fresh. They fail it at station seven, when depth quietly disappears because their legs have gone.' },
            { type: 'paragraph', text: 'That is a training problem, not a rules problem. A HYROX plan that builds fatigue resistance under the standard is what stops it on race day.' },
            cta('Build your race plan', '/'),
          ],
        },
      },
    ],
  },
  {
    id: 'seeded-welcome-free-plan',
    name: 'Welcome — free HYROX plan',
    goal: 'Get a free-plan downloader into the app to train the plan properly.',
    trigger: { type: 'consentGranted', route: 'magnet-free-plan' },
    steps: [
      {
        kind: 'email',
        email: {
          subject: 'Your 12-week plan — start here',
          previewText: 'Week one matters less than you think. Consistency matters more.',
          blocks: [
            { type: 'hero', heading: 'The plan is yours. Now the boring part.' },
            { type: 'paragraph', text: 'Hi [First Name], the download is a PDF, which means it cannot adapt when you miss a session, travel, or pick up a niggle — and you will do all three across twelve weeks.' },
            { type: 'paragraph', text: 'Train it as written for the first fortnight. If you find yourself rescheduling constantly, that is the point at which a plan that moves with you starts earning its keep.' },
            cta('Train this plan in the app', '/'),
          ],
        },
      },
      { kind: 'wait', hours: 168 },
      {
        kind: 'email',
        email: {
          subject: 'How is week one going?',
          previewText: 'The athletes who finish are the ones who missed sessions and carried on.',
          blocks: [
            { type: 'hero', heading: 'Missed a session already?' },
            { type: 'paragraph', text: 'Good — so did almost everyone, [First Name]. The twelve-week plans that get finished are not the ones executed perfectly. They are the ones where a missed Tuesday did not turn into a missed fortnight.' },
            cta('Pick the plan back up', '/'),
          ],
        },
      },
    ],
  },
  {
    id: 'seeded-welcome-app-homepage',
    name: 'Welcome — app homepage sign-up',
    goal: 'Introduce someone who joined the list directly, with no magnet.',
    trigger: { type: 'consentGranted', route: 'app-homepage' },
    steps: [
      {
        kind: 'email',
        email: {
          subject: 'Welcome to HYBRIDX',
          previewText: 'What we send, and how often.',
          blocks: [
            { type: 'hero', heading: 'Glad you are here' },
            { type: 'paragraph', text: 'Hi [First Name] — you will get HYROX training that is worth reading, and not much else. A few emails a month, never more than a few a week, and an unsubscribe link on every one.' },
            { type: 'paragraph', text: 'If you want to start training properly in the meantime, the app builds a plan round your race date, your experience and the days you can actually train.' },
            cta('Start your free trial', '/'),
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
