import { describe, it, expect } from 'vitest';
import {
  FALLBACK_ROUTE_ID,
  INTAKE_ROUTES,
  getRoute,
  grantsConsentOnCapture,
  resolveRoute,
  routeTag,
  routesByProperty,
  tagsForRoute,
} from '../sources';

describe('the registry itself', () => {
  it('has unique route ids', () => {
    const ids = INTAKE_ROUTES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique aliases, so an incoming source name resolves to exactly one route', () => {
    const aliases = INTAKE_ROUTES.flatMap((r) => r.aliases ?? []);
    expect(new Set(aliases).size).toBe(aliases.length);
  });

  it('defines the fallback route it promises to fall back to', () => {
    expect(getRoute(FALLBACK_ROUTE_ID)).toBeDefined();
  });

  it('never declares a route: tag by hand — routeTag owns that prefix', () => {
    // `route:unclassified` on the fallback is the one deliberate exception: it
    // marks a lead as needing a registry entry, and is not an origin claim.
    const offenders = INTAKE_ROUTES.filter((r) =>
      r.tags.some((t) => t.startsWith('route:') && t !== 'route:unclassified'),
    );
    expect(offenders).toEqual([]);
  });
});

describe('resolveRoute', () => {
  it('resolves a route by its own id', () => {
    expect(resolveRoute('magnet-vo2max').id).toBe('magnet-vo2max');
  });

  it("resolves the marketing site's own source names through aliases", () => {
    expect(resolveRoute('build_a_bigger_engine').id).toBe('magnet-vo2max');
    expect(resolveRoute('free_hyrox_plan').id).toBe('magnet-free-plan');
    expect(resolveRoute('hyrox_rules_card').id).toBe('magnet-race-card');
    expect(resolveRoute('sign_up').id).toBe('website-signup');
  });

  it('tolerates surrounding whitespace from a form field', () => {
    expect(resolveRoute('  magnet-race-card  ').id).toBe('magnet-race-card');
  });

  it('falls back rather than throwing, so an unknown magnet never loses the lead', () => {
    expect(resolveRoute('a_magnet_added_last_night').id).toBe(FALLBACK_ROUTE_ID);
    expect(resolveRoute(undefined).id).toBe(FALLBACK_ROUTE_ID);
    expect(resolveRoute('').id).toBe(FALLBACK_ROUTE_ID);
  });
});

describe('consent posture', () => {
  it('grants consent on capture only for implied and explicit routes', () => {
    expect(grantsConsentOnCapture('implied')).toBe(true);
    expect(grantsConsentOnCapture('explicit')).toBe(true);
    expect(grantsConsentOnCapture('confirmed')).toBe(false);
    expect(grantsConsentOnCapture('none')).toBe(false);
  });

  it('withholds consent for the confirmed opt-in magnet until the link is clicked', () => {
    const raceCard = getRoute('magnet-race-card')!;
    expect(raceCard.consentPolicy).toBe('confirmed');
    expect(grantsConsentOnCapture(raceCard.consentPolicy)).toBe(false);
  });

  it('never implies consent from merely holding an account or being imported', () => {
    for (const id of ['app-account', 'admin-manual', 'admin-import', 'account-sync', 'beta-android']) {
      expect(grantsConsentOnCapture(getRoute(id)!.consentPolicy), id).toBe(false);
    }
  });
});

describe('tagsForRoute', () => {
  it('always leads with the route tag', () => {
    expect(tagsForRoute(getRoute('magnet-vo2max')!)).toContain(routeTag('magnet-vo2max'));
  });

  it('carries the route’s own tags alongside it', () => {
    const tags = tagsForRoute(getRoute('magnet-vo2max')!);
    expect(tags).toContain('source:website');
    expect(tags).toContain('magnet:vo2max-guide');
  });

  it('does not duplicate tags', () => {
    for (const route of INTAKE_ROUTES) {
      const tags = tagsForRoute(route);
      expect(new Set(tags).size, route.id).toBe(tags.length);
    }
  });
});

describe('routesByProperty', () => {
  it('places every route under exactly one property', () => {
    const grouped = routesByProperty();
    const total = grouped.website.length + grouped.app.length + grouped.admin.length;
    expect(total).toBe(INTAKE_ROUTES.length);
  });

  it('groups the marketing site’s magnets under the website', () => {
    const ids = routesByProperty().website.map((r) => r.id);
    expect(ids).toContain('magnet-vo2max');
    expect(ids).toContain('magnet-race-card');
  });
});
