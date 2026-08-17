import { describe, it, expect } from 'vitest';
import { deriveTags, mergeTags } from '../sync';
import type { User } from '@/models/types';

function athlete(over: Partial<User> = {}): User {
  return {
    id: 'u1',
    email: 'a@b.com',
    firstName: 'A',
    lastName: 'B',
    experience: 'intermediate',
    frequency: '4',
    goal: 'hybrid',
    ...over,
  };
}

describe('deriveTags', () => {
  it('tags the dimensions a campaign segments on', () => {
    const tags = deriveTags(athlete({ subscriptionStatus: 'trial', programId: 'p1', platform: 'ios' }));
    expect(tags).toEqual(
      expect.arrayContaining([
        'athlete',
        'experience:intermediate',
        'goal:hybrid',
        'frequency:4',
        'sub:trial',
        'program:p1',
        'platform:ios',
      ]),
    );
  });

  it('bands engagement rather than emitting a raw count', () => {
    expect(deriveTags(athlete({ completedWorkouts: 0 }))).toContain('engagement:none');
    expect(deriveTags(athlete({ completedWorkouts: 3 }))).toContain('engagement:starting');
    expect(deriveTags(athlete({ completedWorkouts: 12 }))).toContain('engagement:regular');
    expect(deriveTags(athlete({ completedWorkouts: 80 }))).toContain('engagement:committed');
  });

  it('treats a missing workout count as never having trained', () => {
    expect(deriveTags(athlete())).toContain('engagement:none');
  });

  it('flags connected integrations', () => {
    const tags = deriveTags(athlete({
      strava: {} as User['strava'],
      garmin: {} as User['garmin'],
    }));
    expect(tags).toContain('integration:strava');
    expect(tags).toContain('integration:garmin');
  });

  it('omits dimensions the athlete has no value for', () => {
    const tags = deriveTags(athlete());
    expect(tags.some((t) => t.startsWith('sub:'))).toBe(false);
    expect(tags.some((t) => t.startsWith('program:'))).toBe(false);
    expect(tags).not.toContain('integration:strava');
  });
});

describe('mergeTags', () => {
  it('preserves hand-applied tags', () => {
    expect(mergeTags(['vip', 'beta-tester'], ['athlete', 'sub:active']))
      .toEqual(expect.arrayContaining(['vip', 'beta-tester', 'athlete', 'sub:active']));
  });

  it('replaces a stale derived tag rather than accumulating both', () => {
    // The upgrade case: an athlete moves off trial and must stop matching
    // trial campaigns.
    const merged = mergeTags(['sub:trial', 'vip'], ['athlete', 'sub:active']);
    expect(merged).toContain('sub:active');
    expect(merged).not.toContain('sub:trial');
    expect(merged).toContain('vip');
  });

  it('drops every owned dimension that is no longer derived', () => {
    // Athlete disconnects Strava: the integration tag must go.
    const merged = mergeTags(['integration:strava', 'athlete'], ['athlete', 'goal:hybrid']);
    expect(merged).not.toContain('integration:strava');
  });

  it('does not duplicate a tag that is both existing and derived', () => {
    const merged = mergeTags(['athlete', 'sub:active'], ['athlete', 'sub:active']);
    expect(merged.filter((t) => t === 'sub:active')).toHaveLength(1);
    expect(merged.filter((t) => t === 'athlete')).toHaveLength(1);
  });

  it('handles an empty or absent existing list', () => {
    expect(mergeTags([], ['athlete'])).toEqual(['athlete']);
    expect(mergeTags(undefined as never, ['athlete'])).toEqual(['athlete']);
  });
});
