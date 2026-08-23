// scripts/migrate-hxmailer.ts
//
// One-shot migration from the standalone HXMailer app into this codebase.
//
//   Source: Firebase project studio-2581739992-b1f46, data siloed per HXMailer
//           user under users/{uid}/{subscribers,campaigns,plans,appSettings}
//   Target: this project (hyroxedgeai), top-level marketing* collections
//
// Two things make this more than a copy:
//
//   1. Re-rooting. HXMailer nested everything under users/{uid} because it had
//      a per-user silo model. Here `users` holds athlete records, so the data
//      has to move to top-level collections. Multiple HXMailer users collapse
//      into one shared list.
//
//   2. Deduplication. Subscriber ids become sha256 of the email, so the same
//      person present under two HXMailer accounts becomes one record. Tags are
//      unioned and — the rule that matters — any unsubscribe wins over any
//      active status. Losing a tag is an inconvenience; resurrecting someone
//      who opted out is a compliance failure.
//
// Usage:
//   HXMAILER_SERVICE_ACCOUNT_KEY='<json>' \
//   FIREBASE_SERVICE_ACCOUNT_KEY='<json>' \
//   npx tsx scripts/migrate-hxmailer.ts --dry-run
//
// Idempotent: safe to run repeatedly. Run --dry-run first and reconcile the
// counts against the HXMailer admin before running it live.

import * as admin from 'firebase-admin';
import { createHash } from 'crypto';

const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

function initApp(name: string, keyEnv: string): admin.firestore.Firestore {
  const raw = process.env[keyEnv];
  if (!raw) throw new Error(`${keyEnv} is not set.`);

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    // Keys pasted into env vars usually arrive with literal \n sequences.
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const existing = admin.apps.find((a) => a?.name === name);
  const app =
    existing ??
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) }, name);

  return app.firestore();
}

// ---------------------------------------------------------------------------
// Helpers, mirrored from src/lib/marketing so the script needs no app imports
// ---------------------------------------------------------------------------

const normaliseEmail = (email: string) => email.trim().toLowerCase();
const subscriberId = (email: string) =>
  createHash('sha256').update(normaliseEmail(email)).digest('hex');

const UNMAILABLE = ['unsubscribed', 'bounced', 'complained'];

interface Stats {
  hxUsers: number;
  subscribersRead: number;
  subscribersWritten: number;
  duplicatesMerged: number;
  suppressionsPreserved: number;
  invalidSkipped: number;
  campaigns: number;
  sends: number;
  linkClicks: number;
  plans: number;
  settings: number;
  userIdsLinked: number;
}

const stats: Stats = {
  hxUsers: 0,
  subscribersRead: 0,
  subscribersWritten: 0,
  duplicatesMerged: 0,
  suppressionsPreserved: 0,
  invalidSkipped: 0,
  campaigns: 0,
  sends: 0,
  linkClicks: 0,
  plans: 0,
  settings: 0,
  userIdsLinked: 0,
};

interface MergedSubscriber {
  email: string;
  firstName: string;
  lastName: string;
  tags: Set<string>;
  status: string;
  statusReason?: string;
  totalSent: number;
  openCount: number;
  clickCount: number;
  createdAt: FirebaseFirestore.Timestamp | null;
  /** Original HXMailer document ids, so send rows can be re-pointed. */
  legacyIds: Set<string>;
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

/**
 * Read every HXMailer user's subscribers and merge them by email address.
 *
 * Returns both the merged records and a map from each legacy subscriber id to
 * its new id, which the campaign migration needs to rewrite send rows.
 */
async function collectSubscribers(
  source: FirebaseFirestore.Firestore,
  hxUserIds: string[],
): Promise<{ merged: Map<string, MergedSubscriber>; legacyToNew: Map<string, string> }> {
  const merged = new Map<string, MergedSubscriber>();
  const legacyToNew = new Map<string, string>();

  for (const uid of hxUserIds) {
    const snap = await source.collection(`users/${uid}/subscribers`).get();

    for (const doc of snap.docs) {
      stats.subscribersRead++;
      const data = doc.data();
      const rawEmail = data.email as string | undefined;

      if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normaliseEmail(rawEmail))) {
        stats.invalidSkipped++;
        continue;
      }

      const email = normaliseEmail(rawEmail);
      const newId = subscriberId(email);
      legacyToNew.set(`${uid}/${doc.id}`, newId);

      const existing = merged.get(newId);
      if (!existing) {
        merged.set(newId, {
          email,
          firstName: data.firstName ?? '',
          lastName: data.lastName ?? '',
          tags: new Set<string>(data.tags ?? []),
          status: data.status === 'unsubscribed' ? 'unsubscribed' : 'active',
          totalSent: data.totalSent ?? 0,
          openCount: data.openCount ?? 0,
          clickCount: data.clickCount ?? 0,
          createdAt: data.createdAt ?? null,
          legacyIds: new Set([doc.id]),
        });
        continue;
      }

      stats.duplicatesMerged++;
      existing.legacyIds.add(doc.id);
      for (const tag of (data.tags ?? []) as string[]) existing.tags.add(tag);

      if (!existing.firstName && data.firstName) existing.firstName = data.firstName;
      if (!existing.lastName && data.lastName) existing.lastName = data.lastName;

      // Unsubscribe always wins. Someone who opted out under one HXMailer
      // account must not become mailable because another account still had them
      // active.
      if (data.status === 'unsubscribed' && !UNMAILABLE.includes(existing.status)) {
        existing.status = 'unsubscribed';
        existing.statusReason = 'Unsubscribed in HXMailer before migration';
        stats.suppressionsPreserved++;
      }

      existing.totalSent += data.totalSent ?? 0;
      existing.openCount += data.openCount ?? 0;
      existing.clickCount += data.clickCount ?? 0;
    }
  }

  return { merged, legacyToNew };
}

/**
 * Write the merged subscribers.
 *
 * Consent is carried across as `true` for anyone still active. That is a
 * judgement, not a default: these people were on a list that was actively
 * mailing them, so treating them as opted out would silently discard the
 * audience. The record documents the provenance as 'hxmailer-migration' so the
 * basis for consent stays auditable.
 */
async function writeSubscribers(
  target: FirebaseFirestore.Firestore,
  merged: Map<string, MergedSubscriber>,
): Promise<void> {
  if (DRY_RUN) {
    stats.subscribersWritten = merged.size;
    return;
  }

  const writer = target.bulkWriter();

  for (const [id, sub] of merged) {
    const ref = target.collection('marketingSubscribers').doc(id);
    const existing = await ref.get();

    // Never downgrade a record this system already knows about. A re-run must
    // not undo an unsubscribe that happened after the first migration.
    if (existing.exists && UNMAILABLE.includes(existing.data()?.status)) {
      const tags = Array.from(sub.tags);
      writer.update(ref, {
        // arrayUnion() rejects an empty argument list, and it throws where the
        // call is made rather than on the write — so an untagged subscriber
        // would abort the whole migration rather than fail one record.
        ...(tags.length ? { tags: admin.firestore.FieldValue.arrayUnion(...tags) } : {}),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      stats.subscribersWritten++;
      continue;
    }

    const isActive = sub.status === 'active';

    writer.set(
      ref,
      {
        email: sub.email,
        firstName: sub.firstName,
        lastName: sub.lastName,
        tags: Array.from(sub.tags),
        status: sub.status,
        ...(sub.statusReason ? { statusReason: sub.statusReason } : {}),
        source: 'migration',
        consent: {
          marketing: isActive,
          at: sub.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
          method: 'hxmailer-migration',
        },
        totalSent: sub.totalSent,
        openCount: sub.openCount,
        clickCount: sub.clickCount,
        createdAt: sub.createdAt ?? admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    stats.subscribersWritten++;
  }

  await writer.close();
}

/** Link migrated subscribers to athlete accounts where the email matches. */
async function linkAthletes(
  target: FirebaseFirestore.Firestore,
  merged: Map<string, MergedSubscriber>,
): Promise<void> {
  const usersSnap = await target.collection('users').select('email').get();

  const byEmail = new Map<string, string>();
  for (const doc of usersSnap.docs) {
    const email = doc.data().email as string | undefined;
    if (email) byEmail.set(normaliseEmail(email), doc.id);
  }

  const writer = DRY_RUN ? null : target.bulkWriter();

  for (const [id, sub] of merged) {
    const userId = byEmail.get(sub.email);
    if (!userId) continue;

    stats.userIdsLinked++;
    writer?.update(target.collection('marketingSubscribers').doc(id), {
      userId,
      tags: admin.firestore.FieldValue.arrayUnion('athlete'),
    });
  }

  await writer?.close();
}

// ---------------------------------------------------------------------------
// Campaigns, sends and link clicks
// ---------------------------------------------------------------------------

async function migrateCampaigns(
  source: FirebaseFirestore.Firestore,
  target: FirebaseFirestore.Firestore,
  hxUserIds: string[],
  legacyToNew: Map<string, string>,
): Promise<void> {
  for (const uid of hxUserIds) {
    const campaigns = await source.collection(`users/${uid}/campaigns`).get();

    for (const doc of campaigns.docs) {
      stats.campaigns++;
      const data = doc.data();
      const campaignId = doc.id;
      const targetRef = target.collection('marketingCampaigns').doc(campaignId);

      if (!DRY_RUN) {
        await targetRef.set(
          {
            subject: data.subject ?? '',
            previewText: data.previewText ?? '',
            htmlBody: data.htmlBody ?? '',
            // No `blocks`: migrated campaigns are HTML-only. The editor treats
            // a block-less campaign as legacy content and shows it read-only
            // rather than pretending it can be edited block by block.
            status: data.status === 'sent' ? 'sent' : 'draft',
            campaignGoal: data.campaignGoal ?? null,
            targetAudience: data.targetAudience ?? null,
            targetTags: data.targetTags ?? [],
            scheduledAt: data.scheduledAt ?? null,
            sentAt: data.sentAt ?? null,
            recipientCount: data.recipientCount ?? 0,
            openCount: data.openCount ?? 0,
            clickCount: data.clickCount ?? 0,
            unsubscribeCount: data.unsubscribeCount ?? 0,
            failedCount: data.failedCount ?? 0,
            folder: data.folder ?? null,
            archived: data.archived ?? false,
            ctaUrl: data.ctaUrl ?? null,
            ctaLabel: data.ctaLabel ?? null,
            createdAt: data.createdAt ?? null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            migratedFrom: `${uid}/${campaignId}`,
          },
          { merge: true },
        );
      }

      await migrateSends(source, target, uid, campaignId, legacyToNew);
      await migrateLinkClicks(source, target, uid, campaignId);
    }
  }
}

async function migrateSends(
  source: FirebaseFirestore.Firestore,
  target: FirebaseFirestore.Firestore,
  uid: string,
  campaignId: string,
  legacyToNew: Map<string, string>,
): Promise<void> {
  const sends = await source.collection(`users/${uid}/campaigns/${campaignId}/sends`).get();
  if (sends.empty) return;

  const writer = DRY_RUN ? null : target.bulkWriter();

  for (const doc of sends.docs) {
    const data = doc.data();
    const legacyKey = `${uid}/${data.subscriberId}`;
    const newSubscriberId = legacyToNew.get(legacyKey);

    // A send whose subscriber no longer resolves would produce an orphan row
    // that inflates the campaign's totals without belonging to anyone.
    if (!newSubscriberId) continue;

    stats.sends++;

    // Re-key to the id scheme this system uses, which is also what makes the
    // send idempotent going forward.
    writer?.set(
      target
        .collection('marketingCampaigns')
        .doc(campaignId)
        .collection('sends')
        .doc(`${campaignId}_${newSubscriberId}`),
      {
        campaignId,
        subscriberId: newSubscriberId,
        email: normaliseEmail(data.email ?? ''),
        status: data.failed ? 'failed' : 'sent',
        attempts: 1,
        ...(data.failureReason ? { lastError: data.failureReason } : {}),
        queuedAt: data.sentAt ?? null,
        sentAt: data.sentAt ?? null,
        opened: data.opened ?? false,
        openedAt: data.openedAt ?? null,
        // HXMailer had no bot filtering, so its opens are the raw figure.
        // Recording them as openRaw keeps historical numbers visible without
        // letting them masquerade as the filtered metric this system reports.
        openRaw: data.opened ? 1 : 0,
        clicked: data.clicked ?? false,
        clickedAt: data.clickedAt ?? null,
        unsubscribed: data.unsubscribed ?? false,
        unsubscribedAt: data.unsubscribedAt ?? null,
      },
      { merge: true },
    );
  }

  await writer?.close();
}

async function migrateLinkClicks(
  source: FirebaseFirestore.Firestore,
  target: FirebaseFirestore.Firestore,
  uid: string,
  campaignId: string,
): Promise<void> {
  const links = await source.collection(`users/${uid}/campaigns/${campaignId}/linkClicks`).get();
  if (links.empty) return;

  const writer = DRY_RUN ? null : target.bulkWriter();

  for (const doc of links.docs) {
    stats.linkClicks++;
    writer?.set(
      target
        .collection('marketingCampaigns')
        .doc(campaignId)
        .collection('linkClicks')
        .doc(doc.id),
      doc.data(),
      { merge: true },
    );
  }

  await writer?.close();
}

// ---------------------------------------------------------------------------
// Plans and settings
// ---------------------------------------------------------------------------

async function migratePlans(
  source: FirebaseFirestore.Firestore,
  target: FirebaseFirestore.Firestore,
  hxUserIds: string[],
): Promise<void> {
  for (const uid of hxUserIds) {
    const plans = await source.collection(`users/${uid}/plans`).get();

    for (const doc of plans.docs) {
      stats.plans++;
      if (DRY_RUN) continue;

      // Archived read-only: the studio supersedes the old planner, but the
      // plans are worth keeping as a record of what was run.
      await target
        .collection('marketingPlans')
        .doc(doc.id)
        .set({ ...doc.data(), archived: true, migratedFrom: uid }, { merge: true });
    }
  }
}

async function migrateSettings(
  source: FirebaseFirestore.Firestore,
  target: FirebaseFirestore.Firestore,
  hxUserIds: string[],
): Promise<void> {
  for (const uid of hxUserIds) {
    const snap = await source.doc(`users/${uid}/appSettings/app_settings`).get();
    if (!snap.exists) continue;

    const data = snap.data()!;
    stats.settings++;
    if (DRY_RUN) continue;

    // refreshToken is deliberately dropped. Sending goes through Brevo now, and
    // carrying a live Gmail OAuth grant into the new project would import a
    // credential nothing uses and nobody is watching.
    await target.doc('marketingSettings/config').set(
      {
        senderName: data.senderName ?? 'HYBRIDX',
        replyTo: data.replyTo ?? '',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  }
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n=== HXMailer migration ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE)'} ===\n`);

  const source = initApp('hxmailer-source', 'HXMAILER_SERVICE_ACCOUNT_KEY');
  const target = initApp('hybridx-target', 'FIREBASE_SERVICE_ACCOUNT_KEY');

  const hxUsers = await source.collection('users').get();
  const hxUserIds = hxUsers.docs.map((d) => d.id);
  stats.hxUsers = hxUserIds.length;
  console.log(`Found ${hxUserIds.length} HXMailer accounts to merge.\n`);

  console.log('Reading subscribers…');
  const { merged, legacyToNew } = await collectSubscribers(source, hxUserIds);
  console.log(`  ${stats.subscribersRead} read, ${merged.size} unique after dedupe.`);

  console.log('Writing subscribers…');
  await writeSubscribers(target, merged);

  console.log('Linking to athlete accounts…');
  await linkAthletes(target, merged);

  console.log('Migrating campaigns, sends and link clicks…');
  await migrateCampaigns(source, target, hxUserIds, legacyToNew);

  console.log('Migrating plans and settings…');
  await migratePlans(source, target, hxUserIds);
  await migrateSettings(source, target, hxUserIds);

  console.log('\n=== Summary ===');
  for (const [key, value] of Object.entries(stats)) {
    console.log(`  ${key.padEnd(24)} ${value}`);
  }

  const suppressed = Array.from(merged.values()).filter((s) => UNMAILABLE.includes(s.status));
  console.log(`\n  ${suppressed.length} subscribers carried across as unsubscribed.`);
  console.log(`  ${merged.size - suppressed.length} are mailable.`);

  if (DRY_RUN) {
    console.log('\nDry run — nothing was written. Reconcile these counts against the');
    console.log('HXMailer admin, then re-run without --dry-run.\n');
  } else {
    console.log('\nMigration complete. Next: spot-check a historical campaign report,');
    console.log('then send one real campaign to an internal tag before cutting over.\n');
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  });
