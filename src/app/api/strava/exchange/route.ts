// src/app/api/strava/exchange/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';

export async function GET(req: NextRequest) {
    console.log('=== STRAVA EXCHANGE ROUTE START ===');
    
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const scope = searchParams.get('scope');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9002';
    
    if (error) {
        console.error('Strava authorization error:', error);
        return NextResponse.redirect(new URL(`/profile?strava-error=${encodeURIComponent(error)}`, appUrl));
    }

    if (!code || !state) {
        console.error('Missing code or state from Strava redirect');
        return NextResponse.redirect(new URL('/profile?strava-error=missing-params', appUrl));
    }

    try {
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get('__session')?.value;

        if (!sessionCookie) {
            console.error('❌ NO SESSION COOKIE during Strava exchange.');
            // This is a critical failure. The user session was lost during the redirect.
            // We cannot proceed safely.
            throw new Error("Your session expired during the connection process. Please log in and try connecting to Strava again.");
        }

        const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
        const userId = decodedToken.uid;
        
        const decodedState = JSON.parse(atob(state));
        if (decodedState.uid !== userId) {
            throw new Error('State mismatch (CSRF protection). Potential security issue.');
        }

        console.log('✅ Session verified for user:', userId);

        const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
            client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        });

        const tokenData = tokenResponse.data;
        if (!tokenData.access_token) throw new Error('Invalid token response from Strava');

        const stravaTokens: StravaTokens = {
            accessToken: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: new Date(tokenData.expires_at * 1000),
            scope: scope || tokenData.scope || '',
            athleteId: tokenData.athlete?.id || 0,
        };

        await getAdminDb().collection('users').doc(userId).update({
            strava: stravaTokens,
            stravaConnectedAt: new Date(),
        });

        console.log('✅ Successfully stored Strava tokens for user:', userId);
        return NextResponse.redirect(new URL('/profile?strava=success', appUrl));

    } catch (error: any) {
        console.error('❌ Strava token exchange error:', {
            message: error.message,
            response: error.response?.data,
        });
        const errorMessage = error.response?.data?.message || error.message || 'Failed to connect Strava.';
        return NextResponse.redirect(new URL(`/profile?strava-error=${encodeURIComponent(errorMessage)}`, appUrl));
    }
}
