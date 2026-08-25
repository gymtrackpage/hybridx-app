'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, Loader2, Mail, Pause, Play, PowerOff, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { pauseAllJourneys, setJourneyStatus } from '@/lib/marketing/studio-actions';
import { TRIGGER_DESCRIPTIONS, type TriggerType } from '@/lib/marketing/journeys';
import type { SerialisableJourney } from '@/lib/marketing/journey-queries';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  live: 'bg-green-500/15 text-green-600 dark:text-green-400',
  paused: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  archived: 'bg-muted text-muted-foreground',
};

export function JourneysList({ journeys }: { journeys: SerialisableJourney[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [pausingAll, setPausingAll] = useState(false);

  const liveCount = journeys.filter((j) => j.status === 'live').length;

  const changeStatus = (id: string, status: 'live' | 'paused' | 'archived') => {
    startTransition(async () => {
      const result = await setJourneyStatus(id, status);
      toast(
        result.success
          ? { title: `Journey ${status}` }
          : { title: 'Could not change', description: result.error, variant: 'destructive' },
      );
    });
  };

  const handlePauseAll = async () => {
    setPausingAll(true);
    const result = await pauseAllJourneys();
    setPausingAll(false);
    toast(
      result.success
        ? { title: `Paused ${result.data.paused} journeys` }
        : { title: 'Could not pause', description: result.error, variant: 'destructive' },
    );
  };

  return (
    <div className="space-y-4">
      {liveCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <p className="text-sm">
            <strong>{liveCount}</strong> journey{liveCount === 1 ? ' is' : 's are'} live and
            emailing athletes automatically.
          </p>
          {/* Kill switch. A live journey mails people with nobody watching, so
              stopping all of them must be one action, not a per-journey chore. */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={pausingAll}>
                {pausingAll ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="mr-2 h-4 w-4" />
                )}
                Pause all
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Pause every live journey?</AlertDialogTitle>
                <AlertDialogDescription>
                  All {liveCount} live journeys stop enrolling and advancing immediately. Anyone
                  already partway through keeps their place, and resuming continues from where they
                  stopped.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handlePauseAll}>Pause all</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {journeys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No journeys yet. Describe what you want to send in the studio and one will be built
              for you.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {journeys.map((journey) => {
            const emailCount = journey.steps.filter((s) => s.type === 'sendEmail').length;
            return (
              <Card key={journey.id}>
                <CardHeader className="p-4 pb-3 sm:p-6 sm:pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="text-base">
                        <Link
                          href={`/admin/marketing/journeys/${journey.id}`}
                          className="hover:underline"
                        >
                          {journey.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="mt-1">{journey.goal}</CardDescription>
                    </div>
                    <Badge variant="secondary" className={STATUS_STYLES[journey.status]}>
                      {journey.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
                  <p className="text-xs text-muted-foreground">
                    {TRIGGER_DESCRIPTIONS[journey.trigger.type as TriggerType] ??
                      journey.trigger.type}
                  </p>

                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {emailCount} email{emailCount === 1 ? '' : 's'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {journey.activeRuns ?? 0} in progress
                    </span>
                    <span>{journey.stats.completed} completed</span>
                    {!!journey.failedRuns && (
                      <span className="flex items-center gap-1.5 font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {journey.failedRuns} stuck
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {journey.status === 'live' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => changeStatus(journey.id, 'paused')}
                      >
                        <Pause className="mr-1.5 h-3.5 w-3.5" />
                        Pause
                      </Button>
                    ) : journey.status === 'paused' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => changeStatus(journey.id, 'live')}
                      >
                        <Play className="mr-1.5 h-3.5 w-3.5" />
                        Resume
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" asChild>
                      <Link href={`/admin/marketing/journeys/${journey.id}`}>Open</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
