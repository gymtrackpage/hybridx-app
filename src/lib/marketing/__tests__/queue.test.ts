import { describe, it, expect } from 'vitest';
import { isStaleSchedule, isStalled, sendDocId } from '../queue';
import type { Send } from '../types';

describe('sendDocId', () => {
  it('is deterministic — the property queue idempotency rests on', () => {
    expect(sendDocId('camp1', 'sub1')).toBe('camp1_sub1');
    expect(sendDocId('camp1', 'sub1')).toBe(sendDocId('camp1', 'sub1'));
  });
});

describe('isStalled — the double-send guard', () => {
  const cutoff = Date.now() - 10 * 60_000;
  const asStamp = (d: Date) => ({ toMillis: () => d.getTime() }) as unknown as Send['claimedAt'];

  it('does NOT steal a row claimed seconds ago by a live drain', () => {
    // The overlap scenario: the cron fires every minute with a five-minute
    // budget, so invocation B routinely runs recovery while invocation A is
    // mid-batch. A row A claimed moments ago must not look stalled to B —
    // recovering it would have both invocations send it.
    const justClaimed = { claimedAt: asStamp(new Date(Date.now() - 5_000)) };
    expect(isStalled(justClaimed, cutoff)).toBe(false);
  });

  it('recovers a row whose claim is older than the threshold', () => {
    const abandoned = { claimedAt: asStamp(new Date(Date.now() - 15 * 60_000)) };
    expect(isStalled(abandoned, cutoff)).toBe(true);
  });

  it('treats a claim exactly at the cutoff as stalled', () => {
    expect(isStalled({ claimedAt: asStamp(new Date(cutoff)) }, cutoff)).toBe(true);
  });

  it('recovers a sending row with no claim stamp at all', () => {
    // Predates the field, or the writer crashed between status and stamp —
    // the alternative is a row stuck in `sending` forever.
    expect(isStalled({ claimedAt: undefined }, cutoff)).toBe(true);
    expect(isStalled({ claimedAt: null }, cutoff)).toBe(true);
  });

  it('accepts a plain Date as well as a Firestore Timestamp', () => {
    expect(isStalled({ claimedAt: new Date(Date.now() - 5_000) as never }, cutoff)).toBe(false);
    expect(isStalled({ claimedAt: new Date(Date.now() - 15 * 60_000) as never }, cutoff)).toBe(true);
  });

  it('judges by claim time, never by enqueue time', () => {
    // The original bug: staleness was measured from queuedAt, so on any
    // campaign older than the threshold every freshly-claimed row looked
    // stalled. isStalled's signature only accepts claimedAt — this test
    // documents that queuedAt has no influence at all.
    const oldCampaignFreshClaim = {
      queuedAt: asStamp(new Date(Date.now() - 60 * 60_000)), // enqueued an hour ago
      claimedAt: asStamp(new Date(Date.now() - 2_000)),      // claimed just now
    };
    expect(isStalled(oldCampaignFreshClaim, cutoff)).toBe(false);
  });
});

describe('isStaleSchedule — the recovery-burst guard', () => {
  const HOURS = 24;
  const now = Date.now();
  const stamp = (ms: number) => ({ toMillis: () => ms });
  const hoursAgo = (h: number) => now - h * 3_600_000;

  it('lets a campaign that has just come due send normally', () => {
    expect(isStaleSchedule(stamp(hoursAgo(0.1)), now, HOURS)).toBe(false);
  });

  it('still sends one delayed by less than the window', () => {
    // A short outage should not cost the campaign — the whole point of a
    // resumable cron is that it catches up.
    expect(isStaleSchedule(stamp(hoursAgo(6)), now, HOURS)).toBe(false);
  });

  it('quarantines one delayed by more than the window', () => {
    // The scenario this exists for: the send cron was down for days, and the
    // backlog would otherwise go out in a single burst.
    expect(isStaleSchedule(stamp(hoursAgo(72)), now, HOURS)).toBe(true);
  });

  it('treats exactly the window as still sendable', () => {
    expect(isStaleSchedule(stamp(hoursAgo(HOURS)), now, HOURS)).toBe(false);
  });

  it('never quarantines a campaign with no scheduledAt', () => {
    // Cannot be judged late. Pulling it for a missing field would turn a data
    // problem into a delivery one.
    expect(isStaleSchedule(undefined, now, HOURS)).toBe(false);
    expect(isStaleSchedule(null, now, HOURS)).toBe(false);
  });

  it('accepts a plain Date as well as a Firestore Timestamp', () => {
    expect(isStaleSchedule(new Date(hoursAgo(72)), now, HOURS)).toBe(true);
    expect(isStaleSchedule(new Date(hoursAgo(1)), now, HOURS)).toBe(false);
  });

  it('treats a zero or negative window as no staleness rule at all', () => {
    // Otherwise a misconfigured setting would silently pause every campaign
    // the instant it came due — a far worse failure than the one guarded here.
    expect(isStaleSchedule(stamp(hoursAgo(72)), now, 0)).toBe(false);
    expect(isStaleSchedule(stamp(hoursAgo(72)), now, -1)).toBe(false);
  });

  it('never quarantines a campaign scheduled for the future', () => {
    expect(isStaleSchedule(stamp(now + 3_600_000), now, HOURS)).toBe(false);
  });
});
