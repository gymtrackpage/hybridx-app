// src/lib/marketing/sources.ts
//
// The intake registry: every route by which an email address can enter the
// mailing system, declared once.
//
// Before this existed, each intake path invented its own tags, its own consent
// posture and its own source string at the call site — the marketing site's
// bridge mapped magnet names to tags in one file, the beta form hard-coded a
// different pair of tags in another, and the admin importer set neither. There
// was no single answer to "where do subscribers come from", and no way to ask
// the list for everyone who arrived by a particular route.
//
// Declaring routes here means:
//
//   - Adding an intake path is one entry, not a scattering of literals.
//   - Every subscriber carries a `route:<id>` tag, so the console can group by
//     origin and any journey can be narrowed to one route.
//   - Consent posture travels with the route rather than being restated (and
//     eventually misstated) at each call site.
//   - The marketing site keeps sending its own vocabulary; `aliases` maps it,
//     so a new magnet does not require both projects to deploy in lockstep.

import type { SubscriberSource } from './types';

/**
 * How consent is obtained on a route. This is documentation of the legal basis
 * as much as configuration — under GDPR you must be able to say how consent was
 * given, and the honest answer differs per route.
 */
export type ConsentPolicy =
  /** The form states that signing up means ongoing email. Consent on capture. */
  | 'implied'
  /** The person ticked a box specifically about marketing. Consent on capture. */
  | 'explicit'
  /** Consent only after a confirmation link is clicked. Not granted on capture. */
  | 'confirmed'
  /** Arriving by this route never implies consent — the address is known, not mailable. */
  | 'none';

/** Which property or surface an intake route belongs to. */
export type IntakeProperty = 'website' | 'app' | 'admin';

export interface IntakeRoute {
  /** Stable identifier. Becomes the `route:<id>` tag and the event payload's route. */
  id: string;
  /** Shown in the marketing console. */
  label: string;
  /** What the person actually did, for the console and for AI prompt context. */
  description: string;
  property: IntakeProperty;
  /**
   * The coarse-grained source recorded on the subscriber document. Retained
   * because `Subscriber.source` predates this registry and existing records
   * carry it; `route` is the finer-grained successor.
   */
  source: SubscriberSource;
  consentPolicy: ConsentPolicy;
  /**
   * Tags applied on top of the automatic `route:<id>`. Kept deliberately short:
   * a route is already a tag, so these are for cross-cutting facets a segment
   * would want independently, like `source:website`.
   */
  tags: string[];
  /**
   * External names that resolve to this route — the `source` values the
   * marketing site sends over the lead bridge. Lets that project keep its own
   * vocabulary without the two having to agree on ids.
   */
  aliases?: string[];
}

/**
 * Whether a route grants marketing consent at the moment of capture.
 * `confirmed` deliberately does not: someone who has been sent a confirmation
 * link has not yet clicked it.
 */
export function grantsConsentOnCapture(policy: ConsentPolicy): boolean {
  return policy === 'implied' || policy === 'explicit';
}

// ---------------------------------------------------------------------------
// The registry
// ---------------------------------------------------------------------------

export const INTAKE_ROUTES: readonly IntakeRoute[] = [
  // ── hybridx.club — the marketing site's lead magnets ────────────────────
  {
    id: 'magnet-free-plan',
    label: 'Free HYROX plan',
    description: 'Downloaded the free HYROX training plan from the marketing site.',
    property: 'website',
    source: 'landing',
    consentPolicy: 'implied',
    tags: ['source:website', 'magnet:free-plan'],
    aliases: ['free_hyrox_plan'],
  },
  {
    id: 'magnet-vo2max',
    label: 'Build a Bigger Engine guide',
    description: 'Requested the VO2max guide from the marketing site.',
    property: 'website',
    source: 'landing',
    consentPolicy: 'implied',
    tags: ['source:website', 'magnet:vo2max-guide'],
    aliases: ['build_a_bigger_engine'],
  },
  {
    id: 'magnet-race-card',
    label: 'HYROX race day rules card',
    description:
      'Requested the 2026 race day rules card. Confirmed opt-in — consent is granted ' +
      'only when the confirmation link is clicked.',
    property: 'website',
    source: 'landing',
    consentPolicy: 'confirmed',
    tags: ['source:website', 'magnet:race-card'],
    aliases: ['hyrox_rules_card'],
  },
  {
    id: 'magnet-athx-guide',
    label: 'What is ATHX? one-page guide',
    description:
      'Requested the one-page ATHX guide from the ATHX 2027 pre-launch funnel. Confirmed ' +
      'opt-in — the guide is delivered by an emailed link, and consent is granted only ' +
      'when that link is clicked. This cohort is pre-launch demand for the ATHX 2027 books ' +
      'rather than general training interest.',
    property: 'website',
    source: 'landing',
    consentPolicy: 'confirmed',
    tags: ['source:website', 'magnet:athx-guide'],
    aliases: ['athx_2027_guide'],
  },
  {
    id: 'website-signup',
    label: 'Marketing site sign-up',
    description: 'Signed up for email directly on the marketing site, without a magnet.',
    property: 'website',
    source: 'landing',
    consentPolicy: 'implied',
    tags: ['source:website'],
    aliases: ['sign_up'],
  },
  {
    id: 'website-other',
    label: 'Marketing site (unclassified)',
    description:
      'Captured on the marketing site by a route this registry does not yet name. ' +
      'A lead landing here is a prompt to add a proper entry, not an error.',
    property: 'website',
    source: 'landing',
    consentPolicy: 'none',
    tags: ['source:website', 'route:unclassified'],
  },

  // ── app.hybridx.club ───────────────────────────────────────────────────
  {
    id: 'app-homepage',
    label: 'App homepage form',
    description: 'Entered their address in the capture form on the app’s public homepage.',
    property: 'app',
    source: 'landing',
    consentPolicy: 'explicit',
    tags: ['source:app'],
  },
  {
    id: 'app-account',
    label: 'HYBRIDX account',
    description:
      'Created an account. Having an account is not agreement to receive marketing, ' +
      'so consent comes from the profile toggle rather than from this route.',
    property: 'app',
    source: 'signup',
    consentPolicy: 'none',
    tags: ['source:app', 'athlete'],
  },
  {
    id: 'beta-android',
    label: 'Android beta request',
    description:
      'Asked to join the Android beta. A request for that build, not for campaigns.',
    property: 'app',
    source: 'beta-request',
    consentPolicy: 'none',
    tags: ['source:app', 'interest:android'],
  },

  // ── Administrative ─────────────────────────────────────────────────────
  {
    id: 'admin-manual',
    label: 'Added by an admin',
    description: 'Entered by hand in the marketing console.',
    property: 'admin',
    source: 'admin',
    consentPolicy: 'none',
    tags: ['source:admin'],
  },
  {
    id: 'admin-import',
    label: 'CSV import',
    description: 'Imported in bulk from a file.',
    property: 'admin',
    source: 'import',
    consentPolicy: 'none',
    tags: ['source:admin'],
  },
  {
    id: 'account-sync',
    label: 'Athlete roster sync',
    description:
      'Back-filled from the athlete roster by the nightly reconciliation, carrying ' +
      'whatever consent the athlete’s own profile records.',
    property: 'admin',
    source: 'sync',
    consentPolicy: 'none',
    tags: ['athlete'],
  },
  {
    id: 'migration',
    label: 'HXMailer migration',
    description: 'Carried over from the retired HXMailer system.',
    property: 'admin',
    source: 'migration',
    consentPolicy: 'none',
    tags: [],
  },
] as const;

/** Route used when an incoming source cannot be resolved. Never throws the lead away. */
export const FALLBACK_ROUTE_ID = 'website-other';

const BY_ID = new Map(INTAKE_ROUTES.map((r) => [r.id, r]));

const BY_ALIAS = new Map(
  INTAKE_ROUTES.flatMap((r) => (r.aliases ?? []).map((a) => [a, r] as const)),
);

/** Look up a route by its id. Returns undefined rather than guessing. */
export function getRoute(id: string): IntakeRoute | undefined {
  return BY_ID.get(id);
}

/**
 * Resolve an incoming identifier — a route id, or one of the marketing site's
 * own source names — to a route.
 *
 * Falls back rather than failing. A lead arriving under an unrecognised name is
 * a registry that has fallen behind a deploy, and losing the person over it
 * would be a far worse outcome than filing them as unclassified.
 */
export function resolveRoute(identifier: string | undefined | null): IntakeRoute {
  const key = (identifier ?? '').trim();
  return (
    BY_ID.get(key) ??
    BY_ALIAS.get(key) ??
    (BY_ID.get(FALLBACK_ROUTE_ID) as IntakeRoute)
  );
}

/** The tag marking which route a subscriber arrived by. */
export function routeTag(routeId: string): string {
  return `route:${routeId}`;
}

/** Every tag a subscriber captured on this route should carry. */
export function tagsForRoute(route: IntakeRoute): string[] {
  return Array.from(new Set([routeTag(route.id), ...route.tags]));
}

/** Routes grouped by property, for the console's subscriber filters. */
export function routesByProperty(): Record<IntakeProperty, IntakeRoute[]> {
  const grouped: Record<IntakeProperty, IntakeRoute[]> = { website: [], app: [], admin: [] };
  for (const route of INTAKE_ROUTES) grouped[route.property].push(route);
  return grouped;
}

/** Prefixes this registry owns, so a sync can refresh them without touching manual tags. */
export const ROUTE_TAG_PREFIX = 'route:';
