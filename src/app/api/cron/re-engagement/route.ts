import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { sendReEngagementEmail } from '@/lib/email-service';
import { logger } from '@/lib/logger';
import { Timestamp } from 'firebase-admin/firestore';

export const maxDuration = 60; // Set timeout to 60 seconds
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const adminDb = getAdminDb();
    
    // Calculate the date threshold (3 days ago)
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - (3 * 24 * 60 * 60 * 1000));
    const fourDaysAgo = new Date(now.getTime() - (4 * 24 * 60 * 60 * 1000));

    // Find users created between 3 and 4 days ago
    // This window prevents us from emailing the same people every single day
    const usersSnapshot = await adminDb.collection('users')
      .where('trialStartDate', '<=', Timestamp.fromDate(threeDaysAgo))
      .where('trialStartDate', '>=', Timestamp.fromDate(fourDaysAgo))
      .get();

    if (usersSnapshot.empty) {
      return NextResponse.json({ message: 'No users in the re-engagement window.' });
    }

    const emailPromises: Promise<any>[] = [];
    const usersEmailed: string[] = [];

    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userEmail = userData.email;

      if (!userEmail) continue;

      // Check if they have logged ANY workouts
      const sessionsSnapshot = await adminDb.collection('workoutSessions')
        .where('userId', '==', userId)
        .limit(1)
        .get();

      // If no sessions found, they are inactive -> Send Email
      if (sessionsSnapshot.empty) {
        logger.log(`User ${userId} (${userEmail}) is inactive. Sending nudge.`);
        
        const promise = sendReEngagementEmail(userEmail, userData.firstName)
          .then(result => {
             if (result?.success) usersEmailed.push(userEmail);
          });
        
        emailPromises.push(promise);
      }
    }

    await Promise.all(emailPromises);

    return NextResponse.json({
      success: true,
      processed: usersSnapshot.size,
      emailsSent: usersEmailed.length,
      users: usersEmailed
    });

  } catch (error) {
    console.error('Cron job failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
