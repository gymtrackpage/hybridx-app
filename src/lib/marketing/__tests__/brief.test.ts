import { describe, it, expect } from 'vitest';
import { deriveObservations, type WeeklyBrief } from '../brief';

function brief(over: Partial<WeeklyBrief> = {}): WeeklyBrief {
  return {
    periodStart: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    periodEnd: new Date().toISOString(),
    hasComparison: true,
    list: {
      mailable: 1000,
      mailableChange: 25,
      newThisWeek: 40,
      unsubscribedThisWeek: 5,
      bouncedThisWeek: 2,
      complainedThisWeek: 0,
    },
    sending: {
      campaignsSent: 2,
      emailsDelivered: 2000,
      averageOpenRate: 0.32,
      averageClickRate: 0.06,
      openRateChange: 0.01,
    },
    journeys: { live: 3, activeRuns: 120, completedThisWeek: 45, stuckThisWeek: 0 },
    campaigns: [],
    observations: [],
    ...over,
  };
}

const findsNote = (b: WeeklyBrief, fragment: string) =>
  deriveObservations(b).some((n) => n.toLowerCase().includes(fragment.toLowerCase()));

describe('deriveObservations', () => {
  it('says nothing is unusual when nothing is', () => {
    expect(deriveObservations(brief())).toEqual(['Nothing unusual in the numbers this week.']);
  });

  describe('complaints', () => {
    it('flags any spam complaint at all', () => {
      // Complaints damage delivery for the whole list, so even one is worth
      // surfacing — unlike unsubscribes, which are healthy in small numbers.
      expect(findsNote(brief({ list: { ...brief().list, complainedThisWeek: 1 } }), 'complaint')).toBe(true);
    });

    it('reads naturally for a single complaint', () => {
      const notes = deriveObservations(brief({ list: { ...brief().list, complainedThisWeek: 1 } }));
      expect(notes.some((n) => n.includes('1 spam complaint this week'))).toBe(true);
    });

    it('pluralises correctly', () => {
      const notes = deriveObservations(brief({ list: { ...brief().list, complainedThisWeek: 3 } }));
      expect(notes.some((n) => n.includes('3 spam complaints'))).toBe(true);
    });
  });

  describe('unsubscribe rate', () => {
    it('flags an unsubscribe rate above half a percent of volume', () => {
      const b = brief({
        list: { ...brief().list, unsubscribedThisWeek: 20 },
        sending: { ...brief().sending, emailsDelivered: 1000 }, // 2%
      });
      expect(findsNote(b, 'unsubscribe rate')).toBe(true);
    });

    it('stays quiet at a healthy rate', () => {
      const b = brief({
        list: { ...brief().list, unsubscribedThisWeek: 2 },
        sending: { ...brief().sending, emailsDelivered: 2000 }, // 0.1%
      });
      expect(findsNote(b, 'unsubscribe rate')).toBe(false);
    });

    it('does not divide by zero when nothing was sent', () => {
      const b = brief({
        list: { ...brief().list, unsubscribedThisWeek: 5 },
        sending: { ...brief().sending, campaignsSent: 0, emailsDelivered: 0 },
      });
      expect(() => deriveObservations(b)).not.toThrow();
      expect(findsNote(b, 'unsubscribe rate')).toBe(false);
    });
  });

  it('flags a bounce spike, which usually means an imported list', () => {
    expect(findsNote(brief({ list: { ...brief().list, bouncedThisWeek: 40 } }), 'bounced')).toBe(true);
  });

  describe('open rate', () => {
    it('flags a low absolute open rate', () => {
      const b = brief({ sending: { ...brief().sending, averageOpenRate: 0.08 } });
      expect(findsNote(b, 'low')).toBe(true);
    });

    it('flags a meaningful move in either direction', () => {
      expect(findsNote(brief({ sending: { ...brief().sending, openRateChange: 0.09 } }), 'up')).toBe(true);
      expect(findsNote(brief({ sending: { ...brief().sending, openRateChange: -0.09 } }), 'down')).toBe(true);
    });

    it('ignores noise', () => {
      const b = brief({ sending: { ...brief().sending, openRateChange: 0.01 } });
      expect(findsNote(b, 'points')).toBe(false);
    });

    it('says nothing about a change on the first brief', () => {
      const b = brief({
        hasComparison: false,
        sending: { ...brief().sending, openRateChange: null },
      });
      expect(findsNote(b, 'points')).toBe(false);
    });
  });

  it('reports journey runs that stopped with an error', () => {
    const b = brief({ journeys: { ...brief().journeys, stuckThisWeek: 4 } });
    expect(findsNote(b, 'stopped with an error')).toBe(true);
  });

  it('says nothing about stuck runs when none failed', () => {
    // The default fixture is a healthy week. A health signal that fires on a
    // clean week is one people learn to skim past.
    expect(findsNote(brief(), 'stopped with an error')).toBe(false);
  });

  it('leads with a stuck automation rather than a soft metric', () => {
    // A broken machine outranks an open rate that drifted; the ordering is the
    // whole point of putting this check first.
    const b = brief({
      journeys: { ...brief().journeys, stuckThisWeek: 2 },
      sending: { ...brief().sending, averageOpenRate: 0.05 },
    });
    expect(deriveObservations(b)[0]).toContain('stopped with an error');
  });

  it('notices the list going cold', () => {
    const b = brief({
      sending: { ...brief().sending, campaignsSent: 0, emailsDelivered: 0, averageOpenRate: null },
      journeys: { live: 0, activeRuns: 0, completedThisWeek: 0, stuckThisWeek: 0 },
    });
    expect(findsNote(b, 'going cold')).toBe(true);
  });

  it('notices the list shrinking', () => {
    expect(findsNote(brief({ list: { ...brief().list, mailableChange: -30 } }), 'shrank')).toBe(true);
  });

  it('reports several problems at once rather than only the first', () => {
    const b = brief({
      list: { ...brief().list, complainedThisWeek: 2, bouncedThisWeek: 50, mailableChange: -40 },
      sending: { ...brief().sending, averageOpenRate: 0.05 },
    });
    expect(deriveObservations(b).length).toBeGreaterThanOrEqual(4);
  });

  it('never returns an empty list, so the brief always has something to say', () => {
    expect(deriveObservations(brief()).length).toBeGreaterThan(0);
  });
});
