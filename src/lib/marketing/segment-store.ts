// src/lib/marketing/segment-store.ts
//
// Saved, named audiences.
//
// A segment expressed only in a campaign's own fields has to be rebuilt from
// memory each time, and two campaigns nominally aimed at "trialists who have
// never trained" quietly drift apart. Naming one makes it reusable across
// campaigns, journey entry rules and the studio, and makes "who did we actually
// send that to" answerable months later.

import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import type { SegmentDefinition } from './segments';

export const SEGMENTS = 'marketingSegments';

export interface SavedSegment {
  id: string;
  name: string;
  description?: string;
  definition: SegmentDefinition;
  /** Cached size, refreshed when the segment is resolved. Indicative, not live. */
  lastCount?: number;
  lastCountedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SerialisableSegment extends Omit<SavedSegment, 'lastCountedAt' | 'createdAt' | 'updatedAt'> {
  lastCountedAt: string | null;
  createdAt: string | null;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate(): Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return typeof value === 'string' ? value : null;
}

export async function listSegments(): Promise<SerialisableSegment[]> {
  const snap = await getAdminDb().collection(SEGMENTS).orderBy('name').get();

  return snap.docs.map((d) => {
    const data = d.data() as SavedSegment;
    return {
      id: d.id,
      name: data.name,
      description: data.description,
      definition: data.definition ?? {},
      lastCount: data.lastCount,
      lastCountedAt: iso(data.lastCountedAt),
      createdAt: iso(data.createdAt),
    };
  });
}

export async function getSegment(id: string): Promise<SavedSegment | null> {
  const snap = await getAdminDb().collection(SEGMENTS).doc(id).get();
  return snap.exists ? ({ id: snap.id, ...snap.data() } as SavedSegment) : null;
}

export async function createSegment(input: {
  name: string;
  description?: string;
  definition: SegmentDefinition;
  count?: number;
}): Promise<string> {
  const ref = await getAdminDb().collection(SEGMENTS).add({
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    definition: input.definition,
    ...(input.count !== undefined
      ? { lastCount: input.count, lastCountedAt: FieldValue.serverTimestamp() }
      : {}),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

export async function updateSegment(
  id: string,
  patch: Partial<Pick<SavedSegment, 'name' | 'description' | 'definition' | 'lastCount'>>,
): Promise<void> {
  await getAdminDb().collection(SEGMENTS).doc(id).update({
    ...patch,
    ...(patch.lastCount !== undefined ? { lastCountedAt: FieldValue.serverTimestamp() } : {}),
    updatedAt: FieldValue.serverTimestamp(),
  });
}

export async function deleteSegment(id: string): Promise<void> {
  await getAdminDb().collection(SEGMENTS).doc(id).delete();
}
