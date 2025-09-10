// src/services/strava-service.ts
'use server';

import { getAuth } from 'firebase-admin/auth';
import { getUser, updateUserAdmin } from './user-service';
import axios from 'axios';
import type { StravaTokens } from '@/models/types';
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

    if (!stravaTokens || !stravaTokens.accessToken) {
        throw new Error('User is not connected to Strava. Please connect your account in settings.');
    }

    const now = new Date();
    const expiresAt = stravaTokens.expiresAt;
    
    // Check if token is expired or expires soon (5 minutes buffer)
    if (!expiresAt || expiresAt.getTime() - now.getTime() < 300000) {
        console.log(`Token expired or expiring soon for user ${userId}, refreshing...`);
        if (!stravaTokens.refreshToken) {
            throw new Error('Refresh token not available. Please reconnect your Strava account.');
        }

        try {
            const response = await axios.post('https://www.strava.com/oauth/token', {
                client_id: process.env.NEXT_PUBLIC_STRAVA_CLIENT_ID,
                client_secret: process.env.STRAVA_CLIENT_SECRET,
                grant_type: 'refresh_token',
                refresh_token: stravaTokens.refreshToken,
            });

            if (!response.data.access_token) {
                throw new Error('Invalid response from Strava token refresh');
            }

            const newTokens: StravaTokens = {
                accessToken: response.data.access_token,
                refreshToken: response.data.refresh_token,
                expiresAt: new Date(response.data.expires_at * 1000),
                scope: stravaTokens.scope,
                athleteId: stravaTokens.athleteId,
            };

            await updateUserAdmin(userId, { strava: newTokens });
            console.log(`Successfully refreshed Strava token for user ${userId}`);
            return newTokens.accessToken;
            
        } catch (error: any) {
            console.error('Failed to refresh Strava token:', {
                userId,
                error: error.response?.data || error.message,
                status: error.response?.status
            });
            
            // If refresh fails, the connection might be invalid
            // Use null which Firestore can handle for field deletion in an update
            await updateUserAdmin(userId, { strava: null as any });
            
            throw new Error('Strava connection expired. Please reconnect your account in settings.');
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
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get('__session')?.value;
        
        if (!sessionCookie) {
            throw new Error('Authentication required. Please log in to view Strava activities.');
        }

        let decodedToken;
        try {
            decodedToken = await getAuth().verifySessionCookie(sessionCookie, true);
        } catch (authError) {
            console.error('Session verification failed:', authError);
            throw new Error('Session expired. Please log in again.');
        }

        const userId = decodedToken.uid;
        const accessToken = await getValidAccessToken(userId);
        
        const response = await axios.get('https://www.strava.com/api/v3/athlete/activities', {
            headers: { 
                Authorization: `Bearer ${accessToken}`,
            },
            params: {
                per_page: 30, // Fetch the last 30 activities
                page: 1,
            },
        });
        
        await updateUserAdmin(userId, { lastStravaSync: new Date() });

        return response.data as StravaActivity[];
        
    } catch (error: any) {
        console.error('Error fetching Strava activities:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
        });

        if (error.response?.status === 401) {
            throw new Error('Strava authorization expired. Please reconnect your account.');
        } else if (error.response?.status === 429) {
            throw new Error('Strava rate limit exceeded. Please try again later.');
        } else if (error.message.includes('Authentication required')) {
            throw error; // Re-throw auth errors as-is
        } else {
            throw new Error('Failed to fetch activities from Strava. Please try again.');
        }
    }
}
