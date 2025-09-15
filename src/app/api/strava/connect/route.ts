// src/app/api/strava/connect/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get('__session')?.value;

    if (!sessionCookie) {
      return NextResponse.json({ error: 'Authentication required. Please log in.' }, { status: 401 });
    }
    
    // This verifies the user is logged in before we proceed
    const decodedToken = await getAdminAuth().verifySessionCookie(sessionCookie, true);
    
    const clientId = process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;

    if (!clientId || !appUrl) {
      throw new Error('Strava integration is not configured correctly on the server.');
    }

    const redirectUri = `${appUrl}/api/strava/exchange`;
    const scope = 'read,activity:read_all,activity:write';
    
    // CSRF protection
    const state = btoa(JSON.stringify({ uid: decodedToken.uid }));
    
    const authUrl = `https://www.strava.com/oauth/authorize?` +
      `client_id=${clientId}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `approval_prompt=force&` +
      `scope=${scope}&` +
      `state=${state}`;
      
    return NextResponse.json({ url: authUrl });

  } catch (error: any) {
    console.error('Error creating Strava connect URL:', error);
    if (error.code === 'auth/session-cookie-expired' || error.code === 'auth/session-cookie-revoked') {
      return NextResponse.json({ error: 'Your session has expired. Please log in again.' }, { status: 401 });
    }
    return NextResponse.json({ error: error.message || 'Failed to initiate Strava connection.' }, { status: 500 });
  }
}
