// src/app/(app)/activity-feed/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getAuthInstance } from '@/lib/firebase';
import type { StravaActivity } from '@/services/strava-service';
import { getStravaActivities } from '@/services/strava-service';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

export default function ActivityFeedPage() {
    const [activities, setActivities] = useState<StravaActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchActivities = async () => {
        setSyncing(true);
        setError(null);
        try {
            const fetchedActivities = await getStravaActivities();
            setActivities(fetchedActivities);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch activities.');
        } finally {
            setSyncing(false);
            setLoading(false);
        }
    };
    
    useEffect(() => {
        const initialize = async () => {
            const auth = await getAuthInstance();
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                if (user) {
                    fetchActivities();
                } else {
                    setLoading(false);
                }
            });
            return unsubscribe;
        };
        
        let unsubscribe: () => void;
        initialize().then(unsub => unsubscribe = unsub);

        return () => {
            if (unsubscribe) {
                unsubscribe();
            }
        };
    }, []);

    // Helper to format duration from seconds to HH:MM:SS
    const formatDuration = (seconds: number) => {
        const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
        const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${h}:${m}:${s}`;
    };

    // Helper to format distance from meters to miles
    const formatDistance = (meters: number) => {
        const miles = meters * 0.000621371;
        return `${miles.toFixed(2)} mi`;
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <Skeleton className="h-8 w-48" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </div>
                    <Skeleton className="h-10 w-28" />
                </div>
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </CardContent>
                </Card>
            </div>
        );
    }
    

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Activity Feed</h1>
                    <p className="text-muted-foreground">Your recent activities from Strava.</p>
                </div>
                <Button onClick={fetchActivities} disabled={syncing}>
                    {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Zap className="mr-2 h-4 w-4" />}
                    Sync Now
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Recent Activities</CardTitle>
                    <CardDescription>A log of your training sessions synced from Strava.</CardDescription>
                </CardHeader>
                <CardContent>
                    {error && <p className="text-destructive">{error}</p>}
                    {activities.length > 0 ? (
                        <ul className="space-y-4">
                            {activities.map((activity) => (
                                <li key={activity.id} className="p-4 border rounded-md">
                                    <p className="font-semibold">{activity.name}</p>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                                        <span>{format(new Date(activity.start_date), "MMM d, yyyy")}</span>
                                        <span>{formatDuration(activity.moving_time)}</span>
                                        <span>{formatDistance(activity.distance)}</span>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-muted-foreground text-center py-8">
                            No activities found. Sync with Strava to see your feed.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
