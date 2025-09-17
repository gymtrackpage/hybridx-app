// src/app/api/debug/create-session-and-check/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/services/user-service';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    console.log('=== CREATE SESSION AND CHECK ADMIN ===');

    try {
        const body = await request.json();
        const { idToken } = body;

        if (!idToken) {
            return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
        }

        const adminAuth = getAdminAuth();

        // Verify the ID token
        const decodedToken = await adminAuth.verifyIdToken(idToken, true);
        console.log('✅ ID token verified for user:', decodedToken.uid);

        // Create session cookie
        const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        console.log('🍪 Session cookie created');

        // Get user data to check admin status
        const user = await getUser(decodedToken.uid);
        console.log('📋 User data:', {
            id: user?.id,
            email: user?.email,
            isAdmin: user?.isAdmin
        });

        const response = NextResponse.json({
            success: true,
            userId: decodedToken.uid,
            userEmail: decodedToken.email,
            isAdmin: user?.isAdmin || false,
            userExists: !!user,
            sessionCreated: true,
            userDoc: user ? {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                isAdmin: user.isAdmin
            } : null
        });

        // Set the session cookie
        response.cookies.set('__session', sessionCookie, {
            maxAge: expiresIn / 1000,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        console.log('✅ Session cookie set and admin status checked');
        return response;

    } catch (error) {
        console.error('❌ Error in create session and check:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}