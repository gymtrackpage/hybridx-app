// src/lib/strava-token.ts
// Shared Strava token refresh logic — used by both the activities and upload API routes.

import axios from 'axios';
import { getUser, updateUserAdmin } from '@/services/user-service';
import type { StravaTokens } from '@/models/types';

/** Safely parse any timestamp shape (Date, Firestore Timestamp, number, string) into a Date.
 *  Returns new Date(0) (epoch) when the value is missing or unrecognisable, which
 *  causes the caller to treat the token as expired and trigger a safe refresh. */
function parseExpiresAt(expiresAt: any): Date {
  if (!expiresAt) return new Date(0);
  if (expiresAt instanceof Date) return expiresAt;
  if (typeof expiresAt.toDate === 'function') return expiresAt.toDate() as Date;
  if (typeof expiresAt === 'number') return new Date(expiresAt);
  if (typeof expiresAt === 'string') {
    const d = new Date(expiresAt);
    return isNaN(d.getTime()) ? new Date(0) : d;
  }
  return new Date(0);
}

/**
 * Returns a valid Strava access token for the given user, refreshing it when
 * it is within 5 minutes of expiry.
 *
 * Throws an Error with a `code` property on failure:
 *   'STRAVA_NOT_CONNECTED'  — user has no Strava tokens stored
 *   'STRAVA_REFRESH_FAILED' — the refresh request to Strava failed
 */
export async function getValidStravaToken(userId: string): Promise<string> {
  const user = await getUser(userId);
  const stravaTokens = user?.strava;

  if (!stravaTokens?.accessToken || !stravaTokens.refreshToken) {
    throw Object.assign(
      new Error('Strava account not connected.'),
      { code: 'STRAVA_NOT_CONNECTED' },
    );
  }

  const now = new Date();
  const expiresAt = parseExpiresAt(stravaTokens.expiresAt);

  if (expiresAt.getTime() - now.getTime() < 300_000) { // refresh within 5-min buffer
    console.log(`🔄 Strava token for user ${userId} expiring soon — refreshing...`);
    try {
      const refreshResponse = await axios.post('https://www.strava.com/oauth/token', {
        client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: stravaTokens.refreshToken,
      });

      const newTokens: StravaTokens = {
        ...stravaTokens,
        accessToken: refreshResponse.data.access_token,
        refreshToken: refreshResponse.data.refresh_token,
        expiresAt: new Date(refreshResponse.data.expires_at * 1000),
      };

      await updateUserAdmin(userId, { strava: newTokens });
      console.log(`✅ Strava token for user ${userId} refreshed successfully`);
      return newTokens.accessToken;
    } catch (err: any) {
      console.error(`❌ Strava token refresh failed for user ${userId}:`, err.response?.data || err.message);
      throw Object.assign(
        new Error('Strava token refresh failed.'),
        { code: 'STRAVA_REFRESH_FAILED', cause: err },
      );
    }
  }

  console.log(`✅ Strava token for user ${userId} is still valid.`);
  return stravaTokens.accessToken;
}
