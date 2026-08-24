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
  drainCampaign,
  enqueueCampaign,
  findDueCampaigns,
  getSettings,
  recoverStalledSends,
} from '@/lib/marketing/queue';
import type { Campaign } from '@/lib/marketing/types';
import type { SegmentDefinition } from '@/lib/marketing/segments';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/**
 * Leave headroom under maxDuration so the handler always returns a useful
 * summary instead of being killed mid-batch. Work that does not fit is simply
 * picked up by the next run.
 */
const TIME_BUDGET_MS = 240_000;

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

    const db = getAdminDb();
    const campaignIds = await findDueCampaigns();

    if (!campaignIds.length) {
      return NextResponse.json({ campaigns: [], message: 'Nothing due.' });
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
        // The stored segment is what the admin actually chose and saw a count
        // for, including athlete predicates. `targetTags` is the older,
        // tags-only shape kept for campaigns migrated from HXMailer; reading it
        // in preference would silently widen the audience of any scheduled
        // campaign whose segment used predicates.
        const segment: SegmentDefinition =
          (campaign.segment as SegmentDefinition | undefined) ??
          (campaign.targetTags?.length ? { anyTags: campaign.targetTags } : {});
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
