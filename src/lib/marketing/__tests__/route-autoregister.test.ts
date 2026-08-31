import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * What posture a funnel's route is given the first time it sends a lead.
 *
 * This is decided once, from one submission, and then shown in the console as
 * the account of how that funnel obtains consent. Getting it wrong is quiet:
 * nothing fails, the leads keep arriving, and the label simply describes a
 * different funnel than the one that exists.
 *
 * It mattered most for the double opt-in case. Such a funnel's first forward
 * carries `consent: false` — meaning "not yet", pending a clicked link — and
 * the inference read that as "never", registering the route as `none`. The
 * routes console excludes `none` routes from its warning about funnels no live
 * journey is acting on, reasonably, since such a route was never going to be
 * mailed. So a confirmed opt-in funnel was the one kind that could collect
 * mailable subscribers for months with nothing attached and no warning raised.
 */

const stored: Record<string, Record<string, unknown>> = {};

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => ({
    collection: () => ({
      count: () => ({ get: async () => ({ data: () => ({ count: Object.keys(stored).length }) }) }),
      get: async () => ({
        docs: Object.entries(stored).map(([id, data]) => ({ id, data: () => data })),
      }),
      doc: (id: string) => ({
        create: async (data: Record<string, unknown>) => {
          if (id in stored) throw new Error('ALREADY_EXISTS');
          stored[id] = data;
        },
      }),
    }),
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { log: () => {}, error: () => {}, warn: () => {} },
}));

const { resolveRouteFor, invalidateRouteCache } = await import('../route-store');

beforeEach(() => {
  for (const key of Object.keys(stored)) delete stored[key];
  invalidateRouteCache();
});

describe('a funnel that declares its consent posture', () => {
  // A slug the code registry has never heard of, which is the whole case this
  // covers: a funnel launched since the last deploy. Declared magnets like
  // athx_2027_guide resolve to their built-in route by alias and never reach
  // auto-registration at all.
  const NEW_FUNNEL = 'winter-2027-guide';

  it('registers a double opt-in funnel as confirmed, not none', async () => {
    // The regression. `consentGranted: false` is what a confirmed opt-in funnel
    // sends on capture, and inferring from it alone produced `none`.
    const route = await resolveRouteFor(NEW_FUNNEL, {
      consentGranted: false,
      consentPolicy: 'confirmed',
      property: 'website',
    });

    expect(route.id).toBe(NEW_FUNNEL);
    expect(route.consentPolicy).toBe('confirmed');
    expect(stored[NEW_FUNNEL].consentPolicy).toBe('confirmed');
  });

  it('keeps the declared posture even when the submission did carry consent', async () => {
    // The posture describes the funnel, not the moment. markLeadConfirmed
    // forwards `consent: true` for the same double opt-in funnel, and letting
    // that relabel the route would rewrite it as one that never asked twice.
    const route = await resolveRouteFor(NEW_FUNNEL, {
      consentGranted: true,
      consentPolicy: 'confirmed',
    });

    expect(route.consentPolicy).toBe('confirmed');
  });

  it('resolves a declared magnet by alias instead of registering it again', async () => {
    // athx_2027_guide is an alias of magnet-athx-guide in sources.ts. If that
    // alias were ever dropped, this funnel would start auto-registering under
    // its own slug and its leads would split across two routes.
    const route = await resolveRouteFor('athx_2027_guide', {
      consentGranted: false,
      consentPolicy: 'confirmed',
    });

    expect(route.id).toBe('magnet-athx-guide');
    expect(route.consentPolicy).toBe('confirmed');
    expect(Object.keys(stored)).toHaveLength(0);
  });

  it('records an explicit opt-in funnel as explicit', async () => {
    const route = await resolveRouteFor('newsletter-box', {
      consentGranted: true,
      consentPolicy: 'explicit',
    });
    expect(route.consentPolicy).toBe('explicit');
  });
});

describe('a funnel that declares nothing', () => {
  it('still infers implied from a consented capture', async () => {
    // Additive and optional: a funnel deployed before the field existed keeps
    // registering exactly as it did.
    const route = await resolveRouteFor('spring-promo', { consentGranted: true });
    expect(route.consentPolicy).toBe('implied');
  });

  it('still infers none from a capture that asserted nothing', async () => {
    const route = await resolveRouteFor('quiet-form', { consentGranted: false });
    expect(route.consentPolicy).toBe('none');
  });
});

describe('registration is still a one-time decision', () => {
  it('does not relabel a route that already exists', async () => {
    await resolveRouteFor('winter-2027-guide', {
      consentGranted: false,
      consentPolicy: 'confirmed',
    });
    invalidateRouteCache();

    // A later lead, even one declaring something else, must not overwrite what
    // an admin may have configured in between.
    const again = await resolveRouteFor('winter-2027-guide', {
      consentGranted: true,
      consentPolicy: 'implied',
    });

    expect(again.consentPolicy).toBe('confirmed');
  });

  it('files a malformed slug under the fallback rather than registering it', async () => {
    const route = await resolveRouteFor('Not A Slug', { consentPolicy: 'confirmed' });
    expect(route.id).toBe('website-other');
    expect(Object.keys(stored)).toHaveLength(0);
  });

  it('never registers when the caller asks only to look up', async () => {
    const route = await resolveRouteFor('unseen-funnel', { autoRegister: false });
    expect(route.id).toBe('website-other');
    expect(Object.keys(stored)).toHaveLength(0);
  });
});
