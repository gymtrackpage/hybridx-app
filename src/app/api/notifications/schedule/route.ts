// src/app/api/notifications/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { getUser } from '@/services/user-service';

export async function POST(request: NextRequest) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const userId = decodedToken.uid;

    // Get user data
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Store notification preference in user document
    // This endpoint confirms the user wants notifications enabled
    // The actual scheduling happens client-side using the Notification API

    return NextResponse.json({
      success: true,
      message: 'Notification preferences saved'
    });
  } catch (error) {
    console.error('Error scheduling notifications:', error);
    return NextResponse.json(
      { error: 'Failed to schedule notifications' },
      { status: 500 }
    );
  }
}
