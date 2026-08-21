// scripts/check-activity.ts
//
// Answers one question: has the workout-activity scan actually counted
// anything, or did it declare itself caught up without doing any work?
//
// The cron reports `caughtUp: true, scanned: 0` in two completely different
// situations — it walked the whole history and finished, or it read an empty
// page on its first pass and concluded there was nothing to read. Those look
// identical from the outside and mean opposite things.
//
// The difference matters more than it sounds. `completedWorkouts` is what
// `noWorkoutAfterNDays` reads, and that trigger fires when the counter is zero.
// If the scan never counted anybody, every athlete on the roster matches it —
// including people training four times a week — and the seeded re-engagement
// journey would tell all of them they have never logged a session.
//
// Usage, with gcloud signed in:
//   gcloud auth application-default login
//   npx tsx scripts/check-activity.ts

import * as admin from 'firebase-admin';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'hyroxedgeai';

/** Must match COUNTED_FIELD in src/lib/marketing/activity.ts. */
const COUNTED = 'marketingCounted';

function credential(): admin.credential.Credential {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) return admin.credential.applicationDefault();
  const serviceAccount = JSON.parse(raw);
  if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  }
  return admin.credential.cert(serviceAccount);
}

const app =
  admin.apps.find((a) => a?.name === 'check') ??
  admin.initializeApp({ credential: credential(), projectId: PROJECT_ID }, 'check');
const db = app.firestore();

async function main() {
  console.log(`\n=== Activity scan check — ${PROJECT_ID} ===\n`);

  // 1 — The cursor. `lastFinishedAt` is only written after a pass that actually
  //     processed sessions, so its absence alongside caughtUp is the tell.
  const stateSnap = await db.doc('marketingSettings/activity').get();
  const state = stateSnap.data() ?? {};
  const lastFinishedAt = state.lastFinishedAt as admin.firestore.Timestamp | undefined;

  console.log('Scan state');
  console.log(`  exists ............ ${stateSnap.exists}`);
  console.log(`  caughtUp .......... ${state.caughtUp === true}`);
  console.log(
    `  lastFinishedAt .... ${lastFinishedAt ? lastFinishedAt.toDate().toISOString() : '(never set)'}`,
  );

  // 2 — The stream it reads, and how much of it carries the counted marker.
  const epoch = admin.firestore.Timestamp.fromMillis(0);
  const [finished, counted, sessionsTotal] = await Promise.all([
    db.collection('workoutSessions').where('finishedAt', '>=', epoch).count().get(),
    db.collection('workoutSessions').where('marketingCounted', '==', true).count().get(),
    db.collection('workoutSessions').count().get(),
  ]);

  const finishedCount = finished.data().count;
  const countedCount = counted.data().count;

  console.log('\nWorkout sessions');
  console.log(`  total ............. ${sessionsTotal.data().count}`);
  console.log(`  with finishedAt ... ${finishedCount}`);
  console.log(`  counted by scan ... ${countedCount}`);

  // 3 — The counter the triggers actually read.
  const [users, withCounter] = await Promise.all([
    db.collection('users').count().get(),
    db.collection('users').where('completedWorkouts', '>', 0).count().get(),
  ]);

  const userCount = users.data().count;
  const withCounterCount = withCounter.data().count;

  console.log('\nAthletes');
  console.log(`  total ............. ${userCount}`);
  console.log(`  completedWorkouts > 0 ... ${withCounterCount}`);

  // 4 — Reconciliation. The counted marker and the counter increment commit in
  //     the same transaction, so every marked session should be reflected in
  //     exactly one athlete's total. Checking that directly is the difference
  //     between "the numbers look plausible" and "the numbers agree".
  const sessionDocs = await db
    .collection('workoutSessions')
    .where('finishedAt', '>=', epoch)
    .get();

  const countedByUser = new Map<string, number>();
  let orphanSessions = 0; // marked, but userId missing from the doc
  let skippedSessions = 0;
  let uncountedNotSkipped = 0;

  for (const doc of sessionDocs.docs) {
    const data = doc.data();
    const isCounted = data[COUNTED] === true;
    const isSkipped = data.skipped === true;
    if (isSkipped) skippedSessions++;
    if (!isCounted) {
      if (!isSkipped) uncountedNotSkipped++;
      continue;
    }
    const userId = data.userId as string | undefined;
    if (!userId) {
      orphanSessions++;
      continue;
    }
    countedByUser.set(userId, (countedByUser.get(userId) ?? 0) + 1);
  }

  console.log('\nCounted sessions by athlete');
  console.log(`  distinct athletes . ${countedByUser.size}`);
  console.log(`  no userId ......... ${orphanSessions}`);
  console.log(`  skipped (excluded)  ${skippedSessions}`);
  console.log(`  uncounted, not skipped ... ${uncountedNotSkipped}`);

  // Does each athlete's stored total match the sessions actually marked for them?
  const mismatches: string[] = [];
  const missingUsers: string[] = [];
  for (const [userId, expected] of countedByUser) {
    const userSnap = await db.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      missingUsers.push(`${userId} (${expected} sessions)`);
      continue;
    }
    const actual = (userSnap.data()?.completedWorkouts as number | undefined) ?? 0;
    if (actual !== expected) {
      mismatches.push(`${userId}: counter=${actual}, marked sessions=${expected}`);
    }
  }

  console.log(`  counters agreeing . ${countedByUser.size - mismatches.length - missingUsers.length}/${countedByUser.size}`);
  if (missingUsers.length) {
    console.log('  sessions for deleted accounts:');
    for (const line of missingUsers) console.log(`    ${line}`);
  }
  if (mismatches.length) {
    console.log('  DISAGREEING counters:');
    for (const line of mismatches) console.log(`    ${line}`);
  }

  // ---- Verdict -----------------------------------------------------------
  console.log('\n=== Verdict ===\n');

  if (finishedCount === 0) {
    console.log('No finished sessions exist at all, so there is nothing to count.');
    console.log('`caughtUp: true` is correct and harmless — but so is every athlete');
    console.log('having a zero counter, which means noWorkoutAfterNDays would match');
    console.log('everyone. Do NOT activate the re-engagement journey.');
  } else if (countedCount === 0) {
    console.log('PROBLEM: there are finished sessions, and the scan has counted none.');
    console.log('It declared itself caught up without doing any work, so every');
    console.log('athlete still reads as having trained zero times.');
    console.log('');
    console.log('Do NOT activate the re-engagement journey — it would tell athletes');
    console.log('who train regularly that they have never logged a session.');
    console.log('');
    console.log('To re-run the backfill from the beginning:');
    console.log('  npx tsx scripts/check-activity.ts --reset');
  } else if (countedCount < finishedCount) {
    const pct = Math.round((countedCount / finishedCount) * 100);
    console.log(`Partly counted: ${countedCount} of ${finishedCount} sessions (${pct}%).`);
    console.log('If caughtUp is already true, the remainder are skipped sessions,');
    console.log('which are deliberately not counted. If the gap is large, the scan');
    console.log('stopped early — check the app logs for the activity scan.');
  } else {
    console.log(`Counting is working: ${countedCount} of ${finishedCount} finished`);
    console.log(`sessions counted, across ${countedByUser.size} athlete(s).`);
    console.log('');

    // The number that decides whether the re-engagement journey is safe to turn
    // on. It is NOT simply "everyone with a zero counter" — the trigger also
    // requires trialStartDate to sit in a 24-hour window:
    //
    //   if ((user.completedWorkouts ?? 0) > 0) return false;
    //   const since = daysSince(toDate(user.trialStartDate));
    //   return since !== null && since >= days && since < days + 1;
    //
    // So an athlete with no trialStartDate never matches, and one who signed up
    // months ago never matches either. What actually goes out on a given night
    // is one day's cohort, which on a small roster is usually nobody.
    const TRIGGER_DAYS = 3; // seeded-re-engagement
    const usersSnap = await db.collection('users').get();

    let neverTrained = 0;
    let neverTrainedNoTrialDate = 0;
    let dueTonight = 0;
    let signedUpLast30 = 0;

    for (const doc of usersSnap.docs) {
      const data = doc.data();
      if (((data.completedWorkouts as number | undefined) ?? 0) > 0) continue;
      neverTrained++;

      const raw = data.trialStartDate;
      const started =
        raw && typeof raw === 'object' && typeof raw.toDate === 'function'
          ? (raw.toDate() as Date)
          : null;
      if (!started) {
        neverTrainedNoTrialDate++;
        continue;
      }

      const since = (Date.now() - started.getTime()) / 86_400_000;
      if (since >= TRIGGER_DAYS && since < TRIGGER_DAYS + 1) dueTonight++;
      if (since < 30) signedUpLast30++;
    }

    console.log('Re-engagement exposure (seeded-re-engagement, day 3)');
    console.log(`  athletes who have trained ......... ${withCounterCount}`);
    console.log(`  never trained .................... ${neverTrained}`);
    console.log(`    ...of those, no trialStartDate .. ${neverTrainedNoTrialDate} (can never match)`);
    console.log(`  signed up in the last 30 days .... ${signedUpLast30}`);
    console.log(`  IN THE DAY-3 WINDOW RIGHT NOW .... ${dueTonight}`);
    console.log('');

    if (dueTonight === 0) {
      console.log('Nobody is in the window right now, so activating this journey');
      console.log('sends nothing today. It will pick up new signups as they reach');
      console.log(`day 3 — roughly ${Math.max(1, Math.round(signedUpLast30 / 30))} athlete(s) a day at the current rate.`);
    } else {
      console.log(`Activating now would mail ${dueTonight} athlete(s) on the next journeys pass.`);
    }
    console.log('');
    console.log('The copy says "We miss you" / "Still here when you are", which fits');
    console.log('someone who signed up and stalled — which is exactly who this');
    console.log('targets, since the trigger requires a zero counter. Read it once in');
    console.log('the console before activating, but the aim is right.');
  }

  // Opt-in reset, for when the verdict above says the scan did nothing.
  if (process.argv.includes('--reset')) {
    await db.doc('marketingSettings/activity').set(
      { caughtUp: false, lastFinishedAt: null, lastIds: [] },
      { merge: true },
    );
    console.log('\nCursor reset. The next journeys cron pass will re-walk history from');
    console.log('the beginning, silently, and will not emit events until it finishes.');
  }

  console.log('');
}

main().catch((err) => {
  console.error('\nCheck failed:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
