// src/lib/marketing/route-store.ts
//
// Runtime intake routes.
//
// sources.ts declares the routes that ship with the code. That is the right
// home for the ones the application itself depends on — the account signup, the
// admin importer — because they are referenced by id in code and should be
// typed and tested.
//
// It is the wrong home for marketing funnels. A promotion is launched on a
// Thursday afternoon; a code registry means a deploy in two repositories before
// the first lead can be nurtured, and until then everyone who signs up lands in
// an unclassified bucket that no journey targets. The registry becomes the
// bottleneck on the thing it exists to serve.
//
// So routes are data. This module keeps a Firestore collection that overlays
// the built-in registry:
//
//   - An unknown slug arriving from a funnel is *auto-registered* rather than
//     discarded, so a new promotion works the moment its page is live.
//   - It lands as `unconfigured`, which is a visible state in the console
//     rather than a silent default — the prompt to give it a label, tags and a
//     welcome journey.
//   - Built-ins are seeded in and can be relabelled, but never deleted: code
//     refers to them by id.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { logger } from '@/lib/logger';
import {
  FALLBACK_ROUTE_ID,
  INTAKE_ROUTES,
  type ConsentPolicy,
  type IntakeProperty,
  type IntakeRoute,
} from './sources';

export const MARKETING_ROUTES = 'marketingRoutes';

/**
 * Whether a route has been given a considered configuration, or is merely the
 * record of a slug that showed up. Kept as a state rather than inferred from a
 * missing label, so "nobody has looked at this yet" survives someone typing a
 * label and nothing else.
 */
export type RouteStatus = 'active' | 'unconfigured' | 'archived';

export interface StoredRoute extends IntakeRoute {
  status: RouteStatus;
  /** True for routes declared in sources.ts. They may be edited, never deleted. */
  builtIn: boolean;
  /** Where this slug was first seen, for an auto-registered route. */
  firstSeenFrom?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * Slugs must look like slugs. This is the only validation between a funnel form
 * and a permanent collection, so it is strict: an unbounded slug space would
 * let a misconfigured page — or a compromised one — fill the collection with
 * junk that then has to be cleaned out by hand.
 */
const SLUG = /^[a-z0-9][a-z0-9_-]{1,48}$/;

export function isValidRouteSlug(slug: string): boolean {
  return SLUG.test(slug);
}

/**
 * Ceiling on auto-registered routes. Reached only by a bug or an attack — a
 * business does not run two hundred simultaneous funnels — so hitting it means
 * stop creating and start alerting, not silently keep going.
 */
const MAX_AUTO_ROUTES = 200;

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Routes are read on every capture and change perhaps weekly, so they are
 * cached in process. The window is short enough that a console edit appears
 * almost immediately, and long enough that a burst of signups does not become a
 * burst of reads.
 */
const CACHE_TTL_MS = 60_000;

let cache: { at: number; routes: Map<string, StoredRoute> } | null = null;

/** Drop the cache. Called after any write, and by tests. */
export function invalidateRouteCache(): void {
  cache = null;
}

function builtInAsStored(route: IntakeRoute): StoredRoute {
  return { ...route, status: 'active', builtIn: true };
}

/**
 * Every route, stored merged over built-in.
 *
 * Built-ins are the base layer so a route referenced in code always resolves,
 * even before the collection has been seeded — a fresh environment must not
 * need a migration before it can capture a lead.
 */
export async function getAllRoutes(): Promise<Map<string, StoredRoute>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.routes;

  const merged = new Map<string, StoredRoute>();
  for (const route of INTAKE_ROUTES) merged.set(route.id, builtInAsStored(route));

  try {
    const snap = await getAdminDb().collection(MARKETING_ROUTES).get();
    for (const doc of snap.docs) {
      const data = doc.data() as Partial<StoredRoute>;
      const base = merged.get(doc.id);

      merged.set(doc.id, {
        // A stored document wins field by field, so an admin can relabel a
        // built-in without the code's other fields being lost.
        ...(base ?? {}),
        ...data,
        id: doc.id,
        builtIn: base?.builtIn ?? false,
        status: data.status ?? 'active',
      } as StoredRoute);
    }
  } catch (err) {
    // Fall back to built-ins rather than failing the capture. A route lookup
    // that throws would cost the lead; one that returns a stale answer costs a
    // tag, and the auto-register on the next pass corrects it.
    logger.error(
      '[marketing/routes] could not read stored routes, using built-ins:',
      err instanceof Error ? err.message : String(err),
    );
  }

  cache = { at: Date.now(), routes: merged };
  return merged;
}

/** Every route as a list, built-ins first, then alphabetically. */
export async function listRoutes(): Promise<StoredRoute[]> {
  const all = [...(await getAllRoutes()).values()];
  return all.sort((a, b) => {
    if (a.builtIn !== b.builtIn) return a.builtIn ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export interface ResolveOptions {
  /** Which surface the identifier arrived from, recorded on an auto-registration. */
  property?: IntakeProperty;
  /** What the caller asserted about consent, used as the new route's posture. */
  consentGranted?: boolean;
  /** Free-text note about the caller, for the console. */
  seenFrom?: string;
  /** Set false to look up without ever creating. Used by read-only callers. */
  autoRegister?: boolean;
}

/**
 * Resolve an incoming identifier to a route, registering it if it is new.
 *
 * This is what makes a new funnel work without a deploy. The marketing site
 * posts whatever slug its page carries; if the registry has never seen it, a
 * route is created on the spot so the lead is tagged correctly and coherently
 * from the very first submission — rather than being swept into a shared
 * fallback bucket whose tags say nothing about where the person came from.
 */
export async function resolveRouteFor(
  identifier: string | undefined | null,
  options: ResolveOptions = {},
): Promise<StoredRoute> {
  const slug = (identifier ?? '').trim();
  const routes = await getAllRoutes();

  const direct = routes.get(slug);
  if (direct && direct.status !== 'archived') return direct;

  // Aliases let the marketing site keep its own vocabulary for the funnels that
  // predate slugs, e.g. `build_a_bigger_engine`.
  for (const route of routes.values()) {
    if (route.status === 'archived') continue;
    if (route.aliases?.includes(slug)) return route;
  }

  const fallback = routes.get(FALLBACK_ROUTE_ID)!;

  if (!slug || options.autoRegister === false) return fallback;

  // An unusable slug is not worth a permanent document, but the lead behind it
  // still is — hence the fallback rather than a throw.
  if (!isValidRouteSlug(slug)) {
    logger.error(`[marketing/routes] refusing to register malformed slug "${slug}"`);
    return fallback;
  }

  const created = await autoRegister(slug, options);
  return created ?? fallback;
}

/**
 * Create a route for a slug seen for the first time.
 *
 * Deliberately `create()`, not `set()`: two simultaneous first submissions on a
 * new funnel would otherwise race, and the loser would overwrite the winner's
 * document — resetting a route an admin might already have configured in the
 * seconds between.
 */
async function autoRegister(
  slug: string,
  options: ResolveOptions,
): Promise<StoredRoute | null> {
  const db = getAdminDb();

  try {
    const existing = await db.collection(MARKETING_ROUTES).count().get();
    if (existing.data().count >= MAX_AUTO_ROUTES) {
      logger.error(
        `[marketing/routes] route ceiling (${MAX_AUTO_ROUTES}) reached; not registering "${slug}"`,
      );
      return null;
    }

    const property: IntakeProperty = options.property ?? 'website';

    // The posture the caller asserted, not a guess. A funnel that says its form
    // promised ongoing email is recorded as `implied`; one that says nothing
    // grants nothing until someone configures it.
    const consentPolicy: ConsentPolicy = options.consentGranted ? 'implied' : 'none';

    const route: StoredRoute = {
      id: slug,
      label: humanise(slug),
      description:
        'Registered automatically the first time this funnel sent a lead. ' +
        'Give it a label, tags and a welcome journey.',
      property,
      source: 'landing',
      consentPolicy,
      tags: [`source:${property === 'website' ? 'website' : property}`],
      status: 'unconfigured',
      builtIn: false,
      ...(options.seenFrom ? { firstSeenFrom: options.seenFrom } : {}),
    };

    await db
      .collection(MARKETING_ROUTES)
      .doc(slug)
      .create({
        ...route,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    invalidateRouteCache();
    logger.log(`[marketing/routes] auto-registered new funnel route "${slug}"`);
    return route;
  } catch (err) {
    // A create() that lost a race means the route now exists, which is the
    // outcome we wanted — re-read rather than treating it as a failure.
    const routes = await getAllRoutes();
    const raced = routes.get(slug);
    if (raced) return raced;

    logger.error(
      `[marketing/routes] could not register "${slug}":`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

/** `spring-hyrox-challenge` -> `Spring hyrox challenge`. A starting point, not a final label. */
export function humanise(slug: string): string {
  const words = slug.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export type RoutePatch = Partial<
  Pick<StoredRoute, 'label' | 'description' | 'property' | 'consentPolicy' | 'tags' | 'status'>
>;

/**
 * Update a route's configuration.
 *
 * Editing is how an auto-registered route becomes a real one — which is why
 * saving any change also clears `unconfigured`, unless the caller is explicitly
 * setting the status itself.
 */
export async function updateRoute(id: string, patch: RoutePatch): Promise<void> {
  const routes = await getAllRoutes();
  if (!routes.has(id)) throw new Error(`No such route: ${id}`);

  const clean: RoutePatch = { ...patch };
  if (clean.tags) {
    clean.tags = Array.from(
      new Set(clean.tags.map((t) => t.trim()).filter((t) => t && !t.startsWith('route:'))),
    ).slice(0, 12);
  }

  await getAdminDb()
    .collection(MARKETING_ROUTES)
    .doc(id)
    .set(
      {
        ...clean,
        ...(patch.status ? {} : { status: 'active' }),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  invalidateRouteCache();
}

/**
 * Stop a route matching, without deleting the record.
 *
 * Archiving rather than deleting keeps the subscribers who arrived by it
 * interpretable: their `route` field still points somewhere, and the console
 * can still say what it meant. A built-in cannot be archived, because code
 * refers to it by id.
 */
export async function archiveRoute(id: string): Promise<void> {
  const routes = await getAllRoutes();
  const route = routes.get(id);
  if (!route) throw new Error(`No such route: ${id}`);
  if (route.builtIn) throw new Error('Built-in routes cannot be archived.');

  await updateRoute(id, { status: 'archived' });
}

/**
 * Write the built-in registry into Firestore so the console can list and edit
 * routes uniformly. Idempotent, and never overwrites an existing document —
 * a relabelled built-in stays relabelled across deploys.
 */
export async function seedBuiltInRoutes(): Promise<{ created: number }> {
  const db = getAdminDb();
  const writer = db.bulkWriter();
  let created = 0;

  const snap = await db.collection(MARKETING_ROUTES).get();
  const present = new Set(snap.docs.map((d) => d.id));

  for (const route of INTAKE_ROUTES) {
    if (present.has(route.id)) continue;
    writer.create(db.collection(MARKETING_ROUTES).doc(route.id), {
      ...route,
      status: 'active',
      builtIn: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    created++;
  }

  await writer.close();
  invalidateRouteCache();
  return { created };
}
