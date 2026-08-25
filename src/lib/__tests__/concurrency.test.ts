import { describe, it, expect } from 'vitest';
import { mapWithLimit } from '@/lib/concurrency';

const tick = () => new Promise((r) => setTimeout(r, 1));

describe('mapWithLimit', () => {
  it('preserves input order regardless of completion order', async () => {
    const out = await mapWithLimit([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(out).toEqual([30, 10, 20]);
  });

  it('never exceeds the limit — the property the AI rate limit depends on', async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithLimit(Array.from({ length: 25 }, (_, i) => i), 4, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await tick();
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBe(4);
  });

  it('processes every item exactly once', async () => {
    const seen: number[] = [];
    await mapWithLimit(Array.from({ length: 50 }, (_, i) => i), 7, async (n) => {
      await tick();
      seen.push(n);
    });
    expect(seen).toHaveLength(50);
    expect(new Set(seen).size).toBe(50);
  });

  it('handles an empty list without spawning workers', async () => {
    expect(await mapWithLimit([], 4, async () => 1)).toEqual([]);
  });

  it('does not hang on a zero or negative limit', async () => {
    // A naive pool spawns `limit` workers and awaits them; at zero that is an
    // empty Promise.all resolving instantly with nothing done, or a deadlock.
    expect(await mapWithLimit([1, 2, 3], 0, async (n) => n * 2)).toEqual([2, 4, 6]);
    expect(await mapWithLimit([1, 2, 3], -5, async (n) => n * 2)).toEqual([2, 4, 6]);
  });

  it('caps workers at the item count', async () => {
    let peak = 0;
    let inFlight = 0;
    await mapWithLimit([1, 2], 100, async () => {
      inFlight++; peak = Math.max(peak, inFlight); await tick(); inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('propagates a rejection, as Promise.all does', async () => {
    await expect(
      mapWithLimit([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
