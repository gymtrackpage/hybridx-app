// src/lib/marketing/ab-testing.ts
//
// Subject-line A/B testing.
//
// The shape: a small slice of the audience receives each variant, the winner is
// picked on open rate once enough have been sent, and the remainder — usually
// the large majority — gets the winning subject. That is worth more than an
// even split, because the point is not to measure precisely but to send the
// better subject to most people.
//
// Assignment is deterministic on the subscriber id rather than random, so it
// survives a re-enqueue, a retry and a crash mid-send. A recipient can never
// receive one variant on the first attempt and another on the retry.

import { createHash } from 'crypto';

/** Held recipients wait for a winner. */
export const HELD_VARIANT = -1;

export interface SubjectVariant {
  /** Index into the campaign's `subjectVariants` array. */
  index: number;
  subject: string;
  previewText?: string;
}

export interface AbTestConfig {
  variants: SubjectVariant[];
  /** Share of the audience used to test, per variant, as a fraction. */
  testShare: number;
  /** Hours to wait before picking a winner. */
  decideAfterHours: number;
  /** Set once a winner is chosen. */
  winnerIndex?: number;
  decidedAt?: unknown;
}

export const DEFAULT_TEST_SHARE = 0.1;
export const DEFAULT_DECIDE_AFTER_HOURS = 4;

/**
 * Which variant a subscriber gets, or HELD_VARIANT if they are in the
 * remainder waiting for a winner.
 *
 * Uses a hash of `${campaignId}:${subscriberId}` so the same person can land in
 * the test group for one campaign and the holdout for another — bucketing on
 * the subscriber alone would repeatedly test on the same people.
 */
export function assignVariant(
  campaignId: string,
  subscriberId: string,
  config: Pick<AbTestConfig, 'variants' | 'testShare'>,
): number {
  const variantCount = config.variants.length;
  if (variantCount < 2) return 0;

  // First 8 hex digits give a uniform value in [0, 1).
  const hash = createHash('sha256').update(`${campaignId}:${subscriberId}`).digest('hex');
  const position = parseInt(hash.slice(0, 8), 16) / 0xffffffff;

  const testPortion = Math.min(config.testShare * variantCount, 1);
  if (position >= testPortion) return HELD_VARIANT;

  // Spread the test portion evenly across the variants.
  return Math.min(Math.floor((position / testPortion) * variantCount), variantCount - 1);
}

export interface VariantResult {
  index: number;
  subject: string;
  sent: number;
  opened: number;
  openRate: number;
}

/**
 * Pick the winner.
 *
 * Requires a minimum sample per variant before declaring anything. With twenty
 * sends a single extra open moves the rate by five points, which is noise
 * rather than signal; below the threshold the first variant wins by default,
 * which is the sane conservative choice — the marketer wrote it first.
 */
export const MIN_SAMPLE_PER_VARIANT = 20;

export function pickWinner(results: VariantResult[]): {
  winnerIndex: number;
  confident: boolean;
  reason: string;
} {
  if (!results.length) {
    return { winnerIndex: 0, confident: false, reason: 'No results to compare.' };
  }

  const underSampled = results.filter((r) => r.sent < MIN_SAMPLE_PER_VARIANT);
  if (underSampled.length) {
    return {
      winnerIndex: 0,
      confident: false,
      reason: `Too few sends to judge (need ${MIN_SAMPLE_PER_VARIANT} per variant); using the original subject.`,
    };
  }

  const sorted = [...results].sort((a, b) => b.openRate - a.openRate);
  const [best, runnerUp] = sorted;

  // A gap under two points on a sample this size is not a result.
  const margin = best.openRate - (runnerUp?.openRate ?? 0);
  const confident = margin >= 0.02;

  return {
    winnerIndex: best.index,
    confident,
    reason: confident
      ? `"${best.subject}" won with ${(best.openRate * 100).toFixed(1)}% opens, ${(margin * 100).toFixed(1)} points clear.`
      : `No clear winner (${(margin * 100).toFixed(1)} points apart); using "${best.subject}".`,
  };
}

/** Whether the test has run long enough to decide. */
export function isReadyToDecide(startedAtMs: number, decideAfterHours: number): boolean {
  return Date.now() - startedAtMs >= decideAfterHours * 3_600_000;
}

/** The subject a given send should carry, once a winner may or may not exist. */
export function subjectForSend(
  config: AbTestConfig,
  assignedVariant: number,
  fallback: string,
): string {
  if (assignedVariant === HELD_VARIANT) {
    // Held recipients only send after a winner exists; if somehow drained
    // early, the original subject is the safe choice.
    const winner = config.winnerIndex;
    return winner !== undefined ? (config.variants[winner]?.subject ?? fallback) : fallback;
  }
  return config.variants[assignedVariant]?.subject ?? fallback;
}
