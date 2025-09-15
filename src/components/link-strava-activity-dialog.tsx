// src/components/link-strava-activity-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { WorkoutSession } from '@/models/types';
import type { StravaActivity } from '@/services/strava-service';
import { linkStravaActivityToSession } from '@/services/session-service-client';
import { Loader2, Activity, Clock, MapPin, Link as LinkIcon } from 'lucide-react';
import { getAuthInstance } from '@/lib/firebase';
import { differenceInHours } from 'date-fns';

interface LinkStravaActivityDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  session: WorkoutSession;
  onLinkSuccess: () => void;
}

export function LinkStravaActivityDialog({ isOpen, setIsOpen, session, onLinkSuccess }: LinkStravaActivityDialogProps) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchActivitiesWithAuthRefresh = async () => {
        if (!isOpen) return;

        setLoading(true);
        try {
            // 1. Get user and fresh ID token
            const auth = await getAuthInstance();
            const currentUser = auth.currentUser;
            if (!currentUser) {
                throw new Error('You must be logged in to fetch activities.');
            }
            const idToken = await currentUser.getIdToken(true);

            // 2. Refresh the session cookie
            const sessionResponse = await fetch('/api/auth/session', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({ idToken }),
                credentials: 'include'
            });

            if (!sessionResponse.ok) {
                throw new Error('Failed to refresh authentication session.');
            }

            // 3. Now fetch the activities
            const response = await fetch('/api/strava/activities', {
                method: 'GET',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-cache'
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to fetch Strava activities');
            }
            
            const fetchedActivities = await response.json();
            
            // Filter activities to those around the workout date (within 24 hours either side)
            const workoutDate = new Date(session.workoutDate);
            const filtered = fetchedActivities.filter((activity: StravaActivity) => {
                const activityDate = new Date(activity.start_date);
                const timeDiffHours = differenceInHours(activityDate, workoutDate);
                return Math.abs(timeDiffHours) <= 24;
            });
            
            setActivities(filtered);
        } catch (error: any) {
            console.error(error);
            toast({
                title: 'Error',
                description: error.message || 'Could not load your Strava activities. Please ensure you are connected in your profile.',
                variant: 'destructive',
            });
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
    };

    fetchActivitiesWithAuthRefresh();
  }, [isOpen, session.workoutDate, toast, setIsOpen]);

  const handleLink = async () => {
    if (!selectedActivity) return;
    setLinking(true);
    try {
        await linkStravaActivityToSession(session.id, selectedActivity);
        toast({
            title: 'Success!',
            description: 'Workout has been linked to your Strava activity.',
        });
        onLinkSuccess();
    } catch (error: any) {
        toast({
            title: 'Error',
            description: error.message || 'Failed to link the activity.',
            variant: 'destructive',
        });
    } finally {
        setLinking(false);
    }
  };
  
  // Helper to format duration from seconds to HH:MM
    const formatDuration = (seconds: number) => {
        if (!seconds) return '0m';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        if (h > 0) {
            return `${h}h ${m}m`;
        }
        return `${m}m`;
    };

    // Helper to format distance from meters to km or m
    const formatDistance = (meters: number) => {
        if (!meters) return '0 km';
        const km = meters / 1000;
        return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
    };

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return 'Invalid date';
        }
    };


  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Strava Activity</DialogTitle>
          <DialogDescription>
            Select a recent Strava activity to mark this workout as complete. We've filtered to activities within 24 hours of your scheduled workout.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-72">
            <div className="space-y-3 pr-4">
            {loading ? (
                [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
            ) : activities.length > 0 ? (
                activities.map(activity => (
                    <button
                        key={activity.id}
                        onClick={() => setSelectedActivity(activity)}
                        className={`w-full text-left p-3 border rounded-lg transition-colors ${selectedActivity?.id === activity.id ? 'bg-muted ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                    >
                       <div className="font-medium truncate">{activity.name}</div>
                       <div className="text-sm text-muted-foreground flex items-center gap-4 mt-1">
                            <span>{formatDate(activity.start_date_local)}</span>
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {formatDistance(activity.distance)}
                            </span>
                             <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(activity.moving_time)}
                            </span>
                       </div>
                    </button>
                ))
            ) : (
                <div className="text-center py-10 text-muted-foreground">
                    <Activity className="mx-auto h-8 w-8 mb-2" />
                    <p>No recent Strava activities found.</p>
                </div>
            )}
            </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleLink} disabled={!selectedActivity || linking}>
            {linking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <LinkIcon className="mr-2 h-4 w-4" />
            Link Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
