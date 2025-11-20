// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function GET(req: NextRequest) {
    console.log('=== SESSION COOKIE VERIFICATION START ===');

    try {
        const sessionCookie = req.cookies.get('__session')?.value;

        if (!sessionCookie) {
            console.log('❌ No session cookie found');
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        // Verify the session cookie
        try {
            const adminAuth = getAdminAuth();
            const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);

            console.log('✅ Session verified for user:', decodedClaims.uid);
            return NextResponse.json({
                authenticated: true,
                user: {
                    uid: decodedClaims.uid,
                    email: decodedClaims.email,
                }
            });
        } catch (verifyError: any) {
            console.error('❌ Session verification failed:', verifyError.message);

            const response = NextResponse.json({
                authenticated: false,
                error: 'Invalid session'
            }, { status: 401 });

            // Clear invalid session cookie
            response.cookies.delete('__session');
            return response;
        }
    } catch (error: any) {
        console.error('❌ Session verification error:', error);
        return NextResponse.json({
            authenticated: false,
            error: 'Server error'
        }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    console.log('=== SESSION COOKIE DELETE START ===');

    try {
        const response = NextResponse.json(
            { success: true, message: 'Session cleared' },
            { status: 200 }
        );

        // Clear the session cookie
        response.cookies.delete('__session');

        console.log('✅ Session cookie cleared');
        console.log('=== SESSION COOKIE DELETE SUCCESS ===');
        return response;

    } catch (error: any) {
        console.error('❌ Session cookie deletion failed:', error);
        return NextResponse.json(
            { error: 'Failed to clear session' },
            { status: 500 }
        );
    }
}

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

        // 14 days in milliseconds
        const expiresIn = 60 * 60 * 24 * 14 * 1000; 
        
        // Important: Session cookie expiration cannot be more than 14 days in Firebase
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        console.log('🍪 Session cookie created successfully');

        const response = NextResponse.json(
            { success: true, uid: decodedToken.uid },
            { status: 200 }
        );

        // Determine if we're in a secure environment
        const isSecure = process.env.NODE_ENV === 'production' || req.url.startsWith('https://');

        // To make persistence more robust:
        // 1. Use a very long expiration time (up to 14 days allowed by Firebase Admin SDK)
        // 2. Ensure cookie paths are root
        // 3. Use SameSite=Lax to ensure it sends on top-level navigations but protects against CSRF
        
        console.log('🍪 Setting cookie with config:', {
            secure: isSecure,
            sameSite: 'lax',
            httpOnly: true,
            path: '/',
            maxAge: expiresIn / 1000,
        });

        response.cookies.set('__session', sessionCookie, {
            maxAge: expiresIn / 1000, // maxAge expects seconds
            httpOnly: true,
            secure: isSecure,
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
