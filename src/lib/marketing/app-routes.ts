// src/lib/marketing/app-routes.ts
//
// The single list of app routes a marketing email may link to.
//
// This exists because two independent things need the same answer to "what
// pages does the app actually have": the drafting prompt, so the model links
// somewhere real instead of inventing a path, and the post-generation
// validator, so an invented path is caught even if the model ignores the
// prompt. A prompt and a validator built from separately-maintained lists is
// exactly the shape of bug that reappears every few months as the two drift —
// one file gets a new route added, the other does not — so there is one list
// here and both read from it.
//
// Kept to routes that make sense as an external destination someone clicks
// into from their inbox: no /admin, no /debug, nothing dev-only, nothing that
// assumes an in-progress session such as /workout/active. Source of truth for
// what exists at all is the folder names under src/app/(app)/ — `(app)` is a
// Next.js route group and contributes nothing to the URL itself.
//
// Update this file, not the prompt or the validator, when a page marketing
// should be able to link to is added or removed.

export const APP_MARKETING_PATHS = [
  '/dashboard',
  '/training',
  '/programs',
  '/calendar',
  '/journal',
  '/activity-feed',
  '/assistant',
  '/subscription',
  '/articles',
  '/profile',
  '/vdot',
] as const;

/** Path prefixes covering a dynamic segment, e.g. /programs/abc123/view. */
export const APP_MARKETING_PATH_PREFIXES = ['/programs/', '/articles/', '/journal/'] as const;

export function isKnownAppPath(pathname: string): boolean {
  const trimmed = pathname.replace(/\/$/, '') || '/';
  if ((APP_MARKETING_PATHS as readonly string[]).includes(trimmed)) return true;
  return APP_MARKETING_PATH_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}
