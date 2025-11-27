// src/app/api/ai/apply-adjustments/route.ts
import { NextResponse } from 'next/server';
import { getUser, updateUserAdmin } from '@/services/user-service';
import { getProgram } from '@/services/program-service';
import type { Workout, RunningWorkout } from '@/models/types';

interface Adjustment {
  day: number;
  originalTitle: string;
  modifiedTitle: string;
  reason: string;
  modifiedWorkout: Workout | RunningWorkout;
}

export async function POST(request: Request) {
  try {
    console.log('[Apply Adjustments] Starting...');
    const body = await request.json();
    const { userId, adjustments } = body as { userId: string; adjustments: Adjustment[] };

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 });
    }

    if (!adjustments || adjustments.length === 0) {
      return NextResponse.json({ error: 'No adjustments provided' }, { status: 400 });
    }

    console.log('[Apply Adjustments] User ID:', userId);
    console.log('[Apply Adjustments] Number of adjustments:', adjustments.length);

    // 1. Fetch current user data
    const user = await getUser(userId);
    if (!user || !user.programId) {
      return NextResponse.json({ error: 'User or program not found' }, { status: 404 });
    }

    // 2. Fetch the base program
    const baseProgram = await getProgram(user.programId);
    if (!baseProgram) {
      return NextResponse.json({ error: 'Base program not found' }, { status: 404 });
    }

    // 3. Start with either existing custom program or clone the base program
    let customWorkouts: (Workout | RunningWorkout)[];

    if (user.customProgram && user.customProgram.length > 0) {
      // User already has customizations - build on top of them
      console.log('[Apply Adjustments] Building on existing custom program');
      customWorkouts = [...user.customProgram];
    } else {
      // First time customizing - clone the base program
      console.log('[Apply Adjustments] Creating new custom program from base');
      customWorkouts = [...baseProgram.workouts];
    }

    // 4. Apply each adjustment by replacing the workout with matching day
    for (const adjustment of adjustments) {
      const workoutIndex = customWorkouts.findIndex(w => w.day === adjustment.day);

      if (workoutIndex !== -1) {
        console.log(`[Apply Adjustments] Replacing day ${adjustment.day}: "${adjustment.originalTitle}" → "${adjustment.modifiedTitle}"`);
        customWorkouts[workoutIndex] = adjustment.modifiedWorkout;
      } else {
        console.warn(`[Apply Adjustments] Warning: Could not find workout for day ${adjustment.day}`);
      }
    }

    // 5. Save the updated custom program to the user's profile
    await updateUserAdmin(userId, {
      customProgram: customWorkouts,
    });

    console.log('[Apply Adjustments] Successfully saved', adjustments.length, 'adjustments');

    return NextResponse.json({
      success: true,
      message: `Applied ${adjustments.length} adjustment(s) to your personalized program`,
      adjustmentsApplied: adjustments.length,
    });

  } catch (error: any) {
    console.error('[Apply Adjustments] Error:', error);
    console.error('[Apply Adjustments] Error stack:', error.stack);
    return NextResponse.json({
      error: error.message || 'Failed to apply adjustments',
      details: error.toString(),
    }, { status: 500 });
  }
}
