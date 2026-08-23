import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INTAKE_ROUTES, resolveRoute, tagsForRoute } from '../sources';

// scripts/port-website-leads.ts re-declares the site's source -> route mapping
// and each route's tags, because it writes Firestore directly and must not pull
// in the app's server-only module graph. Re-declared means it can drift, and a
// drifted mapping files historical leads under the wrong funnel — silently, and
// unpicking it afterwards means knowing which run was wrong.
//
// So the duplication is allowed and the agreement is pinned here.
const script = readFileSync(
  join(process.cwd(), 'scripts/port-website-leads.ts'),
  'utf8',
);

function parseRecord(name: string): Record<string, string> {
  const block = new RegExp(`const ${name}: Record<string, string> = \\{([^}]*)\\}`).exec(script);
  if (!block) throw new Error(`${name} not found in the port script`);
  const out: Record<string, string> = {};
  for (const m of block[1].matchAll(/(\w+):\s*'([^']+)'/g)) out[m[1]] = m[2];
  return out;
}

function parseTagMap(): Record<string, string[]> {
  const block = /const TAGS_BY_ROUTE: Record<string, string\[\]> = \{([\s\S]*?)\n\};/.exec(script);
  if (!block) throw new Error('TAGS_BY_ROUTE not found in the port script');
  const out: Record<string, string[]> = {};
  for (const m of block[1].matchAll(/'([^']+)':\s*\[([^\]]*)\]/g)) {
    out[m[1]] = [...m[2].matchAll(/'([^']+)'/g)].map((t) => t[1]);
  }
  return out;
}

describe('port-website-leads agrees with the intake registry', () => {
  const routeBySource = parseRecord('ROUTE_BY_SOURCE');
  const tagsByRoute = parseTagMap();

  it('maps every site source to a route the registry actually knows', () => {
    for (const [source, routeId] of Object.entries(routeBySource)) {
      const resolved = resolveRoute(routeId);
      expect(resolved, `route "${routeId}" for source "${source}"`).toBeTruthy();
      expect(resolved!.id).toBe(routeId);
    }
  });

  it('resolves each site source through the registry to the same route', () => {
    // The registry carries these spellings as aliases. If an alias is removed
    // there, the live bridge and this backfill would file the same person under
    // two different routes.
    for (const [source, routeId] of Object.entries(routeBySource)) {
      const viaAlias = resolveRoute(source);
      expect(viaAlias, `alias "${source}" missing from the registry`).toBeTruthy();
      expect(viaAlias!.id, `alias "${source}"`).toBe(routeId);
    }
  });

  it('carries exactly the tags tagsForRoute would apply', () => {
    for (const [routeId, tags] of Object.entries(tagsByRoute)) {
      const route = INTAKE_ROUTES.find((r) => r.id === routeId)!;
      expect(route, `route ${routeId}`).toBeTruthy();
      expect([...tags].sort(), `tags for ${routeId}`).toEqual([...tagsForRoute(route)].sort());
    }
  });

  it('declares tags for every route it can import into', () => {
    for (const routeId of Object.values(routeBySource)) {
      expect(tagsByRoute[routeId], `no tags declared for ${routeId}`).toBeTruthy();
    }
  });

  it('treats exactly the confirmed-opt-in routes as needing confirmation', () => {
    // A route the registry calls `confirmed` but the script imports as consented
    // would mark someone mailable who never clicked the link — the precise thing
    // double opt-in exists to prevent.
    const declared = /const CONFIRMED_OPT_IN = new Set\(\[([^\]]*)\]\)/.exec(script);
    expect(declared).toBeTruthy();
    const scriptSet = [...declared![1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();

    const registrySet = Object.values(routeBySource)
      .filter((id) => INTAKE_ROUTES.find((r) => r.id === id)?.consentPolicy === 'confirmed')
      .sort();

    expect(scriptSet).toEqual(registrySet);
  });
});
