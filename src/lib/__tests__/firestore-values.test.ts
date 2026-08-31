import { describe, it, expect } from 'vitest';
import { FieldValue } from 'firebase-admin/firestore';
import { stripUndefined } from '../firestore-values';

/**
 * The Admin SDK is initialised without `ignoreUndefinedProperties`, so one
 * undefined value anywhere in a document makes the entire write throw. That is
 * the right default — a field undefined by accident should be loud — but it
 * means anything assembling a document from optional data has to omit absent
 * keys rather than set them.
 */
describe('stripUndefined', () => {
  it('omits an undefined key entirely rather than keeping it', () => {
    const result = stripUndefined({ id: 'step-1', brief: undefined });
    expect(Object.keys(result)).toEqual(['id']);
    expect('brief' in result).toBe(false);
  });

  it('keeps null, which Firestore stores and this codebase means by it', () => {
    // `sentAt: null` is "not sent yet" on every campaign document. Dropping it
    // would make an unsent campaign indistinguishable from one written by an
    // older version of the code.
    expect(stripUndefined({ sentAt: null })).toEqual({ sentAt: null });
  });

  it('reaches undefined nested inside an array of objects', () => {
    // The failing case from the weekly brief: the undefined was at
    // steps[1].brief, not at the top level of the document.
    const steps = [
      { id: 'step-0', type: 'wait', hours: 24 },
      { id: 'step-1', type: 'sendEmail', campaignId: 'c1', brief: undefined },
    ];
    expect(stripUndefined(steps)).toEqual([
      { id: 'step-0', type: 'wait', hours: 24 },
      { id: 'step-1', type: 'sendEmail', campaignId: 'c1' },
    ]);
  });

  it('reaches undefined nested inside a map', () => {
    const result = stripUndefined({ trigger: { type: 'manual', days: undefined, tag: 'winback' } });
    expect(result).toEqual({ trigger: { type: 'manual', tag: 'winback' } });
  });

  it('drops undefined elements from an array', () => {
    // Firestore rejects these too, and an absent element carries nothing worth
    // preserving a hole for.
    expect(stripUndefined([1, undefined, 2])).toEqual([1, 2]);
  });

  it('passes a FieldValue sentinel through by identity', () => {
    // The hazard in walking a document tree: serverTimestamp() is a class
    // instance the SDK recognises by identity, and rebuilding it as a plain
    // object would silently write an empty map where the timestamp should be.
    const sentinel = FieldValue.serverTimestamp();
    const result = stripUndefined({ createdAt: sentinel, name: 'Winback' });
    expect(result.createdAt).toBe(sentinel);
  });

  it('passes a Date through untouched', () => {
    const date = new Date('2026-08-31T00:00:00.000Z');
    expect(stripUndefined({ periodEnd: date }).periodEnd).toBe(date);
  });

  it('leaves a document with nothing undefined exactly as it was', () => {
    const doc = { name: 'Winback', steps: [{ id: 'step-0', hours: 24 }], stats: { entered: 0 } };
    expect(stripUndefined(doc)).toEqual(doc);
  });
});
