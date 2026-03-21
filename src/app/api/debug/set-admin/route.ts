// src/app/api/debug/set-admin/route.ts
// DEBUG ENDPOINT - Never accessible in production.
import { NextRequest, NextResponse } from 'next/server';
import { updateUserAdmin, getUser } from '@/services/user-service';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
    if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    console.log('=== DEBUG SET ADMIN ===');

    try {
        const body = await request.json();
        const { userId, makeAdmin } = body;

        if (!userId) {
            return NextResponse.json({ error: 'userId is required' }, { status: 400 });
        }

        // Require an authenticated admin session — no silent bypass.
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('__session')?.value;
        if (!sessionCookie) {
            return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
        }
        let callerUid: string;
        try {
            const decoded = await getAdminAuth().verifySessionCookie(sessionCookie, true);
            callerUid = decoded.uid;
        } catch {
            return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
        }
        const caller = await getUser(callerUid);
        if (!caller?.isAdmin) {
            return NextResponse.json({ error: 'Admin privileges required' }, { status: 403 });
        }
        console.log('✅ Request authenticated for admin:', callerUid);

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