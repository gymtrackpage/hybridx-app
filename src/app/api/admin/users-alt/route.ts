// src/app/api/admin/users-alt/route.ts
// Alternative admin users endpoint using Authorization header instead of cookies
import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers, getUser } from '@/services/user-service';
import { getAdminAuth } from '@/lib/firebase-admin';

export async function POST(request: NextRequest) {
    console.log('=== ADMIN USERS ALT API ROUTE START ===');

    try {
        const body = await request.json();
        const { idToken } = body;

        if (!idToken) {
            return NextResponse.json({ error: 'ID token required' }, { status: 400 });
        }

        console.log('🔐 Verifying ID token directly...');
        // Verify the ID token directly
        const decodedToken = await getAdminAuth().verifyIdToken(idToken, true);
        const userId = decodedToken.uid;
        console.log('✅ ID token verified for user:', userId);

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
        console.error('❌ Error in admin users alt API:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}