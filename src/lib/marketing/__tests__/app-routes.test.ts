import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { APP_MARKETING_PATHS, isKnownAppPath } from '@/lib/marketing/app-routes';

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

  it('treats the bare root as unknown', () => {
    expect(isKnownAppPath('/')).toBe(false);
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
      const hasExactPage = allReal.includes(path);
      expect(hasExactPage, `${path} is in APP_MARKETING_PATHS but has no page.tsx under src/app/(app)/`).toBe(
        true,
      );
    }
  });
});
