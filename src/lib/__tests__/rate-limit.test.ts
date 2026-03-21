import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit } from '../rate-limit';

// Reset the module's in-memory store before each test by re-importing it fresh.
// vitest's module isolation means we can use vi.useFakeTimers to control Date.now().

describe('checkRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request', () => {
    const result = checkRateLimit('test-key-1', 60_000, 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterMs).toBe(0);
  });

  it('allows requests up to the max within the window', () => {
    for (let i = 0; i < 5; i++) {
      const result = checkRateLimit('test-key-2', 60_000, 5);
      expect(result.allowed).toBe(true);
    }
  });

  it('blocks the request that exceeds the max', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key-3', 60_000, 5);
    }
    const blocked = checkRateLimit('test-key-3', 60_000, 5);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('resets the counter after the window expires', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('test-key-4', 60_000, 5);
    }
    expect(checkRateLimit('test-key-4', 60_000, 5).allowed).toBe(false);

    // Advance time past the window
    vi.advanceTimersByTime(61_000);

    const result = checkRateLimit('test-key-4', 60_000, 5);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('tracks different identifiers independently', () => {
    for (let i = 0; i < 5; i++) {
      checkRateLimit('user-a', 60_000, 5);
    }
    expect(checkRateLimit('user-a', 60_000, 5).allowed).toBe(false);
    expect(checkRateLimit('user-b', 60_000, 5).allowed).toBe(true);
  });

  it('returns correct retryAfterMs when blocked', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    for (let i = 0; i < 3; i++) {
      checkRateLimit('test-key-5', 60_000, 3);
    }
    vi.advanceTimersByTime(10_000); // 10s into the window
    const blocked = checkRateLimit('test-key-5', 60_000, 3);
    expect(blocked.allowed).toBe(false);
    // retryAfterMs should be roughly 50s (60s window - 10s elapsed)
    expect(blocked.retryAfterMs).toBeGreaterThan(49_000);
    expect(blocked.retryAfterMs).toBeLessThanOrEqual(60_000);
  });
});
