// src/app/api/debug/admin-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/services/user-service';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    console.log('=== DEBUG ADMIN STATUS ===');

    try {
        // Get the session token from cookies
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('__session')?.value;
        console.log('📝 Session cookie exists:', !!sessionCookie);

        if (!sessionCookie) {
            return NextResponse.json({
                error: 'No session cookie found',
                authenticated: false
            }, { status: 401 });
        }

        // Verify the session token
        const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
        const userId = decodedToken.uid;
        console.log('✅ Session verified for user:', userId);

        // Get user data
        const user = await getUser(userId);
        console.log('📋 Full user data:', {
            id: user?.id,
            email: user?.email,
            firstName: user?.firstName,
            lastName: user?.lastName,
            isAdmin: user?.isAdmin,
        });

        return NextResponse.json({
            authenticated: true,
            userId,
            userEmail: decodedToken.email,
            isAdmin: user?.isAdmin || false,
            userExists: !!user,
            adminField: user?.isAdmin,
            rawUserData: user ? {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            } : null
        });

    } catch (error) {
        console.error('❌ Error in debug admin status:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            authenticated: false
        }, { status: 500 });
    }
}