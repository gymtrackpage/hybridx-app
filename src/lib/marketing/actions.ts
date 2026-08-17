'use server';

// src/lib/marketing/actions.ts
//
// Server actions for the marketing console.
//
// Every action begins with assertAdmin(). HXMailer's equivalents took the
// caller's identity as an argument — `sendCampaign(campaignId, userId)` — which
// means the client decided whose data was touched. Identity here comes from the
// session cookie and nothing else.

import { revalidatePath } from 'next/cache';
import { FieldValue } from 'firebase-admin/firestore';
import { assertAdmin } from '@/lib/admin-auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import { renderForSubscriber } from './personalise';
import { renderBlocks, renderBlocksAsText } from './render';
import type { EmailBlock } from './blocks';
import { CAMPAIGNS, enqueueCampaign, getSettings, SETTINGS_DOC } from './queue';
import { resolveSegment, type SegmentDefinition } from './segments';
import {
  SUBSCRIBERS,
  resubscribe,
  subscriberId as hashEmail,
  suppressSubscriber,
  upsertSubscriber,
} from './subscribers';
import { syncAthletesToSubscribers } from './sync';
import { isTokenSecretConfigured } from './tokens';
import { isBulkTransportConfigured, sendBulkMessage, verifyBulkTransport } from './transport';
import type { Campaign, MarketingSettings, Subscriber } from './types';

export type ActionResult<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

function fail(err: unknown, fallback: string): { success: false; error: string } {
  const message = err instanceof Error ? err.message : fallback;
  logger.error(`[marketing/actions] ${message}`);
  return { success: false, error: message };
}

const MARKETING_PATH = '/admin/marketing';

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function createCampaign(input: {
  subject: string;
  previewText?: string;
  htmlBody?: string;
}): Promise<ActionResult<{ id: string }>> {
  try {
    await assertAdmin('marketing:campaign:create');

    const ref = await getAdminDb().collection(CAMPAIGNS).add({
      subject: input.subject,
      previewText: input.previewText ?? '',
      htmlBody: input.htmlBody ?? '',
      status: 'draft',
      scheduledAt: null,
      sentAt: null,
      recipientCount: 0,
      openCount: 0,
      clickCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(MARKETING_PATH);
    return { success: true, data: { id: ref.id } };
  } catch (err) {
    return fail(err, 'Could not create the campaign.');
  }
}

export async function updateCampaign(
  campaignId: string,
  patch: Partial<Pick<Campaign, 'subject' | 'previewText' | 'htmlBody' | 'targetTags' | 'ctaUrl' | 'ctaLabel' | 'campaignGoal' | 'targetAudience'>>,
): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:update');

    const ref = getAdminDb().collection(CAMPAIGNS).doc(campaignId);
    const snap = await ref.get();
    const status = (snap.data() as Campaign | undefined)?.status;

    // Editing a campaign mid-flight would mean different recipients receiving
    // different content under one set of statistics.
    if (status === 'sending' || status === 'sent') {
      return { success: false, error: `A ${status} campaign cannot be edited.` };
    }

    await ref.update({ ...patch, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not update the campaign.');
  }
}

/**
 * Save a campaign's structured content.
 *
 * Kept apart from updateCampaign because `blocks` is not a plain field: the
 * rendered HTML and plain-text parts are derived from it, and letting a caller
 * write blocks without re-rendering would leave the campaign's content and its
 * rendered body describing different emails.
 */
export async function updateCampaignContent(
  campaignId: string,
  content: { subject: string; previewText: string; blocks: EmailBlock[] },
): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:content');

    const ref = getAdminDb().collection(CAMPAIGNS).doc(campaignId);
    const status = (await ref.get()).data()?.status as Campaign['status'] | undefined;

    if (status === 'sending' || status === 'sent') {
      return { success: false, error: `A ${status} campaign cannot be edited.` };
    }

    await ref.update({
      subject: content.subject,
      previewText: content.previewText,
      blocks: content.blocks,
      htmlBody: renderBlocks(content.blocks, { previewText: content.previewText }),
      plainBody: renderBlocksAsText(content.blocks),
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(`${MARKETING_PATH}/campaigns/${campaignId}`);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not save the campaign content.');
  }
}

/**
 * Save the audience a campaign will be sent to.
 *
 * Stored on the campaign so the send flow, the pre-send checklist and the
 * eventual enqueue all resolve the same definition — the alternative is the
 * count shown in the UI drifting from the audience actually mailed.
 */
export async function setCampaignAudience(
  campaignId: string,
  segment: SegmentDefinition,
): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:audience');

    const ref = getAdminDb().collection(CAMPAIGNS).doc(campaignId);
    const status = (await ref.get()).data()?.status as Campaign['status'] | undefined;

    if (status === 'sending' || status === 'sent') {
      return { success: false, error: `A ${status} campaign's audience cannot be changed.` };
    }

    await ref.update({ segment, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(`${MARKETING_PATH}/campaigns/${campaignId}`);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not save the audience.');
  }
}

/** Pre-flight checks, run before the send button is offered rather than during a send. */
export async function preSendCheck(
  campaignId: string,
  segment: SegmentDefinition,
): Promise<ActionResult<{ audienceSize: number; warnings: string[]; blockers: string[] }>> {
  try {
    await assertAdmin('marketing:campaign:precheck');

    const snap = await getAdminDb().collection(CAMPAIGNS).doc(campaignId).get();
    if (!snap.exists) return { success: false, error: 'Campaign not found.' };
    const campaign = snap.data() as Campaign;

    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!campaign.subject?.trim()) blockers.push('The campaign has no subject line.');
    if (!campaign.htmlBody?.trim()) blockers.push('The campaign has no content.');
    if (!isBulkTransportConfigured()) blockers.push('Brevo SMTP credentials are not configured.');
    if (!isTokenSecretConfigured()) {
      blockers.push('MARKETING_TOKEN_SECRET is missing, so unsubscribe links cannot be signed.');
    }

    if (blockers.length === 0) {
      const transport = await verifyBulkTransport();
      if (!transport.ok) blockers.push(`SMTP connection failed: ${transport.error}`);
    }

    const audience = await resolveSegment(segment);
    if (audience.subscribers.length === 0) blockers.push('No subscribers match this audience.');

    if (audience.excluded.noConsent > 0) {
      warnings.push(`${audience.excluded.noConsent} matching subscribers have not consented to marketing email.`);
    }
    if (!campaign.previewText?.trim()) {
      warnings.push('No preview text — inboxes will show the first line of the email instead.');
    }
    if (!/\[First Name\]/i.test(campaign.htmlBody ?? '')) {
      warnings.push('The email does not use [First Name] anywhere.');
    }

    const settings = await getSettings();
    if (settings.sendingPaused) blockers.push('Sending is paused in marketing settings.');

    return { success: true, data: { audienceSize: audience.subscribers.length, warnings, blockers } };
  } catch (err) {
    return fail(err, 'Could not run the pre-send checks.');
  }
}

/** Queue a campaign for immediate delivery. The cron drain does the sending. */
export async function sendCampaignNow(
  campaignId: string,
  segment: SegmentDefinition,
): Promise<ActionResult<{ queued: number }>> {
  try {
    await assertAdmin('marketing:campaign:send', );

    const check = await preSendCheck(campaignId, segment);
    if (!check.success) return check;
    if (check.data.blockers.length) {
      return { success: false, error: check.data.blockers.join(' ') };
    }

    const result = await enqueueCampaign(campaignId, segment);
    revalidatePath(MARKETING_PATH);
    return { success: true, data: { queued: result.queued } };
  } catch (err) {
    return fail(err, 'Could not queue the campaign.');
  }
}

export async function scheduleCampaign(
  campaignId: string,
  scheduledAt: Date,
): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:schedule');

    if (scheduledAt.getTime() <= Date.now()) {
      return { success: false, error: 'Choose a time in the future.' };
    }

    await getAdminDb().collection(CAMPAIGNS).doc(campaignId).update({
      status: 'scheduled',
      scheduledAt,
      updatedAt: FieldValue.serverTimestamp(),
    });

    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not schedule the campaign.');
  }
}

/** Return a scheduled campaign to draft. Only possible before sending begins. */
export async function cancelSchedule(campaignId: string): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:cancel');

    const ref = getAdminDb().collection(CAMPAIGNS).doc(campaignId);
    const status = (await ref.get()).data()?.status;
    if (status !== 'scheduled') {
      return { success: false, error: 'Only a scheduled campaign can be cancelled.' };
    }

    await ref.update({ status: 'draft', scheduledAt: null, updatedAt: FieldValue.serverTimestamp() });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not cancel the schedule.');
  }
}

/**
 * Halt a send that is already running. Queued rows stay pending, so resuming
 * continues exactly where it stopped rather than restarting.
 */
export async function pauseCampaign(campaignId: string): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:pause');
    await getAdminDb().collection(CAMPAIGNS).doc(campaignId).update({
      status: 'paused',
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not pause the campaign.');
  }
}

export async function resumeCampaign(campaignId: string): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:resume');
    await getAdminDb().collection(CAMPAIGNS).doc(campaignId).update({
      status: 'sending',
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not resume the campaign.');
  }
}

export async function setCampaignArchived(campaignId: string, archived: boolean): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:archive');
    await getAdminDb().collection(CAMPAIGNS).doc(campaignId).update({
      archived,
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not archive the campaign.');
  }
}

export async function setCampaignFolder(campaignId: string, folder: string | null): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:campaign:folder');
    await getAdminDb().collection(CAMPAIGNS).doc(campaignId).update({
      folder: folder ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not update the folder.');
  }
}

/** Send a preview. Tracking is disabled so a preview never distorts the campaign's figures. */
export async function sendTestEmail(campaignId: string, testEmail: string): Promise<ActionResult> {
  try {
    const admin = await assertAdmin('marketing:campaign:test');

    const snap = await getAdminDb().collection(CAMPAIGNS).doc(campaignId).get();
    if (!snap.exists) return { success: false, error: 'Campaign not found.' };
    const campaign = { id: snap.id, ...snap.data() } as Campaign;

    const settings = await getSettings();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';

    const preview: Subscriber = {
      id: 'test-preview',
      email: testEmail,
      firstName: admin.email?.split('@')[0] ?? 'Athlete',
      lastName: '',
      tags: [],
      status: 'active',
      source: 'admin',
      consent: { marketing: true, at: null, method: 'test' },
      createdAt: null,
    };

    const rendered = renderForSubscriber({
      campaignId,
      subject: `[TEST] ${campaign.subject}`,
      htmlBody: campaign.htmlBody,
      subscriber: preview,
      appUrl,
      tracking: false,
    });

    const outcome = await sendBulkMessage({
      to: testEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      unsubscribeUrl: rendered.unsubscribeUrl,
      campaignId,
      senderName: settings.senderName,
      replyTo: settings.replyTo || undefined,
    });

    return outcome.ok
      ? { success: true }
      : { success: false, error: outcome.error ?? 'The test send failed.' };
  } catch (err) {
    return fail(err, 'Could not send the test email.');
  }
}

/** Audience size for the campaign editor, without queueing anything. */
export async function previewAudience(
  segment: SegmentDefinition,
): Promise<ActionResult<{ size: number; sample: string[]; excluded: Record<string, number> }>> {
  try {
    await assertAdmin('marketing:audience:preview');
    const audience = await resolveSegment(segment);
    return {
      success: true,
      data: {
        size: audience.subscribers.length,
        sample: audience.subscribers.slice(0, 5).map((s) => s.email),
        excluded: audience.excluded,
      },
    };
  } catch (err) {
    return fail(err, 'Could not resolve the audience.');
  }
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

export async function addSubscriber(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  tags?: string[];
  consent: boolean;
}): Promise<ActionResult<{ id: string; created: boolean }>> {
  try {
    await assertAdmin('marketing:subscriber:add');

    const result = await upsertSubscriber({
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      tags: input.tags,
      source: 'admin',
      consent: { marketing: input.consent, method: 'admin-added' },
    });

    revalidatePath(`${MARKETING_PATH}/subscribers`);
    return { success: true, data: { id: result.id, created: result.created } };
  } catch (err) {
    return fail(err, 'Could not add the subscriber.');
  }
}

export async function setSubscriberTags(id: string, tags: string[]): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:subscriber:tags');
    await getAdminDb().collection(SUBSCRIBERS).doc(id).update({
      tags: Array.from(new Set(tags)),
      updatedAt: FieldValue.serverTimestamp(),
    });
    revalidatePath(`${MARKETING_PATH}/subscribers`);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not update tags.');
  }
}

export async function unsubscribeSubscriber(id: string): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:subscriber:unsubscribe');
    await suppressSubscriber(id, 'unsubscribed', 'admin-action');
    revalidatePath(`${MARKETING_PATH}/subscribers`);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not unsubscribe them.');
  }
}

/**
 * Opt someone back in. Refuses when the record carries a prior spam complaint —
 * mailing a complainant again risks the sending domain for everyone else, and
 * that should not be one click away in an admin table.
 */
export async function resubscribeSubscriber(id: string): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:subscriber:resubscribe');

    const ok = await resubscribe(id, 'admin-action');
    if (!ok) {
      return {
        success: false,
        error: 'Cannot resubscribe: no such subscriber, or they previously reported a message as spam.',
      };
    }

    revalidatePath(`${MARKETING_PATH}/subscribers`);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not resubscribe them.');
  }
}

export async function importSubscribers(
  rows: Array<{ email: string; firstName?: string; lastName?: string; tags?: string[] }>,
  options: { consent: boolean; extraTag?: string },
): Promise<ActionResult<{ added: number; merged: number; skipped: number }>> {
  try {
    await assertAdmin('marketing:subscriber:import', );

    let added = 0;
    let merged = 0;
    let skipped = 0;

    for (const row of rows) {
      try {
        const result = await upsertSubscriber({
          email: row.email,
          firstName: row.firstName,
          lastName: row.lastName,
          tags: [...(row.tags ?? []), ...(options.extraTag ? [options.extraTag] : [])],
          source: 'import',
          consent: { marketing: options.consent, method: 'csv-import' },
        });
        if (result.created) added++;
        else merged++;
      } catch {
        skipped++; // Invalid address — reported in the summary rather than aborting the import.
      }
    }

    revalidatePath(`${MARKETING_PATH}/subscribers`);
    return { success: true, data: { added, merged, skipped } };
  } catch (err) {
    return fail(err, 'The import failed.');
  }
}

export async function runAthleteSync(): Promise<
  ActionResult<{ created: number; updated: number; skippedSuppressed: number }>
> {
  try {
    await assertAdmin('marketing:sync', );
    const result = await syncAthletesToSubscribers();
    revalidatePath(`${MARKETING_PATH}/subscribers`);
    return {
      success: true,
      data: {
        created: result.created,
        updated: result.updated,
        skippedSuppressed: result.skippedSuppressed,
      },
    };
  } catch (err) {
    return fail(err, 'The sync failed.');
  }
}

/** Look a subscriber up by address — the "did they get it?" support question. */
export async function findSubscriber(email: string): Promise<ActionResult<Subscriber | null>> {
  try {
    await assertAdmin('marketing:subscriber:find');
    const snap = await getAdminDb().collection(SUBSCRIBERS).doc(hashEmail(email)).get();
    return {
      success: true,
      data: snap.exists ? ({ id: snap.id, ...snap.data() } as Subscriber) : null,
    };
  } catch (err) {
    return fail(err, 'Lookup failed.');
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateSettings(patch: Partial<MarketingSettings>): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:settings');
    await getAdminDb().doc(SETTINGS_DOC).set(
      { ...patch, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    revalidatePath(`${MARKETING_PATH}/settings`);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not save settings.');
  }
}

/** The kill switch. Stops every queued and scheduled send at the next drain. */
export async function setSendingPaused(paused: boolean): Promise<ActionResult> {
  try {
    await assertAdmin('marketing:settings:pause');
    await getAdminDb().doc(SETTINGS_DOC).set(
      { sendingPaused: paused, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    logger.log(`[marketing] sending ${paused ? 'PAUSED' : 'resumed'} by admin`);
    revalidatePath(MARKETING_PATH);
    return { success: true };
  } catch (err) {
    return fail(err, 'Could not change the sending state.');
  }
}
