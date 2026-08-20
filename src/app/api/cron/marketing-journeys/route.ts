// src/app/api/cron/marketing-journeys/route.ts
//
// The automation heartbeat. Runs every few minutes and does three things:
// enrol from pending events, advance runs whose next step is due, and — once a
// day — evaluate the derived triggers that no event can raise.
//
// Email steps enqueue into the Phase 2 send queue, so /api/cron/marketing-send
// still does the actual sending.

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { sweepBackdatedActivity, syncWorkoutActivity } from '@/lib/marketing/activity';
import { advanceRuns, evaluateDerivedTriggers, processEvents } from '@/lib/marketing/engine';
import { pruneProcessedEvents } from '@/lib/marketing/events';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const url = new URL(request.url);

  // Derived triggers ask "is this state true now?", so they are evaluated once
  // a day rather than on every pass — running them every few minutes would scan
  // the whole roster repeatedly for the same answer. The daily scheduler entry
  // passes ?derived=1.
  const runDerived = url.searchParams.get('derived') === '1';

  try {
    // Before processing events, advance the activity scan so anything finished
    // since the last pass has raised its events and updated the counters the
    // derived triggers read. Ordering matters: run it after processEvents and a
    // first workout would wait a full cycle to enrol.
    //
    // Isolated, though. Enrolment, derived triggers and run advancement do not
    // depend on the scan's result, and coupling them to it means one quota error
    // or one slow backfill page defers every journey step in the system —
    // precisely when the scan is most likely to keep failing.
    const activity = await syncWorkoutActivity().catch((err) => {
      logger.error('[cron/marketing-journeys] activity scan failed:', err);
      return null;
    });

    // Back-dated sessions — a manual log, a Strava import — sit below the
    // forward scan's watermark and are invisible to it. Swept daily.
    const backdated = runDerived
      ? await sweepBackdatedActivity().catch((err) => {
          logger.error('[cron/marketing-journeys] back-dated sweep failed:', err);
          return null;
        })
      : null;

    const events = await processEvents();
    const derived = runDerived ? await evaluateDerivedTriggers() : { enrolled: 0 };
    const advanced = await advanceRuns();

    // Housekeeping on the daily pass only: processed events are a log, and an
    // unbounded collection slowly degrades every query against it.
    const pruned = runDerived ? await pruneProcessedEvents() : 0;

    return NextResponse.json({
      activity,
      ...(backdated ? { backdated } : {}),
      events: events.processed,
      enrolledFromEvents: events.enrolled,
      enrolledFromDerived: derived.enrolled,
      ...advanced,
      pruned,
    });
  } catch (error) {
    logger.error('[cron/marketing-journeys] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Journey run failed' },
      { status: 500 },
    );
  }
}
