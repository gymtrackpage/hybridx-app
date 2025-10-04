// src/app/api/admin/analyze-workouts/route.ts
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

    // Analyze workout structure
    const analysis = workouts
      .filter((w: any) => !w.title.toLowerCase().includes('rest'))
      .map((workout: any) => {
        const exercises = workout.exercises || [];
        const exerciseCount = exercises.length;

        // Check for specific components
        const hasWarmup = exercises.some((e: any) =>
          e.name.toLowerCase().includes('warm') ||
          e.name.toLowerCase().includes('mobility')
        );
        const hasCooldown = exercises.some((e: any) =>
          e.name.toLowerCase().includes('cool') ||
          e.name.toLowerCase().includes('stretch')
        );
        const hasCore = exercises.some((e: any) =>
          e.name.toLowerCase().includes('core') ||
          e.name.toLowerCase().includes('plank') ||
          e.name.toLowerCase().includes('ab') ||
          e.name.toLowerCase().includes('v-up')
        );
        const hasGrip = exercises.some((e: any) =>
          e.name.toLowerCase().includes('grip') ||
          e.name.toLowerCase().includes('farmer') ||
          e.name.toLowerCase().includes('hang') ||
          e.name.toLowerCase().includes('hold')
        );

        // Estimate workout complexity (simple heuristic)
        const isShort = exerciseCount < 4;

        return {
          day: workout.day,
          title: workout.title,
          exerciseCount,
          hasWarmup,
          hasCooldown,
          hasCore,
          hasGrip,
          isShort,
          exercises: exercises.map((e: any) => e.name)
        };
      });

    // Summary stats
    const totalWorkouts = analysis.length;
    const withWarmup = analysis.filter((a: any) => a.hasWarmup).length;
    const withCooldown = analysis.filter((a: any) => a.hasCooldown).length;
    const withCore = analysis.filter((a: any) => a.hasCore).length;
    const withGrip = analysis.filter((a: any) => a.hasGrip).length;
    const shortWorkouts = analysis.filter((a: any) => a.isShort).length;

    return NextResponse.json({
      success: true,
      programName: programData?.name,
      totalWorkouts,
      summary: {
        withWarmup,
        withCooldown,
        withCore,
        withGrip,
        shortWorkouts,
        percentWithWarmup: ((withWarmup / totalWorkouts) * 100).toFixed(1),
        percentWithCooldown: ((withCooldown / totalWorkouts) * 100).toFixed(1),
        percentWithCore: ((withCore / totalWorkouts) * 100).toFixed(1),
        percentWithGrip: ((withGrip / totalWorkouts) * 100).toFixed(1),
        percentShort: ((shortWorkouts / totalWorkouts) * 100).toFixed(1)
      },
      workouts: analysis
    });

  } catch (error: any) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
