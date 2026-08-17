import { describe, it, expect } from 'vitest';
import { interpretBrevoEvent, isActionableEvent } from '../webhook-events';

describe('interpretBrevoEvent', () => {
  describe('permanent failures suppress the address', () => {
    it('suppresses on a hard bounce', () => {
      const outcome = interpretBrevoEvent('hard_bounce');
      expect(outcome.status).toBe('bounced');
      expect(outcome.markSendFailed).toBe(true);
    });

    it('suppresses on an invalid address', () => {
      expect(interpretBrevoEvent('invalid_email').status).toBe('bounced');
    });

    it('suppresses when the receiving server blocks us', () => {
      // Continuing to mail an address that refuses us is what damages a
      // sender's standing.
      expect(interpretBrevoEvent('blocked').status).toBe('bounced');
    });
  });

  describe('transient failures leave the subscriber alone', () => {
    it('ignores a soft bounce', () => {
      // A full mailbox is a statement about a moment, not the address.
      // Suppressing here would steadily delete real subscribers.
      const outcome = interpretBrevoEvent('soft_bounce');
      expect(outcome.status).toBeNull();
      expect(outcome.markSendFailed).toBe(false);
    });

    it('ignores a deferral', () => {
      expect(interpretBrevoEvent('deferred').status).toBeNull();
    });
  });

  describe('complaints', () => {
    it('marks a spam report as complained', () => {
      expect(interpretBrevoEvent('spam').status).toBe('complained');
      expect(interpretBrevoEvent('complaint').status).toBe('complained');
    });

    it('does not mark the send failed — it arrived, they just did not want it', () => {
      expect(interpretBrevoEvent('spam').markSendFailed).toBe(false);
    });
  });

  it('honours an unsubscribe made through the provider', () => {
    expect(interpretBrevoEvent('unsubscribed').status).toBe('unsubscribed');
  });

  describe('non-actionable events', () => {
    it('takes no action on delivery or engagement events', () => {
      // Opens and clicks come through our own signed endpoints, which filter
      // bots; counting Brevo's as well would double-count.
      for (const event of ['delivered', 'opened', 'click', 'request']) {
        const outcome = interpretBrevoEvent(event);
        expect(outcome.status, event).toBeNull();
        expect(outcome.markSendFailed, event).toBe(false);
      }
    });

    it('takes no action on an event name it does not know', () => {
      const outcome = interpretBrevoEvent('some_future_event');
      expect(outcome.status).toBeNull();
      expect(outcome.markSendFailed).toBe(false);
    });

    it('handles an empty event name without throwing', () => {
      expect(interpretBrevoEvent('').status).toBeNull();
    });
  });

  it('always explains itself, so a suppression can be traced', () => {
    expect(interpretBrevoEvent('hard_bounce').reason).toMatch(/bounce/i);
    expect(interpretBrevoEvent('spam').reason).toMatch(/spam/i);
  });
});

describe('isActionableEvent', () => {
  it('is true only for events that need a write', () => {
    for (const event of ['hard_bounce', 'invalid_email', 'blocked', 'spam', 'unsubscribed']) {
      expect(isActionableEvent(event), event).toBe(true);
    }
  });

  it('is false for the noisy majority', () => {
    for (const event of ['delivered', 'opened', 'click', 'soft_bounce', 'deferred', 'request']) {
      expect(isActionableEvent(event), event).toBe(false);
    }
  });
});
