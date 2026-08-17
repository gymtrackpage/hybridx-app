import { describe, it, expect } from 'vitest';
import { escapeHtml, renderBlocks, renderBlocksAsText, safeUrl } from '../render';
import { blocksToText, type EmailBlock } from '../blocks';

describe('safeUrl', () => {
  it('passes http and https through', () => {
    expect(safeUrl('https://hybridx.club/x')).toBe('https://hybridx.club/x');
    expect(safeUrl('http://hybridx.club/')).toBe('http://hybridx.club/');
  });

  it('neutralises javascript: and data: URLs', () => {
    // Model-supplied URLs land in href and src attributes, so this is an
    // injection boundary reaching real inboxes.
    expect(safeUrl('javascript:alert(1)')).toBe('#');
    expect(safeUrl('data:text/html,<script>alert(1)</script>')).toBe('#');
    expect(safeUrl('vbscript:msgbox(1)')).toBe('#');
  });

  it('neutralises unparseable and missing URLs', () => {
    expect(safeUrl('not a url')).toBe('#');
    expect(safeUrl(undefined)).toBe('#');
    expect(safeUrl('')).toBe('#');
  });
});

describe('escapeHtml', () => {
  it('escapes markup so model text cannot inject tags', () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
  });

  it('escapes ampersands and apostrophes', () => {
    expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
  });
});

describe('renderBlocks', () => {
  const every: EmailBlock[] = [
    { type: 'hero', heading: 'Race ready', subheading: 'Twelve weeks out' },
    { type: 'heading', text: 'This week', level: 2 },
    { type: 'paragraph', text: 'Your plan adapts to how you train.' },
    { type: 'bulletList', items: ['Sled pushes', 'Compromised running'] },
    { type: 'cta', label: 'Open your plan', url: 'https://app.hybridx.club/dashboard' },
    { type: 'image', url: 'https://hybridx.club/a.png', alt: 'Athlete mid-session' },
    { type: 'divider' },
    { type: 'programCard', programName: 'First Steps to Hyrox', description: 'Beginner, 4 days/week' },
    { type: 'statRow', stats: [{ value: '8km', label: 'Running' }, { value: '8', label: 'Stations' }] },
    { type: 'quote', text: 'Hardest session yet.', attribution: 'Sam' },
  ];

  it('renders every block type without throwing', () => {
    const html = renderBlocks(every);
    expect(html).toContain('Race ready');
    expect(html).toContain('This week');
    expect(html).toContain('Your plan adapts');
    expect(html).toContain('Sled pushes');
    expect(html).toContain('Open your plan');
    expect(html).toContain('Athlete mid-session');
    expect(html).toContain('First Steps to Hyrox');
    expect(html).toContain('Stations');
    expect(html).toContain('Hardest session yet');
  });

  it('produces a complete document with the mail-client meta tags', () => {
    const html = renderBlocks(every);
    expect(html).toMatch(/^<!DOCTYPE html/);
    expect(html).toContain('x-apple-disable-message-reformatting');
    expect(html).toContain('</html>');
  });

  it('lays out with tables, since Outlook ignores modern CSS', () => {
    const html = renderBlocks(every);
    expect(html).toContain('role="presentation"');
    expect(html).not.toMatch(/display:\s*flex/);
    expect(html).not.toMatch(/display:\s*grid/);
  });

  it('inlines styles rather than relying on a stripped style block', () => {
    const html = renderBlocks(every);
    expect(html).not.toContain('<style');
    expect(html).toContain('style="');
  });

  it('escapes text so a model cannot inject markup into an email', () => {
    const html = renderBlocks([{ type: 'paragraph', text: '<img src=x onerror=alert(1)>' }]);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('neutralises a dangerous CTA URL rather than emitting it', () => {
    const html = renderBlocks([{ type: 'cta', label: 'Click', url: 'javascript:alert(1)' }]);
    expect(html).not.toContain('javascript:');
    expect(html).toContain('href="#"');
  });

  it('hides the preview text from the visible body', () => {
    const html = renderBlocks(every, { previewText: 'Twelve weeks to race day' });
    expect(html).toContain('Twelve weeks to race day');
    expect(html).toContain('display:none');
    expect(html).toContain('mso-hide:all');
  });

  it('omits the preheader entirely when no preview text is supplied', () => {
    expect(renderBlocks(every)).not.toContain('mso-hide:all');
  });

  it('renders an empty block list as a valid shell rather than crashing', () => {
    const html = renderBlocks([]);
    expect(html).toContain('HYBRIDX');
    expect(html).toContain('</html>');
  });

  it('passes rawHtml through, as the hand-authored escape hatch', () => {
    const html = renderBlocks([{ type: 'rawHtml', html: '<p class="custom">Hand written</p>' }]);
    expect(html).toContain('<p class="custom">Hand written</p>');
  });

  it('is deterministic — the same blocks always give the same HTML', () => {
    expect(renderBlocks(every)).toBe(renderBlocks(every));
  });
});

describe('renderBlocksAsText', () => {
  it('keeps CTA destinations, which a text reader otherwise cannot follow', () => {
    const text = renderBlocksAsText([
      { type: 'cta', label: 'Open your plan', url: 'https://app.hybridx.club/dashboard' },
    ]);
    expect(text).toContain('Open your plan: https://app.hybridx.club/dashboard');
  });

  it('renders bullets readably', () => {
    expect(renderBlocksAsText([{ type: 'bulletList', items: ['One', 'Two'] }])).toBe(
      '  * One\n  * Two',
    );
  });

  it('contains no HTML tags', () => {
    const text = renderBlocksAsText([
      { type: 'hero', heading: 'Race ready' },
      { type: 'paragraph', text: 'Body copy' },
      { type: 'rawHtml', html: '<p>Stripped</p>' },
    ]);
    expect(text).not.toMatch(/<[a-z]/i);
    expect(text).toContain('Stripped');
  });

  it('skips an image with no alt text rather than emitting empty brackets', () => {
    expect(renderBlocksAsText([{ type: 'image', url: 'https://x.com/a.png', alt: '' }])).toBe('');
  });
});

describe('blocksToText', () => {
  it('collects the copy a validator needs to check', () => {
    const text = blocksToText([
      { type: 'paragraph', text: 'Only £5/month' },
      { type: 'cta', label: 'Start your trial', url: 'https://x.com' },
    ]);
    expect(text).toContain('£5/month');
    expect(text).toContain('Start your trial');
  });

  it('omits blocks with no text', () => {
    expect(blocksToText([{ type: 'divider' }])).toBe('');
  });
});
