import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import { INTAKE_ROUTES, resolveRoute, FALLBACK_ROUTE_ID } from '../sources';

/**
 * Guards the one failure this system cannot detect at runtime: a capture path
 * naming a route that does not exist.
 *
 * It would not throw. `resolveRoute` falls back rather than failing, because
 * losing a real lead over a typo is worse than filing it oddly — which means a
 * misspelled route id at a call site produces working code that quietly files
 * every lead from that funnel as unclassified, where no journey targets it.
 *
 * So the source tree is scanned instead. Adding a capture path with a route
 * that is not declared fails here, at the point it is written.
 */

const SRC = resolve(__dirname, '../../..');

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.tsx?$/.test(entry)) files.push(full);
  }
  return files;
}

/** `route: 'some-id'` as written at a captureLead call site. */
const ROUTE_LITERAL = /\broute:\s*'([a-z0-9][a-z0-9_-]{1,48})'/g;

describe('route coverage across the codebase', () => {
  const referenced = new Map<string, string[]>();

  for (const file of walk(SRC)) {
    const contents = readFileSync(file, 'utf8');
    for (const match of contents.matchAll(ROUTE_LITERAL)) {
      const id = match[1];
      const where = file.slice(SRC.length + 1);
      referenced.set(id, [...(referenced.get(id) ?? []), where]);
    }
  }

  it('finds the capture paths it is meant to be checking', () => {
    // A scan that silently matches nothing would pass every assertion below
    // while checking nothing at all.
    expect(referenced.size).toBeGreaterThan(3);
  });

  it('declares every route id used at a call site', () => {
    const declared = new Set(INTAKE_ROUTES.map((r) => r.id));
    const undeclared = [...referenced.entries()].filter(([id]) => !declared.has(id));

    expect(
      undeclared.map(([id, files]) => `${id} (used in ${files.join(', ')})`),
    ).toEqual([]);
  });

  it('resolves every referenced route to itself, not to the fallback', () => {
    // Catches the subtler version: an id that exists but is unreachable because
    // something shadows it or the lookup tables disagree.
    for (const id of referenced.keys()) {
      const resolved = resolveRoute(id);
      expect(resolved.id, `${id} resolved to ${resolved.id}`).toBe(id);
    }
  });
});

describe('registry integrity', () => {
  it('resolves every declared route by its own id', () => {
    for (const route of INTAKE_ROUTES) {
      expect(resolveRoute(route.id).id, route.id).toBe(route.id);
    }
  });

  it('resolves every declared alias to its owning route', () => {
    for (const route of INTAKE_ROUTES) {
      for (const alias of route.aliases ?? []) {
        expect(resolveRoute(alias).id, `${alias} -> ${route.id}`).toBe(route.id);
      }
    }
  });

  it('never lets an alias collide with a different route id', () => {
    const ids = new Set(INTAKE_ROUTES.map((r) => r.id));
    for (const route of INTAKE_ROUTES) {
      for (const alias of route.aliases ?? []) {
        if (ids.has(alias)) {
          expect(alias, `alias "${alias}" is also a route id`).toBe(route.id);
        }
      }
    }
  });

  it('keeps a fallback that is itself a declared route', () => {
    expect(INTAKE_ROUTES.some((r) => r.id === FALLBACK_ROUTE_ID)).toBe(true);
  });
});
