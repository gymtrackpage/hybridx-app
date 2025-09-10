// src/app/api/strava/exchange/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebase-admin';
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

    console.log('URL params:', { code: code?.substring(0, 10) + '...', scope, error, state });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.hybridx.club';
    
    // Handle authorization errors from Strava
    if (error) {
        console.error('Strava authorization error:', error);
        return NextResponse.redirect(new URL(`/profile?strava-error=${encodeURIComponent(error)}`, appUrl));
    }

    if (!code) {
        console.error('No authorization code received from Strava');
        return NextResponse.redirect(new URL('/profile?strava-error=no-code', appUrl));
    }

    try {
        // === ENHANCED AUTHENTICATION DEBUGGING ===
        const cookieStore = cookies();
        const allCookies = cookieStore.getAll();
        console.log('All cookies received:', allCookies.map(c => `${c.name}: ${c.value.substring(0, 20)}...`));
        
        const sessionCookie = cookieStore.get('__session')?.value;
        console.log('Session cookie exists:', !!sessionCookie);
        console.log('Session cookie length:', sessionCookie?.length || 0);

        if (!sessionCookie) {
            console.error('❌ NO SESSION COOKIE - This is the main issue');
            
            // Try alternative authentication methods
            const authHeader = req.headers.get('authorization');
            const customAuth = req.headers.get('x-firebase-auth');
            
            console.log('Authorization header:', !!authHeader);
            console.log('Custom auth header:', !!customAuth);
            
            // If no authentication found, redirect to login with special handling
            const loginUrl = new URL('/login', appUrl);
            loginUrl.searchParams.set('reason', 'strava-auth-session-lost');
            loginUrl.searchParams.set('strava-code', code);
            loginUrl.searchParams.set('strava-scope', scope || '');
            loginUrl.searchParams.set('redirect', '/profile');
            
            console.log('Redirecting to login with Strava data preserved:', loginUrl.toString());
            return NextResponse.redirect(loginUrl);
        }

        // Try to verify the session
        let userId: string;
        try {
            const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
            userId = decodedToken.uid;
            console.log('✅ Session verified successfully for user:', userId);
        } catch (authError: any) {
            console.error('❌ Session verification failed:', authError.message);
            
            // Session is invalid, redirect to login with Strava data
            const loginUrl = new URL('/login', appUrl);
            loginUrl.searchParams.set('reason', 'strava-auth-invalid-session');
            loginUrl.searchParams.set('strava-code', code);
            loginUrl.searchParams.set('strava-scope', scope || '');
            loginUrl.searchParams.set('redirect', '/profile');
            
            return NextResponse.redirect(loginUrl);
        }

        // === EXCHANGE CODE FOR TOKENS ===
        console.log('🔄 Exchanging code for Strava tokens...');
        
        const tokenResponse = await axios.post('https://www.strava.com/oauth/token', {
            client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
            client_secret: process.env.STRAVA_CLIENT_SECRET,
            code: code,
            grant_type: 'authorization_code'
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const tokenData = tokenResponse.data;
        console.log('✅ Received Strava tokens for athlete:', tokenData.athlete?.id);

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

        // === STORE TOKENS ===
        console.log('💾 Storing Strava tokens in Firestore...');
        const adminDb = getAdminDb();
        await adminDb.collection('users').doc(userId).update({
            strava: stravaTokens,
            stravaConnectedAt: new Date(),
            lastStravaSync: null
        });

        console.log('✅ Successfully stored Strava tokens for user:', userId);
        console.log('=== STRAVA EXCHANGE ROUTE SUCCESS ===');

        // Redirect with success
        return NextResponse.redirect(new URL('/profile?strava=success', appUrl));

    } catch (error: any) {
        console.error('❌ Strava token exchange error:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status,
        });
        
        const errorMessage = error.response?.data?.message || 
                           error.response?.data?.error || 
                           error.message || 
                           'Failed to connect Strava account';
        
        return NextResponse.redirect(new URL(`/profile?strava-error=${encodeURIComponent(errorMessage)}`, appUrl));
    }
}
