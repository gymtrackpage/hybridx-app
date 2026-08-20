import { describe, it, expect } from 'vitest';
import { describeContract, leadPayloadSchema, normaliseUtm } from '../bridge-contract';

describe('normaliseUtm — the drift this contract exists to stop', () => {
  it('reads the prefixed spelling a query string carries', () => {
    expect(
      normaliseUtm({
        utm_source: 'instagram',
        utm_medium: 'social',
        utm_campaign: 'spring',
        utm_term: 'hyrox',
        utm_content: 'story-2',
      }),
    ).toEqual({
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'spring',
      utmTerm: 'hyrox',
      utmContent: 'story-2',
    });
  });

  it('reads the bare spelling a form handler produces after stripping the prefix', () => {
    // This is the exact shape the marketing site was sending while this app
    // read utm_source — so every lead's attribution was silently discarded.
    // If this test fails, that bug is back.
    expect(
      normaliseUtm({
        source: 'instagram',
        medium: 'social',
        campaign: 'spring',
        term: 'hyrox',
        content: 'story-2',
      }),
    ).toEqual({
      utmSource: 'instagram',
      utmMedium: 'social',
      utmCampaign: 'spring',
      utmTerm: 'hyrox',
      utmContent: 'story-2',
    });
  });

  it('prefers the prefixed spelling when a caller sends both', () => {
    const result = normaliseUtm({ utm_source: 'raw', source: 'parsed' });
    expect(result?.utmSource).toBe('raw');
  });

  it('drops empty strings so "arrived directly" is not stored as attribution', () => {
    // A form rendering five hidden UTM inputs submits five empty strings when
    // the visitor came direct. Storing those makes "no attribution" and
    // "attributed to nothing" indistinguishable in every later report.
    expect(normaliseUtm({ utm_source: '', utm_medium: '   ' })).toBeUndefined();
  });

  it('keeps a partial attribution rather than discarding the whole thing', () => {
    expect(normaliseUtm({ utm_source: 'newsletter', utm_medium: '' })).toEqual({
      utmSource: 'newsletter',
      utmMedium: undefined,
      utmCampaign: undefined,
      utmTerm: undefined,
      utmContent: undefined,
    });
  });

  it('returns undefined when there was no utm object at all', () => {
    expect(normaliseUtm(undefined)).toBeUndefined();
  });

  it('caps a single value so one caller cannot write an unbounded field', () => {
    const result = normaliseUtm({ utm_campaign: 'x'.repeat(500) });
    expect(result?.utmCampaign?.length).toBe(200);
  });
});

describe('leadPayloadSchema', () => {
  const valid = { email: 'athlete@hybridx.club' };

  it('accepts a minimal payload — only the address is required', () => {
    expect(leadPayloadSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a full payload from a funnel', () => {
    const result = leadPayloadSchema.safeParse({
      email: 'athlete@hybridx.club',
      name: 'Sam Taylor',
      source: 'spring-hyrox-challenge',
      consent: true,
      consentMethod: 'landing-form',
      utm: { utm_source: 'instagram' },
      tags: ['promo:spring', 'interest:doubles'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing address, which is the one thing it cannot work without', () => {
    expect(leadPayloadSchema.safeParse({}).success).toBe(false);
  });

  it('refuses a tag claiming an origin — the route comes from the authenticated caller', () => {
    const result = leadPayloadSchema.safeParse({ ...valid, tags: ['route:magnet-vo2max'] });
    expect(result.success).toBe(false);
  });

  it('refuses malformed tags rather than writing them to a segment vocabulary', () => {
    for (const tag of ['Uppercase', 'has space', 'has/slash', 'x'.repeat(41)]) {
      expect(leadPayloadSchema.safeParse({ ...valid, tags: [tag] }).success, tag).toBe(false);
    }
  });

  it('caps the number of tags one call may apply', () => {
    const six = ['a', 'b', 'c', 'd', 'e', 'f'];
    expect(leadPayloadSchema.safeParse({ ...valid, tags: six }).success).toBe(false);
  });

  it('leaves consent undefined when unstated, so the route decides', () => {
    const result = leadPayloadSchema.safeParse(valid);
    expect(result.success && result.data.consent).toBeUndefined();
  });

  it('rejects a non-boolean consent rather than coercing it', () => {
    // 'true' as a string coercing to true would be a consent record created by
    // a type confusion, which is the one place guessing is unacceptable.
    expect(leadPayloadSchema.safeParse({ ...valid, consent: 'true' }).success).toBe(false);
  });
});

describe('describeContract — what a future funnel reads instead of guessing', () => {
  it('documents every field the schema actually accepts', () => {
    const documented = Object.keys(describeContract().fields).sort();
    const accepted = Object.keys(leadPayloadSchema.shape).sort();
    expect(documented).toEqual(accepted);
  });

  it('states how to authenticate', () => {
    expect(describeContract().auth).toContain('LEAD_BRIDGE_SECRET');
  });
});
