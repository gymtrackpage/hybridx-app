import { describe, it, expect } from 'vitest';
import { isStalled, sendDocId } from '../queue';
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
