// scripts/verify-hxmailer-suppression.ts
//
// Read-only preflight for the HXMailer migration. Answers one question: does
// HXMailer agree with itself about who unsubscribed?
//
// The migration carries `consent.marketing: true` for every subscriber still
// marked active, on the reasoning that they were on a list actively mailing
// them. That reasoning only holds if `status` is actually trustworthy — and
// HXMailer recorded an unsubscribe in three places:
//
//   1. subscribers/{id}.status            <- the only one the migration reads
//   2. campaigns/{id}.unsubscribeCount    <- incremented, fire-and-forget
//   3. campaigns/{id}/sends/{id}.unsubscribed
//
// Writes 2 and 3 were not awaited, so they can be lost. Write 1 was awaited, so
// it should be the most complete of the three. If 2 or 3 carry evidence that 1
// does not, someone opted out and the migration is about to mark them mailable.
//
// Usage:
//   HXMAILER_SERVICE_ACCOUNT_KEY="$(cat ~/hxmailer-key.json)" \
//   npx tsx scripts/verify-hxmailer-suppression.ts

import * as admin from 'firebase-admin';

function initSource(): admin.firestore.Firestore {
  const raw = process.env.HXMAILER_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('HXMAILER_SERVICE_ACCOUNT_KEY is not set.');

  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }

  const existing = admin.apps.find((a) => a?.name === 'hxmailer-verify');
  const app =
    existing ??
    admin.initializeApp(
      { credential: admin.credential.cert(serviceAccount) },
      'hxmailer-verify',
    );

  return app.firestore();
}

async function main() {
  const db = initSource();

  // Phantom parents: HXMailer never wrote a users/{uid} document, only the
  // subcollections beneath it. Same reason the migration uses listDocuments().
  const userRefs = await db.collection('users').listDocuments();
  console.log(`\n=== HXMailer suppression cross-check ===\n`);
  console.log(`Accounts: ${userRefs.length}\n`);

  const byStatus = new Map<string, number>();
  /** Subscriber ids the send rows say opted out. */
  const unsubscribedBySends = new Set<string>();
  let campaignUnsubTotal = 0;
  let sendsScanned = 0;

  for (const userRef of userRefs) {
    const uid = userRef.id;

    const subs = await db.collection(`users/${uid}/subscribers`).get();
    for (const doc of subs.docs) {
      const status = (doc.data().status as string) ?? '(unset)';
      byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    }

    const campaigns = await db.collection(`users/${uid}/campaigns`).get();
    for (const campaign of campaigns.docs) {
      campaignUnsubTotal += (campaign.data().unsubscribeCount as number) ?? 0;

      const sends = await db
        .collection(`users/${uid}/campaigns/${campaign.id}/sends`)
        .get();

      for (const send of sends.docs) {
        sendsScanned++;
        const data = send.data();
        if (data.unsubscribed === true && data.subscriberId) {
          unsubscribedBySends.add(`${uid}/${data.subscriberId as string}`);
        }
      }
    }
  }

  console.log('Subscriber status tally (what the migration reads):');
  for (const [status, count] of [...byStatus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status.padEnd(16)} ${count}`);
  }

  const flaggedByStatus = byStatus.get('unsubscribed') ?? 0;

  console.log(`\nOther evidence of unsubscribes:`);
  console.log(`  campaign unsubscribeCount total   ${campaignUnsubTotal}`);
  console.log(`  send rows marked unsubscribed     ${unsubscribedBySends.size}`);
  console.log(`  (${sendsScanned} send rows scanned)`);

  // The send rows are the actionable signal: unlike the campaign counter, they
  // name *which* subscriber, so a discrepancy can be resolved rather than only
  // detected.
  const missing: string[] = [];
  for (const key of unsubscribedBySends) {
    const [uid, subscriberId] = key.split('/');
    const snap = await db.doc(`users/${uid}/subscribers/${subscriberId}`).get();
    if (!snap.exists) continue; // deleted subscriber; nothing to resurrect
    if (snap.data()?.status !== 'unsubscribed') {
      missing.push(`${snap.data()?.email ?? subscriberId}  (${uid}/${subscriberId})`);
    }
  }

  console.log('');
  if (missing.length) {
    console.log(`MISMATCH — ${missing.length} subscriber(s) have a send row marked`);
    console.log(`unsubscribed but are not marked unsubscribed on their own record.`);
    console.log(`The migration would carry these across as mailable, with consent:\n`);
    for (const line of missing) console.log(`  ${line}`);
    console.log(`\nFix these in HXMailer, or suppress them after migrating, before sending.`);
    process.exit(2);
  }

  if (campaignUnsubTotal > flaggedByStatus) {
    console.log(`INCONCLUSIVE — campaign counters record ${campaignUnsubTotal} unsubscribe(s)`);
    console.log(`but only ${flaggedByStatus} subscriber(s) carry the status, and no send row`);
    console.log(`names the difference. The counter is incremented fire-and-forget and can`);
    console.log(`double-count a reloaded link, so this may be benign — but confirm before`);
    console.log(`the first send.`);
    process.exit(3);
  }

  console.log(`CONSISTENT — every recorded unsubscribe is reflected on the subscriber.`);
  console.log(`The ${flaggedByStatus} suppressed record(s) will carry across as unsubscribed.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('\nVerification failed:', err);
    process.exit(1);
  });
