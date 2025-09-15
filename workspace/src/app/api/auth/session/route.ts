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
            return NextResponse.json(
                { error: 'ID token is required' },
                { status: 400 }
            );
        }

        console.log('🔍 Verifying ID token...');
        
        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(idToken, true);
        console.log('✅ ID token verified for user:', decodedToken.uid);

        // Create session cookie
        const expiresIn = 60 * 60 * 24 * 14 * 1000; // 14 days in milliseconds
        const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
        
        console.log('🍪 Session cookie created successfully');

        // Create the response
        const response = NextResponse.json(
            { 
                success: true,
                uid: decodedToken.uid,
                expiresIn: expiresIn / 1000
            },
            { status: 200 }
        );

        // Special cookie settings for Cloud Workstations
        response.cookies.set('__session', sessionCookie, {
            maxAge: expiresIn / 1000, // maxAge expects seconds
            httpOnly: true,
            secure: true, // HTTPS is required in Cloud Workstations
            sameSite: 'none', // Allow cross-site for complex proxy setup
            path: '/'
        });

        // Also try setting with lax for fallback
        response.cookies.set('__session_fallback', sessionCookie, {
            maxAge: expiresIn / 1000,
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/'
        });

        console.log('✅ Session cookies set with workstation-compatible settings');
        console.log('=== SESSION COOKIE ROUTE SUCCESS ===');

        return response;

    } catch (error: any) {
        console.error('❌ Session cookie creation failed:', {
            code: error.code,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 3)
        });

        return NextResponse.json(
            { 
                error: 'Failed to create session',
                debug: {
                    code: error.code,
                    message: error.message
                }
            },
            { status: 401 }
        );
    }
}
