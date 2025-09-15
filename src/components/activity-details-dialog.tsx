// src/components/activity-details-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import type { StravaActivity } from '@/services/strava-service';
import { getAuthInstance } from '@/lib/firebase';
import { Badge } from './ui/badge';
import { Activity, ArrowUp, Clock, Heart, Map, MapPin, Wind } from 'lucide-react';
import { Separator } from './ui/separator';

interface ActivityDetailsDialogProps {
  activityId: number;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function ActivityDetailsDialog({ activityId, isOpen, setIsOpen }: ActivityDetailsDialogProps) {
  const [activity, setActivity] = useState<StravaActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchActivityDetails = async () => {
      if (!isOpen || !activityId) return;

      setLoading(true);
      setActivity(null);
      try {
        const auth = await getAuthInstance();
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('Authentication required.');

        const idToken = await currentUser.getIdToken(true);
        const response = await fetch(`/api/strava/activities/${activityId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch activity details.');
        }

        const data = await response.json();
        setActivity(data);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
        setIsOpen(false); // Close dialog on error
      } finally {
        setLoading(false);
      }
    };

    fetchActivityDetails();
  }, [isOpen, activityId, toast, setIsOpen]);

  // Helper to format duration from seconds to HH:MM:SS
  const formatDuration = (seconds: number) => {
    if (!seconds) return '00:00:00';
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  // Helper to format distance from meters to km
  const formatDistance = (meters: number) => {
      if (!meters) return '0.0 km';
      const km = meters / 1000;
      return `${km.toFixed(2)} km`;
  };

  // Helper to format speed from m/s to km/h
  const formatSpeed = (speed: number) => {
    if (!speed) return '0.0 km/h';
    return `${(speed * 3.6).toFixed(1)} km/h`;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-xl">
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-48 w-full" />
            <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ) : activity ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{activity.name}</DialogTitle>
              <DialogDescription>
                {new Date(activity.start_date_local).toLocaleString('en-US', {
                    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                })}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <Badge variant="outline">{activity.sport_type}</Badge>

                {activity.map?.summary_polyline && activity.embed_token && (
                    <div className="rounded-lg overflow-hidden border">
                         <iframe
                            src={`https://www.strava.com/activities/${activity.id}/embed/${activity.embed_token}`}
                            width="100%"
                            height="350"
                            frameBorder="0"
                            scrolling="no"
                            title={`${activity.name} Map`}
                            allowFullScreen
                        ></iframe>
                    </div>
                )}
                
                <Separator />

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <MetricCard icon={MapPin} label="Distance" value={formatDistance(activity.distance)} />
                    <MetricCard icon={Clock} label="Moving Time" value={formatDuration(activity.moving_time)} />
                    <MetricCard icon={ArrowUp} label="Elevation Gain" value={`${Math.round(activity.total_elevation_gain)} m`} />
                    <MetricCard icon={Wind} label="Avg. Speed" value={formatSpeed(activity.average_speed)} />
                    {activity.average_heartrate && (
                        <MetricCard icon={Heart} label="Avg. Heart Rate" value={`${Math.round(activity.average_heartrate)} bpm`} />
                    )}
                     {activity.suffer_score && (
                        <MetricCard icon={Activity} label="Suffer Score" value={Math.round(activity.suffer_score)} />
                    )}
                </div>

            </div>
          </>
        ) : (
          <p>Activity details could not be loaded.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

const MetricCard = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: string | number }) => (
    <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
        <div className="bg-muted p-2 rounded-full">
            <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="font-semibold">{value}</div>
        </div>
    </div>
);
