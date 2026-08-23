// scripts/port-website-leads.ts
//
// One-shot port of the marketing site's historical `leads` into the mailing
// system's `marketingSubscribers`.
//
//   Source: hybridx-hub  /leads          (the site's own capture record)
//   Target: hyroxedgeai  /marketingSubscribers
//
// These are people who signed up through the original funnels before the
// bridge existed, so the outbox never carried them across. They are already
// consented — the forms they used said signing up meant ongoing email — but
// they are invisible to every segment and every journey until they are here.
//
// Three rules make this more than a copy, and each exists because getting it
// wrong is worse than not running the script at all:
//
//   1. It emits NO events.
//
//      captureLead() raises `subscriberCreated` and `consentGranted`, and the
//      seeded welcome journeys trigger on exactly those. Importing months-old
//      signups through it would greet all of them at once with "thanks for
//      downloading the guide" — for a guide they read in spring. So this writes
//      Firestore directly, the same way scripts/migrate-hxmailer.ts does, and
//      the people land in the list silently. They can be mailed deliberately,
//      by a campaign someone chose to send.
//
//   2. An unsubscribe always wins.
//
//      If the address is already here as unsubscribed, bounced or complained,
//      the record is left completely alone. Losing an old tag is an
//      inconvenience; resurrecting somebody who opted out is a compliance
//      failure, and a spam complaint from a reactivated address is the fastest
//      way to damage a sending domain.
//
//   3. Confirmed opt-in is respected.
//
//      The race day rules card uses double opt-in — `upsertPendingLead` writes
//      the lead with `confirmed: false` and only a clicked link sets it true.
//      An unconfirmed race-card lead is imported as a known contact with
//      consent withheld, exactly as the live capture path treats them. Marking
//      them mailable here would defeat the point of having asked twice.
//
// Usage, with gcloud signed in (needs read on hybridx-hub, write on hyroxedgeai):
//   gcloud auth application-default login
//   npx tsx scripts/port-website-leads.ts --dry-run
//   npx tsx scripts/port-website-leads.ts
//
// Idempotent: re-running merges rather than duplicating, because the subscriber
// id is sha256 of the address. Run --dry-run first and reconcile the counts
// against /admin/leads on the marketing site.

import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');

const SOURCE_PROJECT = process.env.LEADS_SOURCE_PROJECT || 'hybridx-hub';
const TARGET_PROJECT = process.env.FIREBASE_PROJECT_ID || 'hyroxedgeai';

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

function credential(): admin.credential.Credential {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return admin.credential.applicationDefault();
  const key = JSON.parse(raw);
  if (key.private_key) key.private_key = key.private_key.replace(/\\n/g, '\n');
  return admin.credential.cert(key);
}

function connect(name: string, projectId: string): admin.firestore.Firestore {
  const existing = admin.apps.find((a) => a?.name === name);
  const app =
    existing ?? admin.initializeApp({ credential: credential(), projectId }, name);
  return app.firestore();
}

const sourceDb = connect('leads-source', SOURCE_PROJECT);
const targetDb = connect('mailing-target', TARGET_PROJECT);

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

/**
 * Site `source` values to mailing-system route ids.
 *
 * These are the aliases already declared in src/lib/marketing/sources.ts. They
 * are repeated rather than imported because this script talks to Firestore
 * directly and must not pull in the app's server-only module graph — but they
 * have to agree, so a value missing here is reported rather than guessed.
 */
const ROUTE_BY_SOURCE: Record<string, string> = {
  build_a_bigger_engine: 'magnet-vo2max',
  hyrox_rules_card: 'magnet-race-card',
  free_hyrox_plan: 'magnet-free-plan',
  sign_up: 'website-signup',
};

/** Tags each route carries, mirroring tagsForRoute() in sources.ts. */
const TAGS_BY_ROUTE: Record<string, string[]> = {
  'magnet-vo2max': ['route:magnet-vo2max', 'source:website', 'magnet:vo2max-guide'],
  'magnet-race-card': ['route:magnet-race-card', 'source:website', 'magnet:race-card'],
  'magnet-free-plan': ['route:magnet-free-plan', 'source:website', 'magnet:free-plan'],
  'website-signup': ['route:website-signup', 'source:website'],
};

/** Routes whose consent is only real once a confirmation link has been clicked. */
const CONFIRMED_OPT_IN = new Set(['magnet-race-card']);

function subscriberId(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex');
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? '', lastName: parts.slice(1).join(' ') };
}

const UNMAILABLE = ['unsubscribed', 'bounced', 'complained'];

// ---------------------------------------------------------------------------

interface Tally {
  read: number;
  created: number;
  merged: number;
  skippedUnmailable: number;
  skippedPending: number;
  skippedInvalid: number;
  unknownSource: Record<string, number>;
}

async function main() {
  const tally: Tally = {
    read: 0,
    created: 0,
    merged: 0,
    skippedUnmailable: 0,
    skippedPending: 0,
    skippedInvalid: 0,
    unknownSource: {},
  };

  console.log(`\n=== Porting ${SOURCE_PROJECT}/leads -> ${TARGET_PROJECT}/marketingSubscribers ===`);
  console.log(DRY_RUN ? 'DRY RUN — nothing will be written.\n' : 'LIVE RUN.\n');

  const snap = await sourceDb.collection('leads').get();
  tally.read = snap.size;

  for (const doc of snap.docs) {
    const lead = doc.data() as {
      email?: string;
      name?: string | null;
      source?: string;
      tags?: string[];
      confirmed?: boolean;
      createdAt?: admin.firestore.Timestamp;
      utm?: Record<string, string>;
    };

    const email = (lead.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      tally.skippedInvalid++;
      continue;
    }

    const route = ROUTE_BY_SOURCE[lead.source ?? ''];
    if (!route) {
      // Reported, never guessed. A source this script does not recognise is a
      // funnel somebody added without telling the registry, and quietly filing
      // those under a catch-all would lose the attribution permanently.
      tally.unknownSource[lead.source ?? '(none)'] =
        (tally.unknownSource[lead.source ?? '(none)'] ?? 0) + 1;
      continue;
    }

    // Rule 3 — double opt-in that was never completed grants nothing.
    const consented = CONFIRMED_OPT_IN.has(route) ? lead.confirmed === true : true;
    if (!consented) tally.skippedPending++;

    const id = subscriberId(email);
    const ref = targetDb.collection('marketingSubscribers').doc(id);
    const existing = await ref.get();

    // Rule 2 — an unsubscribe, bounce or complaint is never overwritten.
    if (existing.exists) {
      const status = (existing.data()?.status as string) ?? 'active';
      if (UNMAILABLE.includes(status)) {
        tally.skippedUnmailable++;
        continue;
      }
    }

    const { firstName, lastName } = splitName(lead.name ?? '');
    const tags = Array.from(
      new Set([...(TAGS_BY_ROUTE[route] ?? []), ...(lead.tags ?? []), 'imported:website-backfill']),
    );

    if (DRY_RUN) {
      if (existing.exists) tally.merged++;
      else tally.created++;
      continue;
    }

    if (existing.exists) {
      const prior = existing.data() ?? {};
      await ref.update({
        tags: Array.from(new Set([...(prior.tags ?? []), ...tags])),
        // Fill blanks only — a name the person typed themselves outranks one
        // carried over from an older record.
        ...(firstName && !prior.firstName ? { firstName } : {}),
        ...(lastName && !prior.lastName ? { lastName } : {}),
        // Consent is only ever granted here, never revoked: someone already
        // mailable must not become unmailable because an older, pending lead
        // for the same address was found.
        ...(consented && prior.consent?.marketing !== true
          ? {
              consent: {
                marketing: true,
                at: lead.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
                method: `website-backfill:${lead.source}`,
              },
            }
          : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tally.merged++;
    } else {
      await ref.set({
        email,
        firstName,
        lastName,
        tags,
        status: 'active',
        source: 'import',
        route,
        consent: {
          marketing: consented,
          at: lead.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
          method: `website-backfill:${lead.source}`,
        },
        totalSent: 0,
        openCount: 0,
        clickCount: 0,
        createdAt: lead.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      tally.created++;
    }
  }

  console.log('Leads read ................ ', tally.read);
  console.log('Subscribers created ....... ', tally.created);
  console.log('Existing records merged ... ', tally.merged);
  console.log('Skipped, already opted out  ', tally.skippedUnmailable);
  console.log('Imported without consent .. ', tally.skippedPending, '(double opt-in never completed)');
  console.log('Skipped, invalid address .. ', tally.skippedInvalid);

  const unknown = Object.entries(tally.unknownSource);
  if (unknown.length) {
    console.log('\nUNRECOGNISED SOURCES — not imported:');
    for (const [src, n] of unknown) console.log(`  ${src}: ${n}`);
    console.log('Add these to ROUTE_BY_SOURCE (and to src/lib/marketing/sources.ts) and re-run.');
  }

  console.log(
    DRY_RUN
      ? '\nDry run only. Re-run without --dry-run to write.\n'
      : '\nDone. No events were emitted, so nobody was enrolled in a journey.\n',
  );
}

main().catch((err) => {
  console.error('\nPort failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
