// src/app/api/debug/set-admin/route.ts
// IMPORTANT: This is a debug endpoint - remove or secure in production!
import { NextRequest, NextResponse } from 'next/server';
import { updateUserAdmin } from '@/services/user-service';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    console.log('=== DEBUG SET ADMIN ===');

    try {
        const body = await request.json();
        const { userId, makeAdmin } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Optional: Add some basic authentication
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('__session')?.value;

        if (sessionCookie) {
            try {
                const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
                console.log('✅ Request authenticated for user:', decodedToken.uid);
            } catch (authError) {
                console.log('⚠️ Authentication failed, but proceeding for debug purposes');
            }
        }

        // Update the user's admin status
        await updateUserAdmin(userId, { isAdmin: makeAdmin !== false });

        console.log(`✅ Successfully set admin status for user ${userId} to ${makeAdmin !== false}`);

        return NextResponse.json({
            success: true,
            userId,
            isAdmin: makeAdmin !== false,
            message: `User ${userId} admin status set to ${makeAdmin !== false}`
        });

    } catch (error) {
        console.error('❌ Error setting admin status:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}