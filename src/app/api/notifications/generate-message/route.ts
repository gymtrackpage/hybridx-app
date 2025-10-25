// src/app/api/notifications/generate-message/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { notificationMessage } from '@/ai/flows/notification-message';
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

    const { workoutTitle, exercises } = await request.json();

    if (!workoutTitle || !exercises) {
      return NextResponse.json({ error: 'Missing workout data' }, { status: 400 });
    }

    // Generate AI notification message
    const result = await notificationMessage({
      userName: user.firstName || 'Athlete',
      workoutTitle,
      exercises,
    });

    return NextResponse.json({ message: result.message });
  } catch (error) {
    console.error('Error generating notification message:', error);
    return NextResponse.json(
      { error: 'Failed to generate notification message' },
      { status: 500 }
    );
  }
}
