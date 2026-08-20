// src/lib/marketing/bridge-contract.ts
//
// The wire contract between a funnel and the mailing system.
//
// This exists because the two halves drifted. The marketing site sent
// `utm: { source, medium, campaign }`; this app read `utm.utm_source`. Both
// were internally consistent, both typechecked, neither knew about the other —
// and so every lead's first-touch attribution was quietly discarded from the
// day the bridge was built. Nothing failed. The data was simply not there.
//
// Two independently-declared shapes that must match will eventually not match.
// So the contract is declared once, here, parsed rather than trusted, and
// published at GET /api/marketing/leads so anything building a new funnel can
// read what the fields are instead of guessing from an example.
//
// Compatibility is deliberate: both UTM spellings are accepted and normalised.
// A future funnel should not have to know which of them history settled on, and
// a contract that rejects the callers it already has is not a contract, it is
// an outage.

import { z } from 'zod';

/** Bumped when a field's meaning changes. Reported by the contract endpoint. */
export const BRIDGE_CONTRACT_VERSION = '1.1.0';

/**
 * A tag a funnel may attach. Constrained rather than trusted: this arrives from
 * another service, and an unbounded tag write would let a compromised funnel
 * place people into any segment. `route:` is reserved — origin is decided by
 * the registry from the authenticated call, never claimed by the payload.
 */
const tagSchema = z
  .string()
  .regex(/^[a-z0-9:-]{1,40}$/, 'Tags must be lowercase [a-z0-9:-], 1–40 characters.')
  .refine((t) => !t.startsWith('route:'), {
    message: 'The route: prefix is reserved — origin comes from the authenticated caller.',
  });

/**
 * UTM parameters, in either spelling.
 *
 * `utm_source` is what a browser query string carries, and `source` is what a
 * form handler naturally names it after stripping the prefix. Both are real,
 * both are in use, so both are accepted and `normaliseUtm` collapses them.
 */
const utmSchema = z.record(z.string(), z.string()).optional();

export const leadPayloadSchema = z.object({
  email: z.string().trim().min(3).max(254),

  name: z.string().trim().max(160).optional(),

  /**
   * The funnel. A registry route id, a legacy source name, or the slug of a
   * funnel launched since the last deploy — the registry resolves all three and
   * registers the last one on sight.
   */
  source: z.string().trim().min(1).max(64).optional(),

  /**
   * Whether the person agreed to ongoing marketing, as distinct from requesting
   * an asset. Omitted means "the route decides", which is the conservative
   * reading; sending `true` without evidence is what turns a mailing list into
   * a liability, so it is stated explicitly rather than defaulted.
   */
  consent: z.boolean().optional(),

  consentMethod: z.string().trim().max(120).optional(),

  utm: utmSchema,

  tags: z.array(tagSchema).max(5).optional(),
});

export type LeadPayload = z.infer<typeof leadPayloadSchema>;

/** Canonical attribution, as stored on the subscriber. */
export interface NormalisedUtm {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

/**
 * Collapse either UTM spelling into the canonical field names.
 *
 * The prefixed form wins when both are present: a caller sending both is most
 * likely forwarding a raw query string alongside its own parsed copy, and the
 * raw one is the source of truth.
 *
 * Empty strings are dropped rather than stored. A form that renders five hidden
 * UTM inputs submits five empty strings when the visitor arrived directly, and
 * storing those would make "no attribution" indistinguishable from "attributed
 * to nothing" in every report that follows.
 */
export function normaliseUtm(utm: Record<string, string> | undefined): NormalisedUtm | undefined {
  if (!utm) return undefined;

  const pick = (prefixed: string, bare: string): string | undefined => {
    const value = utm[prefixed] ?? utm[bare];
    const trimmed = typeof value === 'string' ? value.trim() : '';
    return trimmed.length ? trimmed.slice(0, 200) : undefined;
  };

  const normalised: NormalisedUtm = {
    utmSource: pick('utm_source', 'source'),
    utmMedium: pick('utm_medium', 'medium'),
    utmCampaign: pick('utm_campaign', 'campaign'),
    utmTerm: pick('utm_term', 'term'),
    utmContent: pick('utm_content', 'content'),
  };

  // All five absent means there was no attribution, which should read as
  // undefined rather than an object full of undefined.
  return Object.values(normalised).some(Boolean) ? normalised : undefined;
}

/**
 * Machine-readable description of the contract, served by the bridge endpoint.
 *
 * The point is that someone building a funnel next year can ask the system what
 * it accepts, rather than copying an existing caller and inheriting whatever
 * that one happens to get wrong.
 */
export function describeContract() {
  return {
    version: BRIDGE_CONTRACT_VERSION,
    endpoint: 'POST /api/marketing/leads',
    auth: 'Authorization: Bearer <LEAD_BRIDGE_SECRET>, or x-bridge-secret header',
    fields: {
      email: { type: 'string', required: true, note: 'Trimmed and lowercased on receipt.' },
      name: { type: 'string', required: false, note: 'Full name; split into first and last.' },
      source: {
        type: 'string',
        required: false,
        note:
          'Funnel identifier. A route id, a legacy source name, or a new slug ' +
          '([a-z0-9][a-z0-9_-]{1,48}) which is registered on first sight.',
      },
      consent: {
        type: 'boolean',
        required: false,
        note: 'Omit to let the route decide. Only send true with real evidence.',
      },
      consentMethod: { type: 'string', required: false },
      utm: {
        type: 'object<string,string>',
        required: false,
        note: 'Accepts utm_source or source, utm_medium or medium, and so on.',
      },
      tags: {
        type: 'string[]',
        required: false,
        note: 'Max 5, lowercase [a-z0-9:-]. The route: prefix is reserved.',
      },
    },
    responds: {
      success: 'boolean',
      created: 'boolean — false when the address was already known',
      route: 'string — the route this lead was filed under',
      suppressed: 'boolean — true when this address must not be mailed',
      status: 'active | unsubscribed | bounced | complained | unknown',
    },
  };
}
