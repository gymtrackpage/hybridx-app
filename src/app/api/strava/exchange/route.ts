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
    const error = searchParams.get('error');

    // This is the public URL of your application from environment variables.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
        throw new Error("NEXT_PUBLIC_APP_URL is not set in environment variables.");
    }

    // Handle authorization errors from Strava
    if (error) {
        console.error('Strava authorization error:', error);
        return NextResponse.redirect(new URL(`/profile?strava-error=${error}`, appUrl));
    }

    if (!code) {
        console.error('No authorization code received from Strava');
        return NextResponse.redirect(new URL('/profile?strava-error=no-code', appUrl));
    }

    try {
        // --- Authenticate Firebase User ---
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get('__session')?.value;
        if (!sessionCookie) {
            console.error('No session cookie found for Strava auth');
            return NextResponse.redirect(new URL('/login?reason=strava-auth-no-session&redirect=/profile', appUrl));
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
        
        // Validate token data
        if (!tokenData.access_token || !tokenData.refresh_token) {
            throw new Error('Invalid token response from Strava');
        }

        const stravaTokens: StravaTokens = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(tokenData.expires_at * 1000),
            scope: scope || tokenData.scope || '',
            athleteId: tokenData.athlete?.id || 0,
        };

        const adminDb = getAdminDb();
        await adminDb.collection('users').doc(userId).update({
            strava: stravaTokens
        });

        // Redirect back to the profile page with a success message
        return NextResponse.redirect(new URL('/profile?strava=success', appUrl));

    } catch (error: any) {
        console.error('Strava token exchange error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        const errorMessage = error.response?.data?.message || 'Failed to connect Strava account.';
        return NextResponse.redirect(new URL(`/profile?strava-error=${encodeURIComponent(errorMessage)}`, appUrl));
    }
}
