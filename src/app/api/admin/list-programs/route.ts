// src/app/api/admin/list-programs/route.ts
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export async function GET() {
  try {
    const db = getAdminDb();
    const programsSnapshot = await db.collection('programs').get();

    const programs = programsSnapshot.docs.map(doc => ({
      id: doc.id,
      name: doc.data().name,
      programType: doc.data().programType,
      workoutCount: doc.data().workouts?.length || 0,
      lastEnhanced: doc.data().lastEnhanced || null,
      enhancementVersion: doc.data().enhancementVersion || null
    }));

    return NextResponse.json({
      success: true,
      programs,
      totalPrograms: programs.length
    });

  } catch (error: any) {
    console.error('List programs error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
