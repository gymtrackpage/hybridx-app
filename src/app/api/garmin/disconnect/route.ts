// src/app/api/garmin/disconnect/route.ts
// Disconnects the user from Garmin: revokes the partner registration on
// Garmin's side (best-effort) and clears tokens locally.
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import axios from 'axios';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { GARMIN_API_BASE } from '@/lib/garmin/oauth';
import { getValidGarminToken } from '@/lib/garmin/token';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger';

export async function POST(_req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }
    const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    const userId = decoded.uid;

    // Best-effort partner de-registration. Garmin Health endpoint is
    // DELETE /wellness-api/rest/user/registration. Failures are logged
    // but don't block local disconnect.
    try {
      const accessToken = await getValidGarminToken(userId);
      await axios.delete(`${GARMIN_API_BASE}/wellness-api/rest/user/registration`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch (err: any) {
      logger.warn('Garmin de-registration failed (continuing):', err.message);
    }

    await getAdminDb().collection('users').doc(userId).update({
      garmin: FieldValue.delete(),
      garminConnectedAt: FieldValue.delete(),
      garminPlanSync: FieldValue.delete(),
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    logger.error('Garmin disconnect error:', err.message);
    return NextResponse.json(
      { error: err.message || 'Failed to disconnect Garmin.' },
      { status: 500 },
    );
  }
}
