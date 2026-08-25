// scripts/check-ai-flows.ts
//
// Smoke-test the AI flows that cron jobs depend on, against the live API.
//
// Written after a schema problem took campaign drafting down for days while
// producing only a bare 400 that named no field. Three rounds of reasoning
// about the schema got it wrong; one measurement got it right. daily-coach's
// flow had never executed in production at all, so this exists to find that
// class of failure at a keyboard rather than at 3am in a job nobody watches.
//
//   GEMINI_API_KEY=... npx tsx scripts/check-ai-flows.ts
//
// Makes a small number of real API calls. Writes nothing.

import { analyzeAndAdjust } from '../src/ai/flows/analyze-and-adjust';

async function check(name: string, run: () => Promise<unknown>) {
  process.stdout.write(`  ${name} ... `);
  try {
    const out = await run();
    console.log('PASS');
    return { name, ok: true, out };
  } catch (err) {
    const e = err as { message?: string; detail?: unknown };
    console.log('FAIL');
    console.log(`      ${e?.message ?? String(err)}`);
    if (e?.detail) console.log(`      detail: ${JSON.stringify(e.detail)}`);
    return { name, ok: false };
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY is not set — nothing can be checked.');
    process.exit(2);
  }

  console.log('Checking AI flows used by cron jobs:\n');

  const results = [];

  // Exactly the shape daily-coach sends: one skipped session, one upcoming
  // workout. If this fails, the nightly job fails for every athlete.
  results.push(
    await check('analyzeAndAdjust (daily-coach)', () =>
      analyzeAndAdjust({
        userName: 'there',
        userGoal: 'general fitness',
        recentHistory: [
          {
            date: new Date().toISOString().slice(0, 10),
            workoutTitle: 'Scheduled Workout',
            skipped: true,
            notes: 'System detected missed session.',
          },
        ],
        upcomingWorkouts: [
          {
            day: 8,
            title: 'Engine Room',
            programType: 'hyrox',
            exercises: [{ name: 'Wall balls', details: '4x15' }],
            runs: [],
          },
        ],
        customRequest: 'I missed yesterday. Should I adjust today?',
      }),
    ),
  );

  // The same flow with an athlete who set neither name nor goal — daily-coach
  // substitutes defaults for these, and this proves the substitution is enough
  // to satisfy the input schema.
  results.push(
    await check('analyzeAndAdjust (missing profile fields)', () =>
      analyzeAndAdjust({
        userName: 'there',
        userGoal: 'general fitness',
        recentHistory: [
          { date: '2026-08-24', workoutTitle: 'Scheduled Workout', skipped: true },
        ],
        upcomingWorkouts: [
          { day: 1, title: 'Foundation', programType: 'running', exercises: [], runs: [] },
        ],
      }),
    ),
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
