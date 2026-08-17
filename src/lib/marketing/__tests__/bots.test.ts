import { describe, it, expect } from 'vitest';
import { classifyTrackingHit, isScannerClick } from '../bots';

function req(userAgent?: string, extraHeaders: Record<string, string> = {}): Request {
  return new Request('https://app.hybridx.club/api/marketing/track/open', {
    headers: { ...(userAgent ? { 'user-agent': userAgent } : {}), ...extraHeaders },
  });
}

const REAL_BROWSER =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

describe('classifyTrackingHit', () => {
  it('treats an ordinary browser as a genuine open', () => {
    expect(classifyTrackingHit(req(REAL_BROWSER)).isBot).toBe(false);
  });

  it('excludes Apple Mail Privacy Protection prefetches', () => {
    const verdict = classifyTrackingHit(
      req('Mozilla/5.0', { 'x-apple-request-uuid': 'abc-123' }),
    );
    expect(verdict).toEqual({ isBot: true, reason: 'apple-mpp' });
  });

  it('excludes security gateways and scanners', () => {
    for (const ua of [
      'Proofpoint/1.0',
      'Mimecast Ltd',
      'BarracudaCentral',
      'Microsoft Office Word',
      'SomeCrawler/2.0',
      'python-requests/2.31',
      'curl/8.1.2',
      'HeadlessChrome/120',
    ]) {
      expect(classifyTrackingHit(req(ua)).isBot, ua).toBe(true);
    }
  });

  it('treats a missing user-agent as machine traffic', () => {
    expect(classifyTrackingHit(req())).toEqual({ isBot: true, reason: 'no-user-agent' });
  });

  it("counts Gmail's image proxy as unverifiable rather than human", () => {
    // Genuine Gmail opens also arrive this way, so the headline metric stays
    // conservative and these land in openRaw only.
    expect(classifyTrackingHit(req('GoogleImageProxy')).isBot).toBe(true);
  });

  it('reports why a hit was excluded, for diagnosing a suspiciously low open rate', () => {
    expect(classifyTrackingHit(req('Proofpoint/1.0')).reason).toBe('proofpoint');
  });
});

describe('isScannerClick', () => {
  it('accepts a click from a real browser', () => {
    expect(isScannerClick(req(REAL_BROWSER))).toBe(false);
  });

  it('rejects clicks from link scanners', () => {
    for (const ua of ['Proofpoint/1.0', 'Mimecast', 'curl/8.1.2', 'SomeBot/1.0']) {
      expect(isScannerClick(req(ua)), ua).toBe(true);
    }
  });

  it('still counts a Gmail-proxied click, unlike a Gmail-proxied open', () => {
    // Apple MPP and Gmail's proxy prefetch images but do not follow links, so
    // excluding them here would discard genuine clicks.
    expect(isScannerClick(req('GoogleImageProxy'))).toBe(false);
    expect(isScannerClick(req('Mozilla/5.0', { 'x-apple-request-uuid': 'abc' }))).toBe(false);
  });

  it('rejects a click with no user-agent', () => {
    expect(isScannerClick(req())).toBe(true);
  });
});
