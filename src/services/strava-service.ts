// src/services/strava-service.ts
'use server';

import { getAuth } from 'firebase-admin/auth';
import { getAdminDb } from '@/lib/firebase-admin';
import { getUser, updateUserAdmin } from './user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
import { headers } from 'next/headers';
import { cookies } from 'next/headers';


// Define the structure of a Strava activity object
export interface StravaActivity {
    id: number;
    name: string;
    distance: number;
    moving_time: number;
    elapsed_time: number;
    total_elevation_gain: number;
    type: string;
    sport_type: string;
    start_date: string;
    start_date_local: string;
    timezone: string;
    utc_offset: number;
    location_city: string | null;
    location_state: string | null;
    location_country: string | null;
    start_latlng: [number, number];
    end_latlng: [number, number];
    map: {
        id: string;
        summary_polyline: string;
        resource_state: number;
    };
}


/**
 * Retrieves a valid Strava access token for the given user, refreshing it if necessary.
 * @param userId - The Firebase UID of the user.
 * @returns A valid Strava access token.
 * @throws An error if the user is not connected to Strava or if the token cannot be refreshed.
 */
async function getValidAccessToken(userId: string): Promise<string> {
    const user = await getUser(userId);
    const stravaTokens = user?.strava;

    if (!stravaTokens) {
        throw new Error('User is not connected to Strava.');
    }

    const now = new Date();
    // Check if the token expires in the next 5 minutes (300,000 ms)
    if (stravaTokens.expiresAt.getTime() - now.getTime() < 300000) {
        console.log(`Refreshing Strava token for user ${userId}...`);
        try {
            const response = await axios.post('https://www.strava.com/oauth/token', null, {
                params: {
                    client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
                    client_secret: process.env.STRAVA_CLIENT_SECRET,
                    grant_type: 'refresh_token',
                    refresh_token: stravaTokens.refreshToken,
                },
            });

            const newTokens: StravaTokens = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresAt: new Date(response.data.expires_at * 1000),
                scope: stravaTokens.scope, // Scope doesn't change on refresh
                athleteId: stravaTokens.athleteId, // Athlete ID doesn't change
            };

            await updateUserAdmin(userId, { strava: newTokens });
            console.log(`Successfully refreshed Strava token for user ${userId}.`);
            return newTokens.accessToken;
        } catch (error: any) {
            console.error('Failed to refresh Strava token:', error.response?.data || error.message);
            // Consider what to do here. Maybe mark the connection as invalid.
            throw new Error('Could not refresh Strava access token. Please try reconnecting your Strava account.');
        }
    }

    return stravaTokens.accessToken;
}

/**
 * Fetches recent Strava activities for the currently logged-in user.
 * This is a Server Action that can be called from client components.
 * @returns An array of Strava activities.
 */
export async function getStravaActivities(): Promise<StravaActivity[]> {
    try {
        // --- Authenticate Firebase User ---
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get('__session')?.value;
        if (!sessionCookie) {
            throw new Error('Authentication required. Please log in.');
        }
        const decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
        const userId = decodedToken.uid;
        // --- End Firebase Auth ---

        const accessToken = await getValidAccessToken(userId);
        
        const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: {
                per_page: 30, // Fetch the last 30 activities
                page: 1,
            },
        });
        
        await updateUserAdmin(userId, { lastStravaSync: new Date() });

        return response.data as StravaActivity[];
    } catch (error: any) {
        console.error('Error fetching Strava activities:', error.response?.data || error.message);
        throw new Error(error.message || 'Failed to fetch activities from Strava.');
    }
}
