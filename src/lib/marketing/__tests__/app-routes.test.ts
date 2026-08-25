import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { APP_MARKETING_PATHS, defaultCtaUrl, isKnownAppPath } from '@/lib/marketing/app-routes';

describe('isKnownAppPath', () => {
  it('accepts every listed path', () => {
    for (const path of APP_MARKETING_PATHS) {
      expect(isKnownAppPath(path)).toBe(true);
    }
  });

  it('accepts a trailing slash', () => {
    expect(isKnownAppPath('/dashboard/')).toBe(true);
  });

  it('accepts a dynamic segment under an allowed prefix', () => {
    expect(isKnownAppPath('/programs/abc123/view')).toBe(true);
    expect(isKnownAppPath('/articles/how-to-hyrox')).toBe(true);
  });

  it('rejects an invented path — the bug this exists to catch', () => {
    expect(isKnownAppPath('/join')).toBe(false);
    expect(isKnownAppPath('/training-plan')).toBe(false);
    expect(isKnownAppPath('/get-started')).toBe(false);
  });

  it('rejects admin and debug routes, even though they really exist', () => {
    // Real pages, wrong audience — a marketing email should never reach here.
    expect(isKnownAppPath('/admin')).toBe(false);
    expect(isKnownAppPath('/admin/marketing/studio')).toBe(false);
    expect(isKnownAppPath('/debug')).toBe(false);
  });

  it('accepts the bare root — the CTA default, not an oversight', () => {
    // `/` lives outside the (app) route group (src/app/page.tsx, not
    // src/app/(app)/), so it needs its own case here and its own check below
    // that the file backing it still exists.
    expect(isKnownAppPath('/')).toBe(true);
  });
});

describe('APP_MARKETING_PATHS stays in sync with the routes that actually exist', () => {
  // Walks src/app/(app)/ the same way the comment in app-routes.ts asks a
  // human to check by hand, so drift is a test failure instead of a 404 a
  // reader finds first. A path here failing this test does not mean the list
  // is wrong — it means a route was renamed or removed and the list was not
  // updated to match, or vice versa for a newly added one worth including.
  const appDir = join(process.cwd(), 'src/app/(app)');

  function realRoutes(dir: string, prefix = ''): string[] {
    const routes: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      const segment = entry.startsWith('[') ? null : entry; // dynamic segment
      const nextPrefix = segment ? `${prefix}/${segment}` : `${prefix}/*`;
      if (readdirSync(full).includes('page.tsx')) routes.push(nextPrefix);
      routes.push(...realRoutes(full, nextPrefix));
    }
    return routes;
  }

  const allReal = readFileSync(join(process.cwd(), 'src/lib/marketing/app-routes.ts'), 'utf8').includes(
    'APP_MARKETING_PATHS',
  )
    ? realRoutes(appDir)
    : [];

  it('lists only paths that correspond to a real page', () => {
    for (const path of APP_MARKETING_PATHS) {
      if (path === '/') continue; // outside (app)/, checked separately below
      const hasExactPage = allReal.includes(path);
      expect(hasExactPage, `${path} is in APP_MARKETING_PATHS but has no page.tsx under src/app/(app)/`).toBe(
        true,
      );
    }
  });

  it('the root path has a page backing it too, just outside the (app) group', () => {
    const rootPage = join(process.cwd(), 'src/app/page.tsx');
    expect(statSync(rootPage).isFile(), 'src/app/page.tsx is missing — "/" in APP_MARKETING_PATHS is stale').toBe(
      true,
    );
  });
});

describe('defaultCtaUrl', () => {
  const ORIGINAL = process.env.NEXT_PUBLIC_APP_URL;
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = ORIGINAL;
  });

  it('falls back to the production URL when unset', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(defaultCtaUrl()).toBe('https://app.hybridx.club');
  });

  it('uses NEXT_PUBLIC_APP_URL when set — so a preview deploy never links to production', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.hybridx.club';
    expect(defaultCtaUrl()).toBe('https://staging.hybridx.club');
  });

  it('strips a trailing slash', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://staging.hybridx.club/';
    expect(defaultCtaUrl()).toBe('https://staging.hybridx.club');
  });

  it('is itself a known app path — the default cannot fail its own check', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const url = new URL(defaultCtaUrl());
    expect(isKnownAppPath(url.pathname)).toBe(true);
  });
});
