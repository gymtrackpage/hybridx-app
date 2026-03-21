// src/lib/rate-limit.ts
// Sliding-window in-memory rate limiter.
//
// NOTE: State is per-process. This works well for Firebase App Hosting
// single-instance deployments. For multi-instance production scaling,
// migrate to a Redis-backed limiter so limits are enforced across all instances.

interface Window {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, Window>();

// Prune expired entries every 60 s to prevent unbounded memory growth
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, w] of store) {
    if (now >= w.resetAt) store.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

/**
 * Check whether `identifier` is within the allowed rate.
 *
 * @param identifier  Unique key (e.g. `"session:1.2.3.4"` or `"strava:userId"`)
 * @param windowMs    Rolling window size in milliseconds
 * @param max         Maximum requests allowed within the window
 */
export function checkRateLimit(
  identifier: string,
  windowMs: number,
  max: number,
): RateLimitResult {
  maybePrune();
  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now >= entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (entry.count >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, remaining: max - entry.count, retryAfterMs: 0 };
}
