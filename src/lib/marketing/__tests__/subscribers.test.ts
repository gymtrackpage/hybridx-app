import { describe, it, expect } from 'vitest';
import {
  isPlausibleEmail,
  normaliseEmail,
  splitName,
  subscriberId,
  truncateIp,
} from '../subscribers';

describe('normaliseEmail', () => {
  it('lowercases and trims', () => {
    expect(normaliseEmail('  Athlete@HybridX.Club  ')).toBe('athlete@hybridx.club');
  });
});

describe('subscriberId', () => {
  it('is stable for the same address', () => {
    expect(subscriberId('a@b.com')).toBe(subscriberId('a@b.com'));
  });

  it('collapses case and whitespace variants onto one id, so dedupe is structural', () => {
    expect(subscriberId('Athlete@HybridX.club')).toBe(subscriberId('  athlete@hybridx.club '));
  });

  it('distinguishes different addresses', () => {
    expect(subscriberId('a@b.com')).not.toBe(subscriberId('c@d.com'));
  });

  it('produces a Firestore-safe id containing no path separators', () => {
    const id = subscriberId('first.last+tag@sub.domain.co.uk');
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('isPlausibleEmail', () => {
  it('accepts ordinary addresses', () => {
    expect(isPlausibleEmail('athlete@hybridx.club')).toBe(true);
    expect(isPlausibleEmail('first.last+hyrox@sub.domain.co.uk')).toBe(true);
  });

  it('rejects obvious junk', () => {
    for (const bad of ['', '   ', 'nope', 'no@domain', 'a b@c.com', '@hybridx.club', 'a@@b.com']) {
      expect(isPlausibleEmail(bad), bad).toBe(false);
    }
  });

  it('rejects addresses beyond the 254-character limit', () => {
    expect(isPlausibleEmail(`${'a'.repeat(250)}@b.com`)).toBe(false);
  });
});

describe('truncateIp', () => {
  it('reduces IPv4 to a /24', () => {
    expect(truncateIp('203.0.113.42')).toBe('203.0.113.0');
  });

  it('reduces IPv6 to a /48', () => {
    expect(truncateIp('2001:db8:85a3:8d3:1319:8a2e:370:7348')).toBe('2001:db8:85a3::');
  });

  it('takes the client IP from a proxy chain, not the proxy', () => {
    expect(truncateIp('203.0.113.42, 70.41.3.18, 150.172.238.178')).toBe('203.0.113.0');
  });

  it('returns undefined for missing or unusable values', () => {
    expect(truncateIp(null)).toBeUndefined();
    expect(truncateIp(undefined)).toBeUndefined();
    expect(truncateIp('')).toBeUndefined();
    expect(truncateIp('unknown')).toBeUndefined();
  });
});

describe('splitName', () => {
  it('splits first and last', () => {
    expect(splitName('Jane Doe')).toEqual({ firstName: 'Jane', lastName: 'Doe' });
  });

  it('treats everything after the first word as the surname', () => {
    expect(splitName('Jean Claude Van Damme')).toEqual({
      firstName: 'Jean',
      lastName: 'Claude Van Damme',
    });
  });

  it('handles a single name, extra whitespace and empties', () => {
    expect(splitName('Cher')).toEqual({ firstName: 'Cher', lastName: '' });
    expect(splitName('  Jane   Doe  ')).toEqual({ firstName: 'Jane', lastName: 'Doe' });
    expect(splitName('')).toEqual({ firstName: '', lastName: '' });
  });
});
