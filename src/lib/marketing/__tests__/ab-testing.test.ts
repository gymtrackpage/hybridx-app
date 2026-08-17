import { describe, it, expect } from 'vitest';
import {
  assignVariant,
  HELD_VARIANT,
  isReadyToDecide,
  MIN_SAMPLE_PER_VARIANT,
  pickWinner,
  subjectForSend,
  type AbTestConfig,
  type VariantResult,
} from '../ab-testing';

const twoVariants = [
  { index: 0, subject: 'Original subject' },
  { index: 1, subject: 'Alternative subject' },
];

describe('assignVariant', () => {
  const config = { variants: twoVariants, testShare: 0.1 };

  it('is deterministic — a retry cannot change which variant someone gets', () => {
    // The property the whole design rests on: assignment survives re-enqueue,
    // retry and a crash mid-send.
    for (let i = 0; i < 50; i++) {
      const first = assignVariant('camp1', `sub${i}`, config);
      expect(assignVariant('camp1', `sub${i}`, config)).toBe(first);
    }
  });

  it('buckets on campaign and subscriber together, not the subscriber alone', () => {
    // Otherwise the same people would be the test group every single time.
    const assignments = new Set<number>();
    for (let c = 0; c < 40; c++) {
      assignments.add(assignVariant(`camp${c}`, 'sub1', config));
    }
    expect(assignments.size).toBeGreaterThan(1);
  });

  it('holds back roughly the expected majority', () => {
    const total = 4000;
    let held = 0;
    for (let i = 0; i < total; i++) {
      if (assignVariant('camp1', `sub${i}`, config) === HELD_VARIANT) held++;
    }
    // 10% per variant across two variants tests 20%, holding back ~80%.
    expect(held / total).toBeGreaterThan(0.74);
    expect(held / total).toBeLessThan(0.86);
  });

  it('splits the test portion evenly between variants', () => {
    const counts = [0, 0];
    for (let i = 0; i < 6000; i++) {
      const v = assignVariant('camp1', `sub${i}`, config);
      if (v !== HELD_VARIANT) counts[v]++;
    }
    const ratio = counts[0] / (counts[0] + counts[1]);
    expect(ratio).toBeGreaterThan(0.42);
    expect(ratio).toBeLessThan(0.58);
  });

  it('sends everyone the single variant when there is nothing to test', () => {
    for (let i = 0; i < 20; i++) {
      expect(assignVariant('camp1', `sub${i}`, { variants: [twoVariants[0]], testShare: 0.1 })).toBe(0);
    }
  });

  it('holds nobody back when the test share covers the whole audience', () => {
    const all = { variants: twoVariants, testShare: 0.5 };
    for (let i = 0; i < 200; i++) {
      expect(assignVariant('camp1', `sub${i}`, all)).not.toBe(HELD_VARIANT);
    }
  });

  it('handles three variants', () => {
    const three = {
      variants: [...twoVariants, { index: 2, subject: 'Third subject' }],
      testShare: 0.1,
    };
    const seen = new Set<number>();
    for (let i = 0; i < 3000; i++) seen.add(assignVariant('camp1', `sub${i}`, three));
    expect(seen).toContain(0);
    expect(seen).toContain(1);
    expect(seen).toContain(2);
    expect(seen).toContain(HELD_VARIANT);
  });
});

describe('pickWinner', () => {
  const result = (index: number, sent: number, opened: number): VariantResult => ({
    index,
    subject: `Subject ${index}`,
    sent,
    opened,
    openRate: sent ? opened / sent : 0,
  });

  it('picks the higher open rate when the gap is real', () => {
    const outcome = pickWinner([result(0, 100, 20), result(1, 100, 35)]);
    expect(outcome.winnerIndex).toBe(1);
    expect(outcome.confident).toBe(true);
  });

  it('refuses to judge on too small a sample', () => {
    // At 10 sends one extra open moves the rate ten points — noise, not signal.
    const outcome = pickWinner([result(0, 10, 2), result(1, 10, 5)]);
    expect(outcome.confident).toBe(false);
    expect(outcome.reason).toContain(String(MIN_SAMPLE_PER_VARIANT));
  });

  it('falls back to the original subject when it cannot judge', () => {
    // The marketer wrote variant 0 first; it is the conservative default.
    expect(pickWinner([result(0, 5, 1), result(1, 5, 3)]).winnerIndex).toBe(0);
  });

  it('reports no confidence when the variants are close', () => {
    const outcome = pickWinner([result(0, 200, 60), result(1, 200, 62)]);
    expect(outcome.confident).toBe(false);
    expect(outcome.reason).toContain('No clear winner');
  });

  it('still names a winner without confidence, so the send can proceed', () => {
    const outcome = pickWinner([result(0, 200, 60), result(1, 200, 62)]);
    expect(outcome.winnerIndex).toBe(1);
  });

  it('handles no results without throwing', () => {
    const outcome = pickWinner([]);
    expect(outcome.winnerIndex).toBe(0);
    expect(outcome.confident).toBe(false);
  });
});

describe('isReadyToDecide', () => {
  it('waits for the configured window', () => {
    expect(isReadyToDecide(Date.now() - 1 * 3_600_000, 4)).toBe(false);
    expect(isReadyToDecide(Date.now() - 5 * 3_600_000, 4)).toBe(true);
  });

  it('is ready immediately with a zero window', () => {
    expect(isReadyToDecide(Date.now(), 0)).toBe(true);
  });
});

describe('subjectForSend', () => {
  const config: AbTestConfig = {
    variants: twoVariants,
    testShare: 0.1,
    decideAfterHours: 4,
  };

  it('gives a test recipient their assigned variant', () => {
    expect(subjectForSend(config, 1, 'fallback')).toBe('Alternative subject');
  });

  it('gives a held recipient the winner once one exists', () => {
    expect(subjectForSend({ ...config, winnerIndex: 1 }, HELD_VARIANT, 'fallback')).toBe(
      'Alternative subject',
    );
  });

  it('falls back safely if a held recipient somehow drains before a winner', () => {
    expect(subjectForSend(config, HELD_VARIANT, 'Original')).toBe('Original');
  });

  it('falls back when the variant index does not exist', () => {
    expect(subjectForSend(config, 99, 'Original')).toBe('Original');
  });
});
