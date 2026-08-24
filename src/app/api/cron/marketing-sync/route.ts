// src/app/api/cron/marketing-sync/route.ts
//
// Nightly reconciliation of the athlete roster into the subscriber list.
// Follows the same shape as the other crons in this directory: shared-secret
// bearer auth, force-dynamic, and an explicit maxDuration.

import { NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cron-auth';
import { syncAthletesToSubscribers } from '@/lib/marketing/sync';
import { logger } from '@/lib/logger';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = requireCronAuth(request, 'marketing-sync');
  if (denied) return denied;

  try {
    const result = await syncAthletesToSubscribers();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    logger.error('[cron/marketing-sync] failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
