'use client';
// src/components/today-strava-feed.tsx
// Mini dashboard feed showing only today's Strava activities.
// Calls onActivitiesLoaded with a human-readable summary for the AI quote.

import { useState, useEffect, useCallback } from 'react';
import { getAuthInstance } from '@/lib/firebase';
import type { StravaActivity } from '@/services/strava-service';
import { categoriseActivity } from '@/services/training-load-service';
import { ActivityDetailsDialog } from '@/components/activity-details-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Bike,
  Clock,
  Dumbbell,
  Footprints,
  Heart,
  MapPin,
  Route,
  Waves,
} from 'lucide-react';
import { isToday } from 'date-fns';

interface TodayStravaFeedProps {
  /** Called once today's activities are known; passes a readable summary string (or null if none). */
  onActivitiesLoaded?: (summary: string | null) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function categoryIcon(activity: StravaActivity) {
  const cat = categoriseActivity(activity);
  const cls = 'h-4 w-4';
  switch (cat) {
    case 'run':      return <Route className={cls} />;
    case 'ride':     return <Bike className={cls} />;
    case 'swim':     return <Waves className={cls} />;
    case 'strength': return <Dumbbell className={cls} />;
    case 'walk':     return <Footprints className={cls} />;
    default:         return <Activity className={cls} />;
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number): string {
  if (!meters || meters < 100) return '';
  const km = meters / 1000;
  return `${km.toFixed(1)} km`;
}

/** Build the summary string passed to the AI quote. */
function buildAISummary(activities: StravaActivity[]): string {
  return activities
    .map(a => {
      const dist = formatDistance(a.distance);
      const dur = formatDuration(a.moving_time);
      const type = a.sport_type || a.type;
      if (dist) return `a ${dist} ${type} (${dur})`;
      return `a ${dur} ${type}`;
    })
    .join(' and ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TodayStravaFeed({ onActivitiesLoaded }: TodayStravaFeedProps) {
  const [todayActivities, setTodayActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchAndFilter = useCallback(async () => {
    setLoading(true);
    try {
      const auth = await getAuthInstance();
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const idToken = await currentUser.getIdToken(true);
      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        credentials: 'include',
      });

      const res = await fetch('/api/strava/activities', {
        credentials: 'include',
        cache: 'no-cache',
      });

      if (!res.ok) {
        onActivitiesLoaded?.(null);
        return;
      }

      const all: StravaActivity[] = await res.json();

      // Filter to activities that started today in the user's local timezone
      const todays = Array.isArray(all)
        ? all.filter(a => {
            const d = new Date(a.start_date_local || a.start_date);
            return isToday(d);
          })
        : [];

      setTodayActivities(todays);
      onActivitiesLoaded?.(todays.length > 0 ? buildAISummary(todays) : null);
    } catch {
      onActivitiesLoaded?.(null);
    } finally {
      setLoading(false);
    }
  }, [onActivitiesLoaded]);

  useEffect(() => {
    fetchAndFilter();
  }, [fetchAndFilter]);

  const handleClick = (id: number) => {
    setSelectedId(id);
    setDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex gap-3">
        <Skeleton className="h-16 flex-1 rounded-xl" />
        <Skeleton className="h-16 flex-1 rounded-xl" />
      </div>
    );
  }

  if (todayActivities.length === 0) {
    return null; // Nothing to show — parent hides the section
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {todayActivities.map(activity => (
          <button
            key={activity.id}
            onClick={() => handleClick(activity.id)}
            className="w-full text-left flex items-center gap-3 p-3 rounded-xl border bg-card hover:bg-muted/50 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {/* Icon */}
            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {categoryIcon(activity)}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm truncate">{activity.name}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                  {activity.sport_type}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
                {formatDistance(activity.distance) && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {formatDistance(activity.distance)}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(activity.moving_time)}
                </span>
                {activity.average_heartrate && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3 w-3" />
                    {Math.round(activity.average_heartrate)} bpm
                  </span>
                )}
              </div>
            </div>

            {/* Suffer score pill */}
            {activity.suffer_score != null && activity.suffer_score > 0 && (
              <div className="flex-shrink-0 text-center">
                <p className="text-xs text-muted-foreground">Load</p>
                <p className="text-sm font-bold">{Math.round(activity.suffer_score)}</p>
              </div>
            )}
          </button>
        ))}
      </div>

      {selectedId != null && (
        <ActivityDetailsDialog
          activityId={selectedId}
          isOpen={dialogOpen}
          setIsOpen={setDialogOpen}
        />
      )}
    </>
  );
}
