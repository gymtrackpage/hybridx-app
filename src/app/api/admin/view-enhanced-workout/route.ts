// src/app/api/admin/view-enhanced-workout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId') || 'JrHDGwFm0Cn4sRJosApH';
    const day = parseInt(searchParams.get('day') || '1');

    const db = getAdminDb();
    const programRef = db.collection('programs').doc(programId);
    const programDoc = await programRef.get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    const workouts = programData?.workouts || [];

    const workout = workouts.find((w: any) => w.day === day);

    if (!workout) {
      return NextResponse.json({ error: 'Workout not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      programName: programData?.name,
      workout: {
        day: workout.day,
        title: workout.title,
        exerciseCount: workout.exercises?.length || 0,
        exercises: workout.exercises
      }
    });

  } catch (error: any) {
    console.error('View workout error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
