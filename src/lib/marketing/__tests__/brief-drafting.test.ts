import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

/**
 * The weekly brief drafts each proposal into a draft journey unattended.
 *
 * Everything it writes comes from a model working to a schema where nearly
 * every useful field is optional, and the Admin SDK is initialised without
 * `ignoreUndefinedProperties` — so a field the planner simply did not return
 * fails the whole document write. That surfaced in the first live brief as
 * "Cannot use undefined as a Firestore value (found in field steps.`1`.brief)":
 * a plan whose second step had no brief of its own, drafted fine and then lost
 * at the last step, reaching the admin as an error beside a prompt that worked
 * perfectly well when pasted into the studio.
 */

const repo = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the weekly brief writes documents Firestore will accept', () => {
  const route = repo('src/app/api/cron/marketing-brief/route.ts');

  it('resolves a missing step brief instead of storing undefined', () => {
    // Not merely defaulted at the point of drafting: the brief stored on the
    // step has to be the one the copy was written from, or regenerating the
    // email later produces something else entirely.
    expect(route).toMatch(/const brief = step\.brief\?\.trim\(\) \|\| plan\.goal;/);
    expect(route).toContain("steps.push({ id: stepId, type: 'sendEmail', campaignId: campaignRef.id, brief });");
  });

  it('strips undefined from both documents it writes', () => {
    // The journey document is the one that failed, but the campaign document
    // is assembled from the same model output and would fail the same way.
    expect(route).toContain('await campaignRef.set(stripUndefined({');
    expect(route).toContain('await journeyRef.set(stripUndefined({');
  });
});

describe('the studio saves journeys the same way', () => {
  const studio = repo('src/lib/marketing/studio-actions.ts');

  it('strips undefined from both documents it writes', () => {
    // saveJourney carries the same optional brief, and its audience and
    // trigger carry optional fields of their own.
    expect(studio).toContain('await campaignRef.set(stripUndefined({');
    expect(studio).toContain('await journeyRef.set(stripUndefined({');
  });
});
