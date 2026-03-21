// src/components/link-strava-activity-dialog.tsx
'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { WorkoutSession } from '@/models/types';
import type { StravaActivity } from '@/services/strava-service';
import { linkStravaActivityToSession } from '@/services/session-service-client';
import { Loader2, Activity, Clock, MapPin, Link as LinkIcon, Sparkles } from 'lucide-react';
import { getAuthInstance } from '@/lib/firebase';
import { isSameDay, differenceInMinutes } from 'date-fns';

interface LinkStravaActivityDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  session: WorkoutSession;
  onLinkSuccess: () => void;
}

// ─── Match scoring ────────────────────────────────────────────────────────────

/**
 * Higher score = better match. Uses same-day proximity and time-of-day.
 * Demotes activities that are already linked to this session.
 */
function matchScore(activity: StravaActivity, session: WorkoutSession): number {
  let score = 0;
  const actDate = new Date(activity.start_date_local || activity.start_date);
  const sessionDate = session.finishedAt || session.workoutDate;

  if (isSameDay(actDate, sessionDate)) {
    score += 100;
    const minutesDiff = Math.abs(differenceInMinutes(actDate, sessionDate));
    if (minutesDiff <= 240) score += Math.max(0, 50 - minutesDiff / 5);
  }

  // Demote an activity that's already the linked one
  if (session.stravaId && activity.id.toString() === session.stravaId) score -= 1000;

  return score;
}

function isGoodMatch(activity: StravaActivity, session: WorkoutSession): boolean {
  return matchScore(activity, session) >= 100;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatDistance(meters: number) {
  if (!meters) return '';
  const km = meters / 1000;
  return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
}

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return 'Unknown date'; }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LinkStravaActivityDialog({
  isOpen,
  setIsOpen,
  session,
  onLinkSuccess,
}: LinkStravaActivityDialogProps) {
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<StravaActivity | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!isOpen) return;

    const fetch_ = async () => {
      setLoading(true);
      setSelectedActivity(null);
      try {
        const auth = await getAuthInstance();
        const currentUser = auth.currentUser;
        if (!currentUser) throw new Error('You must be logged in.');

        const idToken = await currentUser.getIdToken(true);
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
          credentials: 'include',
        });

        const response = await fetch('/api/strava/activities', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(err.error || 'Failed to fetch Strava activities');
        }

        const { activities: fetched }: { activities: StravaActivity[] } = await response.json();
        // Sort by match score: same-day activities float to the top
        const sorted = [...fetched].sort((a, b) => matchScore(b, session) - matchScore(a, session));
        setActivities(sorted);

        // Auto-select the best match if it's clearly from the same day
        const best = sorted[0];
        if (best && isGoodMatch(best, session)) setSelectedActivity(best);
      } catch (error: any) {
        logger.error('Error fetching Strava activities:', error);
        toast({ title: 'Error Loading Activities', description: error.message, variant: 'destructive' });
        setIsOpen(false);
      } finally {
        setLoading(false);
      }
    };

    fetch_();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const { suggested, others } = useMemo(() => ({
    suggested: activities.filter(a => isGoodMatch(a, session)),
    others: activities.filter(a => !isGoodMatch(a, session)),
  }), [activities, session]);

  const handleLink = async () => {
    if (!selectedActivity) return;
    setLinking(true);
    try {
      await linkStravaActivityToSession(session.id, selectedActivity);
      toast({ title: 'Linked!', description: `"${session.workoutTitle}" linked to "${selectedActivity.name}".` });
      onLinkSuccess();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to link.', variant: 'destructive' });
    } finally {
      setLinking(false);
    }
  };

  const ActivityRow = ({ activity, isSuggested }: { activity: StravaActivity; isSuggested?: boolean }) => (
    <button
      onClick={() => setSelectedActivity(activity)}
      className={`w-full text-left p-3 border rounded-xl transition-colors ${
        selectedActivity?.id === activity.id
          ? 'bg-primary/5 ring-2 ring-primary border-primary'
          : isSuggested
          ? 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800'
          : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm truncate">{activity.name}</span>
        <div className="flex gap-1 shrink-0">
          {isSuggested && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] px-1.5 py-0 h-4">
              <Sparkles className="h-2.5 w-2.5 mr-0.5" />
              Match
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{activity.sport_type}</Badge>
        </div>
      </div>
      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
        <span>{formatDate(activity.start_date_local || activity.start_date)}</span>
        {formatDistance(activity.distance) && (
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{formatDistance(activity.distance)}</span>
        )}
        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(activity.moving_time)}</span>
      </div>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link Strava Activity</DialogTitle>
          <DialogDescription>
            Select a Strava activity to merge with <strong>{session.workoutTitle}</strong>.
            Activities from the same day are highlighted as suggested matches.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-80">
          <div className="space-y-2 pr-3">
            {loading ? (
              [...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
            ) : activities.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Activity className="mx-auto h-8 w-8 mb-2" />
                <p>No recent Strava activities found.</p>
                <p className="text-xs mt-1">Activities may take a few minutes to sync from Strava.</p>
              </div>
            ) : (
              <>
                {suggested.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                      Suggested — same day
                    </p>
                    {suggested.map(a => <ActivityRow key={a.id} activity={a} isSuggested />)}
                  </div>
                )}
                {others.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {suggested.length > 0 && (
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                        Other recent activities
                      </p>
                    )}
                    {others.map(a => <ActivityRow key={a.id} activity={a} />)}
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleLink} disabled={!selectedActivity || linking}>
            {linking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            Link Activity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
