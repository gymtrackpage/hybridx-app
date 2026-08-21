import { describe, it, expect } from 'vitest';
import { humanise, isValidRouteSlug } from '../route-store';

describe('isValidRouteSlug — the gate on a permanent collection', () => {
  it('accepts the slugs a funnel page would carry', () => {
    for (const slug of [
      'spring-hyrox-challenge',
      'race_week_offer',
      'vo2max-guide',
      'promo2026',
      'ab',
    ]) {
      expect(isValidRouteSlug(slug), slug).toBe(true);
    }
  });

  it('rejects anything that would make an unreadable route', () => {
    for (const bad of [
      '',
      'a',                       // too short to mean anything
      'Spring-Challenge',        // uppercase — two slugs for one funnel
      '-leading-dash',
      'has spaces',
      'has/slash',               // would break a Firestore path
      'has.dot',
      'emoji-🎉',
      'a'.repeat(50),            // beyond the length cap
    ]) {
      expect(isValidRouteSlug(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('accepts exactly at the length limit and rejects one past it', () => {
    expect(isValidRouteSlug('a'.repeat(49))).toBe(true);
    expect(isValidRouteSlug('a'.repeat(50))).toBe(false);
  });
});

describe('humanise — the placeholder label for an auto-registered funnel', () => {
  it('turns a slug into something readable', () => {
    expect(humanise('spring-hyrox-challenge')).toBe('Spring hyrox challenge');
    expect(humanise('race_week_offer')).toBe('Race week offer');
  });

  it('collapses runs of separators rather than leaving gaps', () => {
    expect(humanise('promo--2026')).toBe('Promo 2026');
  });

  it('handles a single word', () => {
    expect(humanise('waitlist')).toBe('Waitlist');
  });
});
