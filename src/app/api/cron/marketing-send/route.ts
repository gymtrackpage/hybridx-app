// src/app/api/cron/marketing-send/route.ts
//
// The send engine's heartbeat. Runs every minute; each invocation drains a
// bounded slice of whatever is queued and returns. A campaign larger than one
// invocation can handle simply spans several.
//
// Scheduled campaigns come through the same path: the scheduler enqueues them
// and the drain sends them, so there is exactly one code path that puts a
// campaign in front of a recipient.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import {
  CAMPAIGNS,
  campaignAudience,
  drainCampaign,
  enqueueCampaign,
  findDueCampaigns,
  getSettings,
  pauseStaleScheduled,
  recoverStalledSends,
} from '@/lib/marketing/queue';
import type { Campaign } from '@/lib/marketing/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Leave headroom under maxDuration so the handler always returns a useful
 * summary instead of being killed mid-batch. Work that does not fit is simply
 * picked up by the next run.
 *
 * This must also stay under the Cloud Scheduler job's `attemptDeadline`, which
 * is 180s. At the previous 240s a busy drain outlived the deadline: Scheduler
 * recorded the attempt as failed and retried while the original run was still
 * going. Overlapping runs are safe — rows are claimed transactionally before
 * any SMTP call — but they manufacture false failures in the job's history and
 * duplicate the work. Raising this needs the job's deadline raised first.
 */
const TIME_BUDGET_MS = 150_000;

export async function GET(request: Request) {
  const denied = requireCronAuth(request, 'marketing-send');
  if (denied) return denied;

  const startedAt = Date.now();

  try {
    const settings = await getSettings();

    // The master switch. Checked here rather than deeper down so one flag
    // reliably stops everything, including scheduled campaigns coming due.
    if (settings.sendingPaused) {
      logger.log('[cron/marketing-send] sending is paused; nothing dispatched');
      return NextResponse.json({ paused: true, campaigns: [] });
    }

    // Before looking for work: quarantine anything so overdue that sending it
    // now would surprise its audience. After an outage of this cron the whole
    // backlog is still marked `scheduled` and would otherwise go out together.
    const stale = await pauseStaleScheduled(settings.staleScheduleHours);

    const db = getAdminDb();
    const campaignIds = await findDueCampaigns();

    if (!campaignIds.length) {
      return NextResponse.json({ campaigns: [], pausedAsStale: stale, message: 'Nothing due.' });
    }

    const results = [];

    for (const campaignId of campaignIds) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        logger.log('[cron/marketing-send] time budget reached; deferring the rest');
        break;
      }

      const snap = await db.collection(CAMPAIGNS).doc(campaignId).get();
      const campaign = snap.data() as Campaign | undefined;
      if (!campaign) continue;

      // A scheduled campaign has no send rows yet.
      if (campaign.status === 'scheduled') {
        const segment = campaignAudience(campaign);
        try {
          const enqueued = await enqueueCampaign(campaignId, segment);
          logger.log(`[cron/marketing-send] enqueued scheduled campaign ${campaignId}: ${enqueued.queued}`);
        } catch (err) {
          logger.error(`[cron/marketing-send] enqueue failed for ${campaignId}:`, err);
          await db.collection(CAMPAIGNS).doc(campaignId).update({
            status: 'failed',
            updatedAt: FieldValue.serverTimestamp(),
          });
          results.push({ campaignId, error: err instanceof Error ? err.message : 'enqueue failed' });
          continue;
        }
      }

      // Reclaim anything a previously killed drain left claimed but unsent.
      await recoverStalledSends(campaignId);

      const result = await drainCampaign(campaignId, settings.batchSize);
      results.push(result);
    }

    return NextResponse.json({
      campaigns: results,
      pausedAsStale: stale,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    logger.error('[cron/marketing-send] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Send run failed' },
      { status: 500 },
    );
  }
}
