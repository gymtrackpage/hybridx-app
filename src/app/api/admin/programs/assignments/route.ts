// src/app/api/admin/programs/assignments/route.ts
// Admin endpoint for changing who a program applies to.
//
// This has to run server-side: deciding whether a removed athlete keeps access
// means reading *other* athletes' user documents, which Firestore rules only
// ever allow for the athlete themselves. Switching a program between public and
// custom also moves it between the `programs` and `customPrograms` collections,
// which is done as a batch so the program is never in both or neither.
// The document id is preserved across the move, so user.programId references
// and existing workout sessions keep resolving.

import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import { getUser } from '@/services/user-service';
import { computeAssignmentUpdate } from '@/lib/program-visibility';
import type { Program, ProgramVisibility } from '@/models/types';

const PUBLIC = 'programs';
const CUSTOM = 'customPrograms';

export async function PUT(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const actingUser = await getUser(decodedToken.uid);
    if (!actingUser?.isAdmin) {
      return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    const programId: string | undefined = body?.programId;
    const visibility: ProgramVisibility | undefined = body?.visibility;
    const requestedUserIds: unknown = body?.assignedUserIds ?? [];

    if (!programId || (visibility !== 'public' && visibility !== 'custom')) {
      return NextResponse.json(
        { error: 'programId and a visibility of "public" or "custom" are required.' },
        { status: 400 },
      );
    }
    if (!Array.isArray(requestedUserIds) || requestedUserIds.some(id => typeof id !== 'string')) {
      return NextResponse.json({ error: 'assignedUserIds must be an array of user ids.' }, { status: 400 });
    }
    if (visibility === 'custom' && requestedUserIds.length === 0) {
      return NextResponse.json(
        { error: 'A custom program needs at least one athlete assigned to it.' },
        { status: 400 },
      );
    }

    const adminDb = getAdminDb();

    // Find the program in whichever collection currently holds it.
    const [publicSnap, customSnap] = await Promise.all([
      adminDb.collection(PUBLIC).doc(programId).get(),
      adminDb.collection(CUSTOM).doc(programId).get(),
    ]);

    const snap = publicSnap.exists ? publicSnap : customSnap.exists ? customSnap : null;
    if (!snap) {
      return NextResponse.json({ error: 'Program not found.' }, { status: 404 });
    }

    const currentCollection = publicSnap.exists ? PUBLIC : CUSTOM;
    const program = { id: snap.id, ...snap.data() } as Program;

    // Reject ids that are not real users — a typo would otherwise assign a
    // program to nobody and look like it worked.
    const assignedUserIds = requestedUserIds as string[];
    if (visibility === 'custom') {
      const userDocs = await adminDb.getAll(
        ...assignedUserIds.map(id => adminDb.collection('users').doc(id)),
      );
      const missing = userDocs.filter(d => !d.exists).map(d => d.id);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `These users no longer exist: ${missing.join(', ')}` },
          { status: 400 },
        );
      }
    }

    // Which of the athletes being removed are mid-program on it? They keep read
    // access so their dashboard and calendar do not break.
    const assignedSet = new Set(assignedUserIds);
    const removed = (program.assignedUserIds ?? []).filter(id => !assignedSet.has(id));
    let activeForUserIds: string[] = [];
    if (removed.length > 0) {
      const removedDocs = await adminDb.getAll(
        ...removed.map(id => adminDb.collection('users').doc(id)),
      );
      activeForUserIds = removedDocs
        .filter(d => d.exists && d.data()?.programId === programId)
        .map(d => d.id);
    }

    const update = computeAssignmentUpdate({
      current: program,
      visibility,
      assignedUserIds,
      activeForUserIds,
    });

    const targetCollection = visibility === 'custom' ? CUSTOM : PUBLIC;

    if (targetCollection === currentCollection) {
      await adminDb.collection(targetCollection).doc(programId).update({ ...update });
    } else {
      // Move collections, keeping the id so existing references still resolve.
      const { id: _id, ...programData } = program;
      const batch = adminDb.batch();
      batch.set(adminDb.collection(targetCollection).doc(programId), { ...programData, ...update });
      batch.delete(adminDb.collection(currentCollection).doc(programId));
      await batch.commit();
    }

    console.info('[admin/programs/assignments] updated', {
      programId,
      by: decodedToken.uid,
      visibility,
      assigned: update.assignedUserIds.length,
      retained: update.retainedUserIds.length,
      moved: targetCollection !== currentCollection,
    });

    return NextResponse.json({
      programId,
      collection: targetCollection,
      ...update,
      retainedFromThisChange: activeForUserIds,
    });
  } catch (error) {
    const code = (error as any)?.code;
    if (code === 'auth/session-cookie-expired' || code === 'auth/session-cookie-revoked' || code === 'auth/argument-error') {
      return NextResponse.json({ error: 'Session expired. Please log in again.' }, { status: 401 });
    }
    console.error('[admin/programs/assignments] failed', {
      message: error instanceof Error ? error.message : String(error),
      code,
    });
    return NextResponse.json({ error: 'Failed to update program access.' }, { status: 500 });
  }
}
