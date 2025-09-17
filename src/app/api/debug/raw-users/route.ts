// src/app/api/debug/raw-users/route.ts
// DEBUG ENDPOINT - Remove in production!
import { NextRequest, NextResponse } from 'next/server';
import { getAllUsers } from '@/services/user-service';

export async function GET(request: NextRequest) {
    console.log('=== DEBUG RAW USERS ===');

    try {
        console.log('🔄 Calling getAllUsers directly...');
        const users = await getAllUsers();

        console.log('📊 getAllUsers returned:', {
            isArray: Array.isArray(users),
            length: users?.length,
            type: typeof users
        });

        return NextResponse.json({
            success: true,
            userCount: users.length,
            users: users,
            summary: users.map(user => ({
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                isAdmin: user.isAdmin,
                subscriptionStatus: user.subscriptionStatus
            }))
        });

    } catch (error) {
        console.error('❌ Error in raw users debug:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined
        }, { status: 500 });
    }
}