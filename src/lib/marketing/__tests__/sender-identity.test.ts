import { describe, it, expect, afterEach } from 'vitest';
import { getMarketingSenderDomain, sharesTransactionalSender } from '../transport';

const ORIGINAL = { ...process.env };
afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('sharesTransactionalSender — the invisible deliverability failure', () => {
  it('flags bulk and transactional sharing one address', () => {
    // The deployed state this check was written for. A campaign that draws
    // complaints from this address degrades delivery of verification email,
    // and nobody notices until someone cannot sign in.
    process.env.MARKETING_EMAIL_FROM = 'training@hybridx.club';
    process.env.EMAIL_FROM = 'training@hybridx.club';
    expect(sharesTransactionalSender()).toBe(true);
  });

  it('is satisfied once campaigns move to their own subdomain', () => {
    process.env.MARKETING_EMAIL_FROM = 'news@mail.hybridx.club';
    process.env.EMAIL_FROM = 'training@hybridx.club';
    expect(sharesTransactionalSender()).toBe(false);
  });

  it('ignores case and surrounding whitespace, which a pasted secret carries', () => {
    process.env.MARKETING_EMAIL_FROM = '  Training@HybridX.Club ';
    process.env.EMAIL_FROM = 'training@hybridx.club';
    expect(sharesTransactionalSender()).toBe(true);
  });

  it('flags an unset MARKETING_EMAIL_FROM, because campaigns then fall back to EMAIL_FROM', () => {
    // The previous version of this check returned false here and the health
    // panel rendered a green tick reading "apart from transactional mail" —
    // while getMarketingFrom() resolved campaigns to the verification address.
    // A green light for the most common form of the misconfiguration is worse
    // than no check at all.
    delete process.env.MARKETING_EMAIL_FROM;
    process.env.EMAIL_FROM = 'training@hybridx.club';
    expect(sharesTransactionalSender()).toBe(true);
  });

  it('sees through the display-name form both variables are set in', () => {
    process.env.MARKETING_EMAIL_FROM = '"HYBRIDX" <training@hybridx.club>';
    process.env.EMAIL_FROM = 'training@hybridx.club';
    expect(sharesTransactionalSender()).toBe(true);
  });

  it('claims no conflict when nothing at all is configured', () => {
    delete process.env.MARKETING_EMAIL_FROM;
    delete process.env.EMAIL_FROM;
    expect(sharesTransactionalSender()).toBe(false);
  });
});

describe('getMarketingSenderDomain', () => {
  it('reads the domain campaigns actually send from', () => {
    process.env.MARKETING_EMAIL_FROM = 'news@mail.hybridx.club';
    expect(getMarketingSenderDomain()).toBe('mail.hybridx.club');
  });

  it('strips the display-name wrapper rather than reporting a trailing bracket', () => {
    process.env.MARKETING_EMAIL_FROM = '"HYBRIDX" <news@mail.hybridx.club>';
    expect(getMarketingSenderDomain()).toBe('mail.hybridx.club');
  });

  it('falls back to the transactional address when no bulk one is set', () => {
    delete process.env.MARKETING_EMAIL_FROM;
    process.env.EMAIL_FROM = 'training@hybridx.club';
    expect(getMarketingSenderDomain()).toBe('hybridx.club');
  });

  it('returns null when nothing is configured', () => {
    delete process.env.MARKETING_EMAIL_FROM;
    delete process.env.EMAIL_FROM;
    expect(getMarketingSenderDomain()).toBeNull();
  });
});
