// src/app/api/debug/cookies/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
    console.log('=== COOKIE DEBUG ENDPOINT ===');

    try {
        const cookieStore = await cookies();
        const allCookies = cookieStore.getAll();
        const sessionCookie = cookieStore.get('__session');

        console.log('🍪 All cookies:', allCookies);
        console.log('🎯 Session cookie:', sessionCookie);

        return NextResponse.json({
            success: true,
            cookieCount: allCookies.length,
            cookies: allCookies.map(c => ({
                name: c.name,
                hasValue: !!c.value,
                valueLength: c.value?.length || 0
            })),
            sessionCookie: sessionCookie ? {
                exists: true,
                valueLength: sessionCookie.value?.length || 0
            } : { exists: false },
            headers: {
                cookie: request.headers.get('cookie'),
                userAgent: request.headers.get('user-agent'),
                host: request.headers.get('host')
            }
        });

    } catch (error) {
        console.error('❌ Cookie debug error:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}