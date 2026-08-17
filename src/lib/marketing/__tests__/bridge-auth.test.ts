import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isBridgeAuthorised, isBridgeConfigured } from '../bridge-auth';

const SECRET = 'bridge-secret-at-least-32-characters-long';

function req(headers: Record<string, string> = {}): Request {
  return new Request('https://app.hybridx.club/api/marketing/leads', {
    method: 'POST',
    headers,
  });
}

beforeEach(() => {
  process.env.LEAD_BRIDGE_SECRET = SECRET;
});

afterEach(() => {
  process.env.LEAD_BRIDGE_SECRET = SECRET;
});

describe('isBridgeAuthorised', () => {
  it('accepts the secret as a bearer token', () => {
    expect(isBridgeAuthorised(req({ authorization: `Bearer ${SECRET}` }))).toBe(true);
  });

  it('accepts the secret in the x-bridge-secret header', () => {
    expect(isBridgeAuthorised(req({ 'x-bridge-secret': SECRET }))).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(isBridgeAuthorised(req({ authorization: 'Bearer not-the-secret-but-long-enough-x' }))).toBe(false);
  });

  it('rejects a request with no credential at all', () => {
    expect(isBridgeAuthorised(req())).toBe(false);
  });

  it('rejects an empty bearer token', () => {
    expect(isBridgeAuthorised(req({ authorization: 'Bearer ' }))).toBe(false);
  });

  it('rejects a secret of the wrong length without throwing', () => {
    // timingSafeEqual throws on mismatched buffer lengths, so the length check
    // has to come first — otherwise a short guess crashes the route instead of
    // being rejected.
    expect(() => isBridgeAuthorised(req({ authorization: 'Bearer short' }))).not.toThrow();
    expect(isBridgeAuthorised(req({ authorization: 'Bearer short' }))).toBe(false);
    expect(isBridgeAuthorised(req({ authorization: `Bearer ${SECRET}extra` }))).toBe(false);
  });

  it('rejects a prefix of the real secret', () => {
    expect(isBridgeAuthorised(req({ authorization: `Bearer ${SECRET.slice(0, -1)}` }))).toBe(false);
  });

  describe('failing closed', () => {
    it('rejects everything when the secret is unset', () => {
      // An unset secret must not mean "allow all" — this endpoint writes to the
      // subscriber list.
      delete process.env.LEAD_BRIDGE_SECRET;
      expect(isBridgeAuthorised(req({ authorization: 'Bearer anything' }))).toBe(false);
      expect(isBridgeAuthorised(req())).toBe(false);
    });

    it('rejects everything when the secret is too short to be worth having', () => {
      process.env.LEAD_BRIDGE_SECRET = 'short';
      expect(isBridgeAuthorised(req({ authorization: 'Bearer short' }))).toBe(false);
    });
  });

  it('is case-insensitive about the Bearer prefix', () => {
    expect(isBridgeAuthorised(req({ authorization: `bearer ${SECRET}` }))).toBe(true);
  });
});

describe('isBridgeConfigured', () => {
  it('reports configuration without throwing', () => {
    expect(isBridgeConfigured()).toBe(true);

    delete process.env.LEAD_BRIDGE_SECRET;
    expect(isBridgeConfigured()).toBe(false);

    process.env.LEAD_BRIDGE_SECRET = 'short';
    expect(isBridgeConfigured()).toBe(false);
  });
});
