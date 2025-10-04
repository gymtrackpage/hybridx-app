// src/app/api/admin/verify-enhancements/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const programId = searchParams.get('programId') || 'JrHDGwFm0Cn4sRJosApH';

    const db = getAdminDb();
    const programRef = db.collection('programs').doc(programId);
    const programDoc = await programRef.get();

    if (!programDoc.exists) {
      return NextResponse.json({ error: 'Program not found' }, { status: 404 });
    }

    const programData = programDoc.data();
    const workouts = programData?.workouts || [];

    // Find first non-rest workout
    const firstWorkout = workouts.find((w: any) => !w.title.toLowerCase().includes('rest'));

    // Count enhancements
    let enhancedCount = 0;
    let totalExercises = 0;

    for (const workout of workouts) {
      if (workout.title.toLowerCase().includes('rest')) continue;

      for (const exercise of workout.exercises || []) {
        totalExercises++;
        const details = exercise.details || '';

        if (details.includes('🎯') || details.includes('💡') || details.includes('⚡') ||
            details.includes('Week ') || details.includes('Alternative:')) {
          enhancedCount++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      programName: programData?.name,
      totalWorkouts: workouts.length,
      totalExercises,
      enhancedCount,
      enhancementRate: ((enhancedCount / totalExercises) * 100).toFixed(1),
      lastEnhanced: programData?.lastEnhanced,
      enhancementVersion: programData?.enhancementVersion,
      sampleWorkout: firstWorkout
    });

  } catch (error: any) {
    console.error('Verification error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
