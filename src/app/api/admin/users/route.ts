// src/app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, getUser } from '@/services/user-service';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    console.log('=== ADMIN USERS API ROUTE START ===');

    try {
        // Get the session token from cookies
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get('__session')?.value;

        // Debug all cookies
        const allCookies = cookieStore.getAll();
        console.log('📝 All cookies received:', allCookies.map(c => ({ name: c.name, hasValue: !!c.value })));
        console.log('📝 Session cookie found:', !!sessionCookie);
        console.log('📝 Session cookie length:', sessionCookie?.length || 0);

        if (!sessionCookie) {
            console.log('❌ No session cookie found');
            return NextResponse.json({ error: 'Unauthorized - No session cookie' }, { status: 401 });
        }

        console.log('🔐 Verifying session cookie...');
        // Verify the session token and check if user is admin
        const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
        const userId = decodedToken.uid;
        console.log('✅ Session verified for user:', userId);

        console.log('👤 Fetching user data to check admin status...');
        // Get user data to check admin status
        const user = await getUser(userId);
        console.log('📋 User data:', {
            id: user?.id,
            email: user?.email,
            isAdmin: user?.isAdmin
        });

        if (!user?.isAdmin) {
            console.log('❌ User is not admin:', user?.isAdmin);
            return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 });
        }

        console.log('👑 User is admin, fetching all users...');
        // If user is admin, fetch all users
        const users = await getAllUsers();
        console.log('✅ Successfully fetched', users.length, 'users');

        // Log sample user data for debugging
        if (users.length > 0) {
            console.log('📋 First user sample:', {
                id: users[0].id,
                email: users[0].email,
                firstName: users[0].firstName,
                lastName: users[0].lastName,
                isAdmin: users[0].isAdmin,
                subscriptionStatus: users[0].subscriptionStatus
            });
        }

        return NextResponse.json(users);

    } catch (error) {
        console.error('❌ Error in admin users API:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}