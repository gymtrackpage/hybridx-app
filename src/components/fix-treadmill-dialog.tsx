// src/components/fix-treadmill-dialog.tsx
//
// "Fix treadmill file" flow, offered after linking a Strava activity to a
// run session (or for any already-linked run).
//
// Watches usually record treadmill runs with bad distance/pace. This dialog
// lets the user confirm (or adjust) the workout structure they actually ran —
// prefilled from the prescribed workout — and then rebuilds the Strava file:
// the corrected paces/durations/incline combined with the real heart-rate and
// cadence recorded by the watch. The rebuilt file is uploaded to Strava as a
// new activity and the session is re-linked to it; Strava's API cannot
// replace the file of an existing activity, so the user is prompted to delete
// the original afterwards.
'use client';

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { WorkoutSession } from '@/models/types';
import { hasRuns } from '@/lib/type-guards';
import {
  plannedRunsToDrafts,
  activityToDrafts,
  flattenDrafts,
  computeSegment,
  computeTotals,
  fmtHMS,
  fmtMinSecTotal,
  secPerKmToPaceStr,
  nextDraftId,
  type TreadmillSegmentDraft,
  type SensorAlign,
} from '@/lib/treadmill';
import {
  Loader2,
  Wrench,
  Plus,
  Trash2,
  Copy,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  HeartPulse,
  Clock,
  MapPin,
} from 'lucide-react';

interface ActivitySummary {
  id: string;
  name: string;
  moving_time: number;
  elapsed_time: number;
  distance: number;
  average_heartrate?: number;
}

interface FixTreadmillDialogProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  session: WorkoutSession;
  /** Pass when the caller already has the linked activity (e.g. right after linking). */
  activity?: ActivitySummary | null;
  /** Called when the fix flow finishes (uploaded, or user closed the done
   *  screen). Responsible for closing/unmounting the dialog — the dialog does
   *  not call setIsOpen(false) itself on completion. */
  onComplete: () => void;
}

type Step = 'edit' | 'uploading' | 'done' | 'duplicate';

interface FixResult {
  newActivityUrl: string;
  originalActivityUrl: string;
  hadHeartRate: boolean;
}

export function FixTreadmillDialog({
  isOpen,
  setIsOpen,
  session,
  activity: activityProp,
  onComplete,
}: FixTreadmillDialogProps) {
  const [activity, setActivity] = useState<ActivitySummary | null>(activityProp ?? null);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [drafts, setDrafts] = useState<TreadmillSegmentDraft[]>([]);
  const [name, setName] = useState('');
  const [alignRealtime, setAlignRealtime] = useState(false);
  const [step, setStep] = useState<Step>('edit');
  const [result, setResult] = useState<FixResult | null>(null);
  const [duplicateUrl, setDuplicateUrl] = useState<string | null>(null);
  const { toast } = useToast();

  // Load the linked activity's details when not supplied by the caller
  useEffect(() => {
    if (!isOpen) return;
    setStep('edit');
    setResult(null);
    setDuplicateUrl(null);

    if (activityProp) {
      setActivity(activityProp);
      return;
    }
    if (!session.stravaId) return;

    const load = async () => {
      setLoadingActivity(true);
      try {
        const res = await fetch(`/api/strava/activities/${session.stravaId}`, {
          credentials: 'include',
        });
        if (!res.ok) throw new Error('Could not load the linked Strava activity.');
        const data = await res.json();
        setActivity({
          id: String(data.id),
          name: data.name,
          moving_time: data.moving_time,
          elapsed_time: data.elapsed_time,
          distance: data.distance,
          average_heartrate: data.average_heartrate,
        });
      } catch (err) {
        logger.error('FixTreadmillDialog: failed to load activity', err);
        toast({
          title: 'Error',
          description: err instanceof Error ? err.message : 'Failed to load activity.',
          variant: 'destructive',
        });
        setIsOpen(false);
      } finally {
        setLoadingActivity(false);
      }
    };
    load();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Prefill segments: prescribed workout first, actual activity as fallback
  useEffect(() => {
    if (!isOpen) return;
    const planned = hasRuns(session.workoutDetails) ? session.workoutDetails.runs : [];
    if (planned.length > 0) {
      setDrafts(plannedRunsToDrafts(planned));
    } else if (activity) {
      setDrafts(activityToDrafts(activity.moving_time, activity.distance));
    }
    setName(session.workoutTitle || activity?.name || 'Treadmill Run');
  }, [isOpen, activity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { segments, hasErrors } = useMemo(() => flattenDrafts(drafts), [drafts]);
  const totals = useMemo(() => computeTotals(segments), [segments]);

  const durationMismatch = useMemo(() => {
    if (!activity || !activity.moving_time || totals.timeSec <= 0) return false;
    return Math.abs(totals.timeSec - activity.moving_time) / activity.moving_time > 0.15;
  }, [activity, totals.timeSec]);

  const updateDraft = (id: number, patch: Partial<TreadmillSegmentDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  const removeDraft = (id: number) => setDrafts((ds) => ds.filter((d) => d.id !== id));

  const duplicateDraft = (id: number) =>
    setDrafts((ds) => {
      const i = ds.findIndex((d) => d.id === id);
      if (i === -1) return ds;
      const copy = { ...ds[i], id: nextDraftId() };
      return [...ds.slice(0, i + 1), copy, ...ds.slice(i + 1)];
    });

  const addDraft = () =>
    setDrafts((ds) => [
      ...ds,
      {
        id: nextDraftId(),
        name: `Segment ${ds.length + 1}`,
        mode: 'time',
        value: '10:00',
        pace: '6:00',
        incline: '0',
      },
    ]);

  const handleConfirm = async () => {
    if (hasErrors || segments.length === 0) return;
    setStep('uploading');
    try {
      const res = await fetch('/api/strava/fix-treadmill', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          segments,
          name,
          sensorAlign: (alignRealtime ? 'realtime' : 'stretch') satisfies SensorAlign,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 409 && data.code === 'DUPLICATE') {
        setDuplicateUrl(`https://www.strava.com/activities/${data.duplicateOfId}`);
        setStep('duplicate');
        return;
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      setResult({
        newActivityUrl: data.newActivityUrl,
        originalActivityUrl: data.originalActivityUrl,
        hadHeartRate: data.hadHeartRate,
      });
      setStep('done');
    } catch (err) {
      logger.error('FixTreadmillDialog: fix failed', err);
      toast({
        title: 'Fix failed',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
      setStep('edit');
    }
  };

  const finish = () => {
    onComplete();
  };

  const paceHint = (d: TreadmillSegmentDraft): string | null => {
    const c = computeSegment(d);
    if (!c) return null;
    return `${(c.speedMps * 3.6).toFixed(1)} km/h · ${fmtHMS(c.timeSec)} · ${(c.distanceM / 1000).toFixed(2)} km`;
  };

  /* ── render ── */

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // After a successful upload, any close counts as flow completion so
        // callers refresh the (re-linked) session.
        if (!open && step === 'done') return finish();
        setIsOpen(open);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {step === 'edit' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Wrench className="h-4 w-4" /> Fix Treadmill File
              </DialogTitle>
              <DialogDescription>
                Confirm what you actually ran. We&apos;ll rebuild the Strava file with these paces and
                the heart rate &amp; cadence your watch recorded, then upload it as a corrected activity.
              </DialogDescription>
            </DialogHeader>

            {loadingActivity ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <>
                {activity && (
                  <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border p-2.5">
                    <span className="font-medium text-foreground truncate max-w-[12rem]">{activity.name}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {fmtHMS(activity.moving_time)}
                    </span>
                    {activity.distance > 0 && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {(activity.distance / 1000).toFixed(2)} km recorded
                      </span>
                    )}
                    {activity.average_heartrate ? (
                      <span className="flex items-center gap-1">
                        <HeartPulse className="h-3 w-3" />
                        {Math.round(activity.average_heartrate)} bpm avg
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
                        <HeartPulse className="h-3 w-3" /> no HR recorded
                      </span>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="fix-name" className="text-xs">
                    Activity name
                  </Label>
                  <Input id="fix-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
                </div>

                <ScrollArea className="max-h-64 -mx-1 px-1">
                  <div className="space-y-2">
                    {drafts.map((d) => (
                      <div key={d.id} className="rounded-xl border p-2.5 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            value={d.name}
                            onChange={(e) => updateDraft(d.id, { name: e.target.value })}
                            className="h-7 text-sm flex-1"
                            placeholder="Segment name"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            onClick={() => duplicateDraft(d.id)}
                            title="Duplicate segment"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 text-destructive"
                            onClick={() => removeDraft(d.id)}
                            disabled={drafts.length <= 1}
                            title="Remove segment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <button
                              type="button"
                              className="text-[10px] uppercase tracking-wide text-muted-foreground underline decoration-dotted"
                              onClick={() => {
                                const c = computeSegment(d);
                                if (d.mode === 'time') {
                                  updateDraft(d.id, {
                                    mode: 'distance',
                                    value: c ? (c.distanceM / 1000).toFixed(2) : d.value,
                                  });
                                } else {
                                  updateDraft(d.id, {
                                    mode: 'time',
                                    value: c ? fmtMinSecTotal(c.timeSec) : d.value,
                                  });
                                }
                              }}
                              title="Toggle between time and distance"
                            >
                              {d.mode === 'time' ? 'Time (mm:ss)' : 'Distance (km)'}
                            </button>
                            <Input
                              value={d.value}
                              onChange={(e) => updateDraft(d.id, { value: e.target.value })}
                              className={`h-7 text-sm ${computeSegment(d) === null ? 'border-destructive' : ''}`}
                              inputMode="decimal"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Pace /km
                            </span>
                            <Input
                              value={d.pace}
                              onChange={(e) => updateDraft(d.id, { pace: e.target.value })}
                              className="h-7 text-sm"
                              inputMode="decimal"
                              placeholder="5:30"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                              Incline %
                            </span>
                            <Input
                              value={d.incline}
                              onChange={(e) => updateDraft(d.id, { incline: e.target.value })}
                              className="h-7 text-sm"
                              inputMode="decimal"
                            />
                          </div>
                        </div>
                        {paceHint(d) && (
                          <p className="text-[11px] text-muted-foreground">{paceHint(d)}</p>
                        )}
                      </div>
                    ))}
                    <Button variant="outline" size="sm" className="w-full" onClick={addDraft}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add segment
                    </Button>
                  </div>
                </ScrollArea>

                <div className="rounded-lg bg-muted/60 p-2.5 text-xs flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span>
                    Total: <strong>{fmtHMS(totals.timeSec)}</strong> ·{' '}
                    <strong>{(totals.distanceM / 1000).toFixed(2)} km</strong>
                    {totals.timeSec > 0 && (
                      <> · avg {secPerKmToPaceStr(totals.timeSec / (totals.distanceM / 1000))}/km</>
                    )}
                  </span>
                  {activity && activity.moving_time > 0 && (
                    <span className={durationMismatch ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}>
                      Watch recorded {fmtHMS(activity.moving_time)}
                    </span>
                  )}
                </div>

                {durationMismatch && (
                  <Alert className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Your planned total differs from the recorded time by more than 15%. Adjust the
                      segments to match what you actually ran, or the heart-rate data will be stretched
                      to fit.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex items-center justify-between rounded-lg border p-2.5">
                  <div className="space-y-0.5 pr-3">
                    <Label htmlFor="fix-align" className="text-xs">
                      Keep sensor data in real time
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Off: heart rate is stretched to fit the workout. On: mapped second-for-second from
                      the start.
                    </p>
                  </div>
                  <Switch id="fix-align" checked={alignRealtime} onCheckedChange={setAlignRealtime} />
                </div>
              </>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={loadingActivity || hasErrors || segments.length === 0}>
                <Wrench className="mr-2 h-4 w-4" /> Fix &amp; Upload
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'uploading' && (
          <div className="py-10 text-center space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="font-medium">Rebuilding your treadmill file…</p>
            <p className="text-sm text-muted-foreground">
              Merging your heart rate with the corrected paces and uploading to Strava. This can take
              up to 30 seconds.
            </p>
          </div>
        )}

        {step === 'done' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" /> File Fixed
              </DialogTitle>
              <DialogDescription>
                The corrected activity is on Strava and this workout is now linked to it
                {result.hadHeartRate ? ', with your recorded heart rate merged in' : ''}.
              </DialogDescription>
            </DialogHeader>

            <Alert className="py-2.5">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle className="text-sm">One last step</AlertTitle>
              <AlertDescription className="text-xs">
                Strava doesn&apos;t let apps delete activities, so the original (incorrect) one is still
                there. Open it below and delete it to avoid a duplicate in your feed and training stats.
              </AlertDescription>
            </Alert>

            <div className="grid gap-2">
              <Button asChild>
                <a href={result.newActivityUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" /> View corrected activity
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={result.originalActivityUrl} target="_blank" rel="noopener noreferrer">
                  <Trash2 className="mr-2 h-4 w-4" /> Open original to delete it
                </a>
              </Button>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={finish}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'duplicate' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Strava Blocked the Upload
              </DialogTitle>
              <DialogDescription>
                Strava sees the corrected file as a duplicate because it covers the same time as the
                original activity. Delete the original on Strava first, then retry the upload.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2">
              {duplicateUrl && (
                <Button asChild variant="outline">
                  <a href={duplicateUrl} target="_blank" rel="noopener noreferrer">
                    <Trash2 className="mr-2 h-4 w-4" /> Open original to delete it
                  </a>
                </Button>
              )}
              <Button onClick={handleConfirm}>
                <Wrench className="mr-2 h-4 w-4" /> Retry upload
              </Button>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep('edit')}>
                Back to editing
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
