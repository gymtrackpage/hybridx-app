// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
    console.log('=== SESSION COOKIE ROUTE START ===');
    
    try {
        const body = await req.json();
        const { idToken } = body;

        if (!idToken) {
            console.error('❌ No ID token provided');
            return NextResponse.json({ error: 'ID token is required' }, { status: 400 });
        }

        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(idToken, true);
        console.log('✅ ID token verified for user:', decodedToken.uid);

        const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days in milliseconds
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        console.log('🍪 Session cookie created successfully');

        const response = NextResponse.json(
            { success: true, uid: decodedToken.uid },
            { status: 200 }
        );

        response.cookies.set('__session', sessionCookie, {
            maxAge: expiresIn / 1000, // maxAge expects seconds
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        console.log('✅ Session cookie set in response');
        console.log('=== SESSION COOKIE ROUTE SUCCESS ===');
        return response;

    } catch (error: any) {
        const errorMessage = error.message || 'An unexpected error occurred.';
        const errorCode = error.code || 'UNKNOWN_ERROR';
        
        console.error('❌ Session cookie creation failed:', {
            code: errorCode,
            message: errorMessage,
        });

        return NextResponse.json(
            { 
                error: 'Failed to create session',
                debug: {
                    code: errorCode,
                    message: errorMessage
                }
            },
            { status: 401 }
        );
    }
}
