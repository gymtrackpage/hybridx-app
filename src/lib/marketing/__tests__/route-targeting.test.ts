import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { describeAudience } from '../segments';
import { validateJourney } from '../journeys';
import type { Journey } from '../journeys';

/**
 * Aiming a campaign at one funnel's cohort.
 *
 * The chain is long and every link fails quietly: the planner has to be able to
 * express a route, the studio has to carry it into Firestore, validation has to
 * reject the combinations that do nothing, and the review screen has to say who
 * will be reached. A break anywhere shows up as a campaign that sends to the
 * wrong list, never as an error.
 */

const repo = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

describe('the planner can express a route', () => {
  const composer = repo('src/ai/flows/marketing/compose-journey.ts');

  it('offers route on the trigger it returns', () => {
    // Without this the commonest request the studio receives — "welcome the
    // people who took the guide" — has no representation in the plan at all.
    expect(composer).toMatch(/trigger:\s*z\.object\(\{[\s\S]*?route:\s*z\s*\n?\s*\.string\(\)/);
  });

  it('tells the planner to set the trigger and the audience together', () => {
    expect(composer).toContain('trigger.route');
    expect(composer).toContain('audience.anyTags');
  });
});

describe('the studio carries the route through to Firestore', () => {
  const studio = repo('src/components/marketing/campaign-studio.tsx');

  it('passes trigger.route into saveJourney', () => {
    // The regression this file exists for: the planner chose a route, the
    // studio showed the narrowed audience, and the field was dropped on save.
    const call = /saveJourney\(\{[\s\S]*?\}\);/.exec(studio)?.[0] ?? '';
    expect(call).toContain('route: plan.trigger.route');
  });
});

describe('the planner is told which funnels exist', () => {
  const knowledge = repo('src/lib/marketing/knowledge.ts');

  it('puts the live intake routes in the prompt block', () => {
    // A route id the model has never seen is a route it cannot choose, so it
    // would fall back to mailing everybody.
    expect(knowledge).toContain('intakeRoutes');
    expect(knowledge).toContain('${routeLines}');
  });

  it('reads them from the store, not the code registry', () => {
    // Routes are data precisely so a funnel launched on Thursday is targetable
    // on Thursday. Reading INTAKE_ROUTES here would put the deploy back.
    expect(knowledge).toContain('listRoutes');
  });
});

describe('validateJourney on route narrowing', () => {
  const base = {
    name: 'Welcome',
    steps: [{ id: 'step-0', type: 'sendEmail', campaignId: 'c1' }],
  } as unknown as Pick<Journey, 'steps' | 'trigger' | 'name'>;

  it('accepts a route on an event trigger', () => {
    const problems = validateJourney({
      ...base,
      trigger: { type: 'consentGranted', route: 'magnet-athx-guide' },
    });
    expect(problems).toEqual([]);
  });

  it('rejects a route on a manual broadcast, which would silently ignore it', () => {
    // Nobody enters a manual journey from an event, so triggerMatchesEvent
    // never runs and the narrowing does nothing — while the review screen
    // reads "only people who arrived by...". Worse than no narrowing at all.
    const problems = validateJourney({
      ...base,
      trigger: { type: 'manual', route: 'magnet-athx-guide' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('cannot be narrowed to a route');
  });

  it('rejects a route on a derived trigger for the same reason', () => {
    const problems = validateJourney({
      ...base,
      trigger: { type: 'trialEndingSoon', days: 3, route: 'magnet-athx-guide' },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('cannot be narrowed to a route');
  });

  it('leaves an un-narrowed journey alone', () => {
    expect(validateJourney({ ...base, trigger: { type: 'manual' } })).toEqual([]);
  });
});

describe('describeAudience', () => {
  it('says plainly when a journey reaches everybody', () => {
    expect(describeAudience(undefined)).toBe('Everyone who may be emailed.');
    expect(describeAudience({})).toBe('Everyone who may be emailed.');
  });

  it('names the tags a funnel campaign is narrowed to', () => {
    expect(describeAudience({ allTags: ['route:magnet-athx-guide'] })).toBe(
      'Everyone who may be emailed and is tagged all of route:magnet-athx-guide.',
    );
  });

  it('reports exclusions, which are the easiest thing to overlook before a send', () => {
    expect(describeAudience({ noneTags: ['bought:athx-2027'] })).toContain(
      'not tagged bought:athx-2027',
    );
  });

  it('describes athlete predicates rather than omitting them', () => {
    // A description that silently dropped a predicate would read as a complete
    // account of who is about to be mailed, which is the dangerous kind of wrong.
    const text = describeAudience({
      anyTags: ['source:app'],
      athlete: { subscriptionStatus: ['trial'], inactiveForDays: 14, hasAccount: true },
    });
    expect(text).toContain('tagged any of source:app');
    expect(text).toContain('with a HYBRIDX account');
    expect(text).toContain('subscription trial');
    expect(text).toContain('inactive for 14+ days');
  });

  it('covers every filter SegmentDefinition offers', () => {
    // Guards the omission this function is most likely to acquire: a new
    // predicate added to the type and not to the sentence.
    const text = describeAudience({
      anyTags: ['a'],
      allTags: ['b'],
      noneTags: ['c'],
      athlete: {
        subscriptionStatus: ['active'],
        experience: ['beginner'],
        goal: ['hybrid'],
        programId: 'p1',
        minCompletedWorkouts: 1,
        maxCompletedWorkouts: 9,
        inactiveForDays: 30,
        hasAccount: true,
      },
    });
    for (const fragment of [
      'any of a',
      'all of b',
      'not tagged c',
      'subscription active',
      'experience beginner',
      'goal hybrid',
      'programme p1',
      'at least 1',
      'at most 9',
      'inactive for 30+ days',
      'with a HYBRIDX account',
    ]) {
      expect(text, fragment).toContain(fragment);
    }
  });
});
