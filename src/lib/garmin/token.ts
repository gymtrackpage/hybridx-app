/**
 * Garmin token helper. Mirrors src/lib/strava-token.ts but for Garmin's
 * OAuth 2.0 token endpoint.
 *
 * Throws Error with `code`:
 *   GARMIN_NOT_CONNECTED   — user has no tokens stored
 *   GARMIN_REFRESH_FAILED  — refresh request failed (likely needs reconnect)
 */
import axios from 'axios';
import { getUser, updateUserAdmin } from '@/services/user-service';
import { logger } from '@/lib/logger';
import type { GarminTokens } from '@/models/types';
import { GARMIN_TOKEN_URL } from './oauth';

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

export async function getValidGarminToken(userId: string): Promise<string> {
  const user = await getUser(userId);
  const tokens = user?.garmin;

  if (!tokens?.accessToken || !tokens.refreshToken) {
    throw Object.assign(new Error('Garmin account not connected.'), {
      code: 'GARMIN_NOT_CONNECTED',
    });
  }

  const now = Date.now();
  const expiresAt = parseExpiresAt(tokens.expiresAt).getTime();

  // Refresh within a 5-minute buffer to absorb clock skew.
  if (expiresAt - now > 300_000) {
    return tokens.accessToken;
  }

  logger.log(`Garmin token for ${userId} expiring soon — refreshing.`);

  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Garmin client credentials not configured on the server.');
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    });

    const res = await axios.post(GARMIN_TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const data = res.data;
    const newTokens: GarminTokens = {
      ...tokens,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: new Date(now + (data.expires_in ?? 3600) * 1000),
      refreshExpiresAt: data.refresh_token_expires_in
        ? new Date(now + data.refresh_token_expires_in * 1000)
        : tokens.refreshExpiresAt,
      scope: data.scope ?? tokens.scope,
      tokenType: data.token_type ?? tokens.tokenType,
    };

    await updateUserAdmin(userId, { garmin: newTokens });
    return newTokens.accessToken;
  } catch (err: any) {
    logger.error('Garmin token refresh failed:', {
      userId,
      err: err.response?.data || err.message,
    });
    throw Object.assign(new Error('Garmin token refresh failed.'), {
      code: 'GARMIN_REFRESH_FAILED',
      cause: err,
    });
  }
}
