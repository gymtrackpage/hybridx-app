// src/app/api/strava/exchange/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const scope = searchParams.get('scope');

    if (!code) {
        return NextResponse.redirect(new URL('/profile?strava-error=auth-failed', req.url));
    }

    try {
        // --- Authenticate Firebase User ---
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get('__session')?.value;
        if (!sessionCookie) {
            // If there's no session, we can't associate the Strava account.
            // Redirect to login, maybe with a message.
            return NextResponse.redirect(new URL('/login?reason=strava-auth', req.url));
        }
        
        const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
        const userId = decodedToken.uid;
        // --- End Firebase Auth ---
        
        const response = await axios.post('https://www.strava.com/oauth/token', {
            client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        });

        const tokenData = response.data;
        
        const stravaTokens: StravaTokens = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(tokenData.expires_at * 1000),
            scope: scope || '',
            athleteId: tokenData.athlete.id,
        };

        const adminDb = getAdminDb();
        await adminDb.collection('users').doc(userId).update({
            strava: stravaTokens
        });

        // Redirect back to the profile page with a success message
        return NextResponse.redirect(new URL('/profile?strava=success', req.url));

    } catch (error: any) {
        console.error('Strava token exchange error:', error.response?.data || error.message);
        const errorMessage = error.response?.data?.message || 'Failed to connect Strava account.';
        return NextResponse.redirect(new URL(`/profile?strava-error=${encodeURIComponent(errorMessage)}`, req.url));
    }
}
