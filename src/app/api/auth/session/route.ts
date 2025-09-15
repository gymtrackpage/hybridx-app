// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

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
        
        // Use the same admin auth instance as your other routes
        const adminAuth = getAdminAuth();
        const decodedToken = await adminAuth.verifyIdToken(idToken, true);
        console.log('✅ ID token verified for user:', decodedToken.uid);

        // Create session cookie (expires in 14 days)
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

        // Set the session cookie with proper options
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
