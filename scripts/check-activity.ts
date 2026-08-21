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
    console.log(`Healthy: ${countedCount} sessions counted, ${withCounterCount} of`);
    console.log(`${userCount} athletes carry a non-zero counter. The behavioural`);
    console.log('triggers and engagement segments have real data behind them.');
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
