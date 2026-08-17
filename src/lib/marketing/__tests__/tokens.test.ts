import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import {
  createToken,
  isTokenSecretConfigured,
  UNSUBSCRIBE_TTL_SECONDS,
  verifyToken,
} from '../tokens';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';

beforeAll(() => {
  process.env.MARKETING_TOKEN_SECRET = SECRET;
});

afterEach(() => {
  process.env.MARKETING_TOKEN_SECRET = SECRET;
  vi.useRealTimers();
});

describe('createToken / verifyToken', () => {
  it('round-trips a valid token', () => {
    const token = createToken('unsubscribe', 'sub1', 'camp1');
    const result = verifyToken(token, 'unsubscribe');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.subscriberId).toBe('sub1');
      expect(result.payload.campaignId).toBe('camp1');
      expect(result.payload.purpose).toBe('unsubscribe');
    }
  });

  it('rejects a token whose payload was tampered with', () => {
    const token = createToken('unsubscribe', 'sub1', 'camp1');
    // Swap in a different subscriber — the attack the unsigned links allowed.
    const forged = token.replace('sub1', 'sub2');
    expect(verifyToken(forged, 'unsubscribe')).toEqual({ valid: false, reason: 'bad-signature' });
  });

  it('rejects a token with a single character changed in the signature', () => {
    const token = createToken('unsubscribe', 'sub1', 'camp1');
    const last = token.slice(-1) === 'A' ? 'B' : 'A';
    expect(verifyToken(`${token.slice(0, -1)}${last}`).valid).toBe(false);
  });

  it('rejects a signature of a different length without throwing', () => {
    const token = createToken('unsubscribe', 'sub1', 'camp1');
    expect(verifyToken(`${token}extra`)).toEqual({ valid: false, reason: 'bad-signature' });
  });

  it('rejects malformed tokens', () => {
    for (const bad of ['', 'nope', 'a.b.c', 'a.b.c.d.e.f.g']) {
      expect(verifyToken(bad), bad).toEqual({ valid: false, reason: 'malformed' });
    }
  });

  it('rejects a non-numeric expiry', () => {
    expect(verifyToken('unsubscribe.sub1.camp1.notanumber.sig')).toEqual({
      valid: false,
      reason: 'malformed',
    });
  });

  it('will not let an unsubscribe token be replayed as a tracking token', () => {
    const token = createToken('unsubscribe', 'sub1', 'camp1');
    expect(verifyToken(token, 'track')).toEqual({ valid: false, reason: 'wrong-purpose' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = createToken('unsubscribe', 'sub1', 'camp1');
    process.env.MARKETING_TOKEN_SECRET = 'a-completely-different-secret-32-chars!';
    expect(verifyToken(token)).toEqual({ valid: false, reason: 'bad-signature' });
  });

  describe('expiry', () => {
    it('rejects an expired token', () => {
      const token = createToken('track', 'sub1', 'camp1', 60);
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 61_000);
      expect(verifyToken(token)).toEqual({ valid: false, reason: 'expired' });
    });

    it('accepts a token inside its window', () => {
      const token = createToken('track', 'sub1', 'camp1', 3600);
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 60_000);
      expect(verifyToken(token).valid).toBe(true);
    });

    it('keeps unsubscribe links alive for a year, since people act on old email', () => {
      const token = createToken('unsubscribe', 'sub1', 'camp1');
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + (UNSUBSCRIBE_TTL_SECONDS - 3600) * 1000);
      expect(verifyToken(token, 'unsubscribe').valid).toBe(true);
    });

    it('treats a zero expiry as never expiring', () => {
      const token = createToken('unsubscribe', 'sub1', 'camp1', 0);
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 10 * 365 * 24 * 3600 * 1000);
      expect(verifyToken(token).valid).toBe(true);
    });
  });

  it('produces URL-safe tokens', () => {
    // Many ids over many tokens — base64 padding and +/ appear probabilistically.
    for (let i = 0; i < 200; i++) {
      expect(createToken('unsubscribe', `sub${i}`, `camp${i}`)).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });
});

describe('secret configuration', () => {
  it('refuses to sign without a secret rather than falling back to a default', () => {
    delete process.env.MARKETING_TOKEN_SECRET;
    expect(() => createToken('unsubscribe', 'sub1', 'camp1')).toThrow(/MARKETING_TOKEN_SECRET/);
  });

  it('refuses a secret that is too short to be worth having', () => {
    process.env.MARKETING_TOKEN_SECRET = 'short';
    expect(() => createToken('unsubscribe', 'sub1', 'camp1')).toThrow(/32 characters/);
    expect(isTokenSecretConfigured()).toBe(false);
  });

  it('reports configuration status without throwing', () => {
    expect(isTokenSecretConfigured()).toBe(true);
    delete process.env.MARKETING_TOKEN_SECRET;
    expect(isTokenSecretConfigured()).toBe(false);
  });
});
