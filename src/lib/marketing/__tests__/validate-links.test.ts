import { describe, it, expect } from 'vitest';
import { validateLinks } from '@/lib/marketing/validate';
import type { EmailBlock } from '@/lib/marketing/blocks';

const APP_URL = 'https://app.hybridx.club';

const cta = (url: string): EmailBlock => ({ type: 'cta', label: 'Go', url });

describe('validateLinks', () => {
  it('passes a real app path', () => {
    expect(validateLinks([cta(`${APP_URL}/dashboard`)], APP_URL)).toEqual([]);
  });

  it('passes a dynamic-segment path', () => {
    expect(validateLinks([cta(`${APP_URL}/programs/abc123/view`)], APP_URL)).toEqual([]);
  });

  it('flags an invented app path — the reported bug', () => {
    const issues = validateLinks([cta(`${APP_URL}/join-now`)], APP_URL);
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('error');
    expect(issues[0].message).toContain('/join-now');
    expect(issues[0].message).toContain('404');
  });

  it('leaves an external link alone', () => {
    // Not everything the model links to is the app — Strava, a HYROX event
    // page, an unsubscribe link elsewhere. Only app.hybridx.club is checkable.
    expect(validateLinks([cta('https://strava.com/activities/123')], APP_URL)).toEqual([]);
  });

  it('flags a malformed URL', () => {
    const issues = validateLinks([cta('not a url')], APP_URL);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain('not a valid URL');
  });

  it('ignores blocks with no link at all', () => {
    expect(validateLinks([{ type: 'paragraph', text: 'Hi' }], APP_URL)).toEqual([]);
    expect(validateLinks([{ type: 'divider' }], APP_URL)).toEqual([]);
  });

  it('checks programCard and image links too, not only cta', () => {
    const bad: EmailBlock[] = [
      { type: 'programCard', programName: 'First Steps', description: 'x', url: `${APP_URL}/enrol` },
      { type: 'image', url: 'https://cdn.example/x.png', alt: 'x', linkUrl: `${APP_URL}/shop` },
    ];
    const issues = validateLinks(bad, APP_URL);
    expect(issues).toHaveLength(2);
  });

  it('is tolerant of a trailing slash on the configured app URL', () => {
    expect(validateLinks([cta('https://app.hybridx.club/dashboard')], 'https://app.hybridx.club/')).toEqual([]);
  });

  it('passes the bare app root — the CTA default when an author leaves the URL blank', () => {
    expect(validateLinks([cta('https://app.hybridx.club')], APP_URL)).toEqual([]);
    expect(validateLinks([cta('https://app.hybridx.club/')], APP_URL)).toEqual([]);
  });
});
