// src/lib/program-visibility.ts
// Rules for who can see and start a custom (user-specific) program.
//
// Public programs live in the `programs` collection and are readable by every
// signed-in athlete, exactly as before this feature. Custom programs live in
// `customPrograms` and carry the athletes they apply to. Splitting the two
// collections keeps the public listing an unrestricted query — Firestore fails
// a whole list query if any document it returns is off-limits, so a restricted
// program sitting in `programs` would break every athlete's program list.
//
// The one wrinkle is unassignment: taking an athlete off a custom program that
// is *currently their active plan* would break their dashboard and calendar,
// which resolve the program by id. Those athletes move to `retainedUserIds` —
// still able to read the program they are training on, but no longer offered it
// in their program list, so they cannot restart it once they switch away.

import type { Program, ProgramVisibility } from '@/models/types';

type ProgramAccessFields = Pick<Program, 'visibility' | 'assignedUserIds' | 'retainedUserIds'>;

export function isCustomProgram(program: ProgramAccessFields): boolean {
  return program.visibility === 'custom';
}

/** Can this athlete pick the program from their program list? */
export function isAssignedTo(program: ProgramAccessFields, userId: string): boolean {
  if (!isCustomProgram(program)) return true;
  return (program.assignedUserIds ?? []).includes(userId);
}

/** Can this athlete read the program at all? Assigned athletes plus the
 *  grandfathered ones still training on it. Mirrors the Firestore read rule for
 *  /customPrograms/{programId} — keep the two in step. */
export function canRead(program: ProgramAccessFields, userId: string): boolean {
  if (!isCustomProgram(program)) return true;
  return isAssignedTo(program, userId) || (program.retainedUserIds ?? []).includes(userId);
}

export interface AssignmentUpdate {
  visibility: ProgramVisibility;
  assignedUserIds: string[];
  retainedUserIds: string[];
}

export interface AssignmentChangeInput {
  /** Assignment state currently stored on the program. */
  current: ProgramAccessFields;
  /** Visibility the admin is saving. */
  visibility: ProgramVisibility;
  /** Athletes the admin has selected. Ignored when visibility is 'public'. */
  assignedUserIds: string[];
  /** Of the athletes being removed, those for whom this program is their active
   *  plan (`user.programId === program.id`). Only the server can work this out —
   *  it needs to read other athletes' user documents. */
  activeForUserIds: string[];
}

/**
 * Work out the assignment fields to write, given what the admin selected and
 * who is mid-program.
 *
 * - Athletes removed from a custom program while training on it are retained.
 * - Re-assigning an athlete clears them from the retained list — they are a
 *   normal assignee again.
 * - Switching a program to public clears both lists: everyone can see it, so
 *   there is nothing left to grandfather.
 */
export function computeAssignmentUpdate({
  current,
  visibility,
  assignedUserIds,
  activeForUserIds,
}: AssignmentChangeInput): AssignmentUpdate {
  if (visibility === 'public') {
    return { visibility: 'public', assignedUserIds: [], retainedUserIds: [] };
  }

  const assigned = unique(assignedUserIds);
  const assignedSet = new Set(assigned);

  const previouslyAssigned = current.assignedUserIds ?? [];
  const removed = previouslyAssigned.filter(id => !assignedSet.has(id));
  const activeSet = new Set(activeForUserIds);

  // Keep anyone already retained, unless they have since been re-assigned, and
  // add the athletes being removed right now who are mid-program.
  const retained = unique([
    ...(current.retainedUserIds ?? []),
    ...removed.filter(id => activeSet.has(id)),
  ]).filter(id => !assignedSet.has(id));

  return { visibility: 'custom', assignedUserIds: assigned, retainedUserIds: retained };
}

/** Athletes who lose access outright when this assignment change is saved —
 *  i.e. removed and not mid-program. Used to warn the admin before saving. */
export function usersLosingAccess({
  current,
  visibility,
  assignedUserIds,
  activeForUserIds,
}: AssignmentChangeInput): string[] {
  if (visibility === 'public') return [];
  const assignedSet = new Set(unique(assignedUserIds));
  const activeSet = new Set(activeForUserIds);
  return (current.assignedUserIds ?? []).filter(id => !assignedSet.has(id) && !activeSet.has(id));
}

function unique(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}
