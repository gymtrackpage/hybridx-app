import { describe, it, expect } from 'vitest';
import {
  canRead,
  computeAssignmentUpdate,
  isAssignedTo,
  isCustomProgram,
  usersLosingAccess,
} from '../program-visibility';
import type { Program } from '@/models/types';

type Access = Pick<Program, 'visibility' | 'assignedUserIds' | 'retainedUserIds'>;

const publicProgram: Access = {};
const custom = (assigned: string[], retained: string[] = []): Access => ({
  visibility: 'custom',
  assignedUserIds: assigned,
  retainedUserIds: retained,
});

describe('visibility checks', () => {
  it('treats a program with no visibility field as public', () => {
    expect(isCustomProgram(publicProgram)).toBe(false);
    expect(isAssignedTo(publicProgram, 'anyone')).toBe(true);
    expect(canRead(publicProgram, 'anyone')).toBe(true);
  });

  it('limits a custom program to its assignees', () => {
    const program = custom(['alice']);
    expect(isAssignedTo(program, 'alice')).toBe(true);
    expect(isAssignedTo(program, 'bob')).toBe(false);
    expect(canRead(program, 'bob')).toBe(false);
  });

  it('lets a retained athlete read but not re-pick the program', () => {
    const program = custom(['alice'], ['bob']);
    expect(canRead(program, 'bob')).toBe(true);
    expect(isAssignedTo(program, 'bob')).toBe(false);
  });
});

describe('computeAssignmentUpdate', () => {
  it('stores the selected athletes on a fresh custom program', () => {
    const update = computeAssignmentUpdate({
      current: publicProgram,
      visibility: 'custom',
      assignedUserIds: ['alice', 'bob'],
      activeForUserIds: [],
    });
    expect(update).toEqual({
      visibility: 'custom',
      assignedUserIds: ['alice', 'bob'],
      retainedUserIds: [],
    });
  });

  it('retains a removed athlete who is mid-program', () => {
    const update = computeAssignmentUpdate({
      current: custom(['alice', 'bob']),
      visibility: 'custom',
      assignedUserIds: ['alice'],
      activeForUserIds: ['bob'],
    });
    expect(update.assignedUserIds).toEqual(['alice']);
    expect(update.retainedUserIds).toEqual(['bob']);
  });

  it('drops a removed athlete who is not training on it', () => {
    const update = computeAssignmentUpdate({
      current: custom(['alice', 'bob']),
      visibility: 'custom',
      assignedUserIds: ['alice'],
      activeForUserIds: [],
    });
    expect(update.retainedUserIds).toEqual([]);
  });

  it('clears the retained flag when an athlete is re-assigned', () => {
    const update = computeAssignmentUpdate({
      current: custom(['alice'], ['bob']),
      visibility: 'custom',
      assignedUserIds: ['alice', 'bob'],
      activeForUserIds: [],
    });
    expect(update.assignedUserIds).toEqual(['alice', 'bob']);
    expect(update.retainedUserIds).toEqual([]);
  });

  it('keeps athletes retained across an unrelated later edit', () => {
    const update = computeAssignmentUpdate({
      current: custom(['alice'], ['bob']),
      visibility: 'custom',
      assignedUserIds: ['alice', 'carol'],
      activeForUserIds: [],
    });
    expect(update.retainedUserIds).toEqual(['bob']);
  });

  it('clears both lists when the program is made public', () => {
    const update = computeAssignmentUpdate({
      current: custom(['alice'], ['bob']),
      visibility: 'public',
      assignedUserIds: ['alice'],
      activeForUserIds: ['bob'],
    });
    expect(update).toEqual({ visibility: 'public', assignedUserIds: [], retainedUserIds: [] });
  });

  it('de-duplicates and ignores empty ids', () => {
    const update = computeAssignmentUpdate({
      current: publicProgram,
      visibility: 'custom',
      assignedUserIds: ['alice', 'alice', '', 'bob'],
      activeForUserIds: [],
    });
    expect(update.assignedUserIds).toEqual(['alice', 'bob']);
  });

  it('produces state that the access checks agree with', () => {
    const update = computeAssignmentUpdate({
      current: custom(['alice', 'bob']),
      visibility: 'custom',
      assignedUserIds: ['alice'],
      activeForUserIds: ['bob'],
    });
    expect(canRead(update, 'alice')).toBe(true);
    expect(canRead(update, 'bob')).toBe(true);
    expect(isAssignedTo(update, 'bob')).toBe(false);
    expect(canRead(update, 'carol')).toBe(false);
  });
});

describe('usersLosingAccess', () => {
  it('names only the athletes cut off outright', () => {
    const losing = usersLosingAccess({
      current: custom(['alice', 'bob', 'carol']),
      visibility: 'custom',
      assignedUserIds: ['alice'],
      activeForUserIds: ['bob'],
    });
    expect(losing).toEqual(['carol']);
  });

  it('reports nobody when a program is opened up to everyone', () => {
    expect(
      usersLosingAccess({
        current: custom(['alice']),
        visibility: 'public',
        assignedUserIds: [],
        activeForUserIds: [],
      }),
    ).toEqual([]);
  });
});
