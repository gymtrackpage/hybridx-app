// src/app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
    try {
        const { idToken } = await req.json();
        
        if (!idToken) {
            return NextResponse.json({ error: 'No ID token provided' }, { status: 400 });
        }

        // Verify the ID token
        const decodedToken = await getAuth().verifyIdToken(idToken);
        
        // Create session cookie (expires in 5 days)
        const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
        const sessionCookie = await getAuth().createSessionCookie(idToken, { expiresIn });
        
        // Set the cookie
        const response = NextResponse.json({ success: true });
        response.cookies.set('__session', sessionCookie, {
            maxAge: expiresIn,
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/'
        });

        console.log('Session cookie created for user:', decodedToken.uid);
        return response;
        
    } catch (error: any) {
        console.error('Session creation failed:', error);
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }
}
