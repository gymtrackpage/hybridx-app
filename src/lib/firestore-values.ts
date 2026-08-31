// src/lib/firestore-values.ts
//
// Strip `undefined` out of a value on its way into Firestore.
//
// The Admin SDK is deliberately initialised without `ignoreUndefinedProperties`
// (see src/lib/firebase-admin.ts): a field that is undefined by accident should
// be loud, not silently dropped from every document in the database. The cost
// of that choice is that any writer assembling a document from optional data
// has to omit absent keys rather than set them to undefined, because one
// undefined value anywhere in the tree makes the whole write throw.
//
// That is easy to get right by hand for a fixed shape (see `normaliseUtm` in
// lib/marketing/bridge-contract.ts) and impossible to get right by hand for a
// document assembled from a model's output, where every optional field in the
// schema is a field the model may simply not have returned.

/**
 * Only plain objects are walked into.
 *
 * Firestore values include sentinels and wrappers — `FieldValue.serverTimestamp()`,
 * `Timestamp`, `GeoPoint`, `DocumentReference`, `Buffer` — that are class
 * instances the SDK recognises by identity. Rebuilding one as a plain object
 * would turn a server timestamp into an empty map, so anything that is not a
 * bare `{}` is passed through untouched.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Return `value` with every `undefined` removed, recursively.
 *
 * - Object keys holding `undefined` are omitted entirely, which is what
 *   Firestore treats as "this field is absent".
 * - `undefined` array elements are dropped. Firestore rejects them too, and an
 *   absent element carries nothing worth preserving a hole for.
 * - `null` is left alone: it is a value Firestore stores, and it means
 *   something different from an absent field in this codebase (a `sentAt` of
 *   null is "not sent yet", not "unknown").
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map((item) => stripUndefined(item)) as T;
  }

  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (item === undefined) continue;
      out[key] = stripUndefined(item);
    }
    return out as T;
  }

  return value;
}
