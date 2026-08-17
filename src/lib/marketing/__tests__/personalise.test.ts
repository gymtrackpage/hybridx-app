import { describe, it, expect, beforeAll } from 'vitest';
import { htmlToPlainText, personalise, renderForSubscriber } from '../personalise';
import { verifyToken } from '../tokens';
import type { Subscriber } from '../types';

beforeAll(() => {
  process.env.MARKETING_TOKEN_SECRET = 'test-secret-that-is-at-least-32-chars-long';
});

function sub(over: Partial<Subscriber> = {}): Subscriber {
  return {
    id: 'sub1',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    tags: [],
    status: 'active',
    source: 'signup',
    consent: { marketing: true, at: null, method: 'test' },
    createdAt: null,
    ...over,
  };
}

describe('personalise', () => {
  it('substitutes every merge token', () => {
    const out = personalise('[First Name] [Last Name] [Full Name] [Email]', sub());
    expect(out).toBe('Jane Doe Jane Doe jane@example.com');
  });

  it('is case-insensitive on token names', () => {
    expect(personalise('[first name] and [FIRST NAME]', sub())).toBe('Jane and Jane');
  });

  it('falls back to a neutral word rather than leaving "Hi ,"', () => {
    const out = personalise('Hi [First Name],', sub({ firstName: '', lastName: '' }));
    expect(out).toBe('Hi Athlete,');
  });

  it('does not leave a trailing space when only the surname is missing', () => {
    expect(personalise('[Full Name]', sub({ lastName: '' }))).toBe('Jane');
  });

  it('leaves text with no tokens untouched', () => {
    expect(personalise('No tokens here.', sub())).toBe('No tokens here.');
  });
});

describe('htmlToPlainText', () => {
  it('keeps link destinations rather than dropping them', () => {
    const text = htmlToPlainText('<p>Read the <a href="https://hybridx.club/guide">race guide</a>.</p>');
    expect(text).toContain('race guide (https://hybridx.club/guide)');
  });

  it('separates block elements onto their own lines', () => {
    const text = htmlToPlainText('<h1>Title</h1><p>One</p><p>Two</p>');
    expect(text.split('\n').filter(Boolean)).toEqual(['Title', 'One', 'Two']);
  });

  it('collapses runaway blank lines', () => {
    expect(htmlToPlainText('<p>A</p><br><br><br><p>B</p>')).not.toMatch(/\n{3}/);
  });

  it('handles an empty body', () => {
    expect(htmlToPlainText('')).toBe('');
  });
});

describe('renderForSubscriber', () => {
  const base = {
    campaignId: 'camp1',
    subject: 'Hi [First Name], your race plan',
    htmlBody: '<html><body><p>Hello [First Name]</p><a href="https://hybridx.club/x">Go</a></body></html>',
    subscriber: sub(),
    appUrl: 'https://app.hybridx.club',
  };

  it('personalises the subject line as well as the body', () => {
    expect(renderForSubscriber(base).subject).toBe('Hi Jane, your race plan');
  });

  it('appends a tracking pixel carrying a verifiable token', () => {
    const { html } = renderForSubscriber(base);
    const match = html.match(/track\/open\?t=([^"&]+)/);
    expect(match).not.toBeNull();

    const verified = verifyToken(decodeURIComponent(match![1]), 'track');
    expect(verified.valid).toBe(true);
    if (verified.valid) expect(verified.payload.subscriberId).toBe('sub1');
  });

  it('rewrites outbound links through the click tracker, preserving the destination', () => {
    const { html } = renderForSubscriber(base);
    expect(html).toContain('/api/marketing/track/click?t=');
    expect(html).toContain(encodeURIComponent('https://hybridx.club/x'));
  });

  it('leaves the unsubscribe link untracked, so opting out never depends on the tracker', () => {
    const { html, unsubscribeUrl } = renderForSubscriber(base);
    expect(html).toContain(unsubscribeUrl);
    expect(unsubscribeUrl).toContain('/api/marketing/unsubscribe?t=');
    // The unsubscribe URL must not appear wrapped in a click-tracking redirect.
    expect(html).not.toContain(`url=${encodeURIComponent(unsubscribeUrl)}`);
  });

  it('does not rewrite mailto or other non-http schemes', () => {
    const { html } = renderForSubscriber({
      ...base,
      htmlBody: '<body><a href="mailto:hi@hybridx.club">Mail</a><a href="tel:+441234">Call</a></body>',
    });
    expect(html).toContain('mailto:hi@hybridx.club');
    expect(html).toContain('tel:+441234');
  });

  it('issues an unsubscribe token that verifies for this subscriber and campaign', () => {
    const { unsubscribeUrl } = renderForSubscriber(base);
    const token = decodeURIComponent(new URL(unsubscribeUrl).searchParams.get('t')!);
    const verified = verifyToken(token, 'unsubscribe');
    expect(verified.valid).toBe(true);
    if (verified.valid) {
      expect(verified.payload.subscriberId).toBe('sub1');
      expect(verified.payload.campaignId).toBe('camp1');
    }
  });

  it('omits tracking on a test send but keeps the unsubscribe footer', () => {
    const { html } = renderForSubscriber({ ...base, tracking: false });
    expect(html).not.toContain('track/open');
    expect(html).not.toContain('track/click');
    expect(html).toContain('/api/marketing/unsubscribe?t=');
  });

  it('builds a plain-text part free of tracking markup', () => {
    const { text } = renderForSubscriber(base);
    expect(text).toContain('Hello Jane');
    expect(text).not.toContain('track/open');
    expect(text).not.toContain('track/click');
    expect(text).toContain('Unsubscribe: ');
  });

  it('handles a body authored as a fragment with no <body> element', () => {
    const { html } = renderForSubscriber({ ...base, htmlBody: '<p>Just a fragment</p>' });
    expect(html).toContain('Just a fragment');
    expect(html).toContain('track/open');
    expect(html).toContain('/api/marketing/unsubscribe?t=');
  });

  it('gives two subscribers distinct tokens, so one link cannot unsubscribe another', () => {
    const a = renderForSubscriber(base);
    const b = renderForSubscriber({ ...base, subscriber: sub({ id: 'sub2', email: 'b@example.com' }) });
    expect(a.unsubscribeUrl).not.toBe(b.unsubscribeUrl);
  });
});
