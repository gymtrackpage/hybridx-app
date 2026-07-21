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

import { useState, useEffect, useMemo, useRef } from 'react';
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
  plannedRunsToText,
  activityToDrafts,
  aiSegmentsToDrafts,
  flattenDrafts,
  computeSegment,
  computeTotals,
  fmtHMS,
  fmtMinSecTotal,
  secPerKmToPaceStr,
  parseDurationSec,
  parseDistanceKmToMeters,
  parsePaceSecPerKm,
  parseIncline,
  nextDraftId,
  type TreadmillSegmentDraft,
  type SensorAlign,
} from '@/lib/treadmill';
import { parseTreadmillWorkout } from '@/ai/flows/parse-treadmill-workout';
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
  Sparkles,
  RotateCcw,
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

/** Where the current segment prefill came from. */
type PrefillSource = 'notes' | 'both' | 'planned' | 'activity' | 'blank';

/** Lifecycle of the automatic AI parse of notes / planned workout. */
type AiParseState = 'idle' | 'parsing' | 'applied' | 'ready' | 'empty' | 'failed';

const PREFILL_LABEL: Record<PrefillSource, string> = {
  notes: 'your workout notes',
  both: 'your notes + planned workout',
  planned: 'the planned workout',
  activity: 'the recorded activity',
  blank: 'scratch',
};

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
  // Set when the live Strava lookup failed — typically because the user
  // deleted the original activity to clear Strava's duplicate-upload block.
  // The fix itself still works (the server cached what it needs on the first
  // attempt), so this only affects what the summary badge can show.
  const [activityStale, setActivityStale] = useState(false);
  const [drafts, setDrafts] = useState<TreadmillSegmentDraft[]>([]);
  const [name, setName] = useState('');
  const [alignRealtime, setAlignRealtime] = useState(false);
  const [step, setStep] = useState<Step>('edit');
  const [result, setResult] = useState<FixResult | null>(null);
  const [duplicateUrl, setDuplicateUrl] = useState<string | null>(null);
  const [prefillSource, setPrefillSource] = useState<PrefillSource>('blank');
  const [aiState, setAiState] = useState<AiParseState>('idle');
  const [aiDrafts, setAiDrafts] = useState<TreadmillSegmentDraft[] | null>(null);
  const [aiSource, setAiSource] = useState<PrefillSource>('notes');
  // Once the user touches the segments, the async AI result must not
  // overwrite their edits — it becomes a one-tap "Apply" offer instead.
  const userEditedRef = useRef(false);
  const { toast } = useToast();

  const plannedRuns = useMemo(
    () => (hasRuns(session.workoutDetails) ? session.workoutDetails.runs : []),
    [session.workoutDetails],
  );

  // Load the linked activity's details when not supplied by the caller
  useEffect(() => {
    if (!isOpen) return;
    setStep('edit');
    setResult(null);
    setDuplicateUrl(null);
    setActivityStale(false);

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
        logger.warn('FixTreadmillDialog: live activity lookup failed, falling back', err);
        // Most likely cause: the user already deleted the original on Strava
        // to clear a duplicate-upload block from an earlier attempt. The fix
        // itself doesn't need this — the server cached the original's start
        // time and sensor streams the first time it read them — so fall back
        // to the summary saved on the session at link time (if any) instead
        // of blocking the user from retrying.
        setActivityStale(true);
        if (session.stravaActivity) {
          setActivity({
            id: session.stravaId!,
            name: session.stravaActivity.name || session.workoutTitle || 'Treadmill Run',
            moving_time: session.stravaActivity.moving_time || 0,
            elapsed_time: session.stravaActivity.moving_time || 0,
            distance: session.stravaActivity.distance || 0,
          });
        } else {
          setActivity(null);
        }
      } finally {
        setLoadingActivity(false);
      }
    };
    load();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Instant deterministic prefill so the dialog is usable immediately:
  // prescribed workout first, actual activity as fallback. The AI parse of
  // the notes (below) replaces this as soon as it lands, unless the user has
  // already started editing.
  useEffect(() => {
    if (!isOpen) return;
    setName(session.workoutTitle || activity?.name || 'Treadmill Run');
    // Never overwrite manual edits or an already-applied AI parse (the
    // activity can finish loading after the AI result has landed).
    if (userEditedRef.current || aiState === 'applied') return;
    if (plannedRuns.length > 0) {
      setDrafts(plannedRunsToDrafts(plannedRuns));
      setPrefillSource('planned');
    } else if (activity) {
      setDrafts(activityToDrafts(activity.moving_time, activity.distance));
      setPrefillSource('activity');
    }
  }, [isOpen, activity?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Automatic AI parse: digest the workout notes (what was actually run),
  // falling back to the planned workout text, into structured segments.
  useEffect(() => {
    if (!isOpen) {
      setAiState('idle');
      setAiDrafts(null);
      userEditedRef.current = false;
      return;
    }
    const notes = (session.notes || '').trim();
    if (!notes && plannedRuns.length === 0) {
      setAiState('empty');
      return;
    }
    let cancelled = false;
    setAiState('parsing');
    setAiDrafts(null);
    parseTreadmillWorkout({
      workoutTitle: session.workoutTitle || undefined,
      notes: notes || undefined,
      plannedWorkout: plannedRuns.length > 0 ? plannedRunsToText(plannedRuns) : undefined,
      activityMovingTimeSec: activityProp?.moving_time || undefined,
    })
      .then((res) => {
        if (cancelled) return;
        const parsed = aiSegmentsToDrafts(res.segments);
        if (parsed.length === 0 || res.source === 'none') {
          setAiState('empty');
          return;
        }
        const source: PrefillSource =
          res.source === 'both' ? 'both' : res.source === 'planned' ? 'planned' : 'notes';
        setAiSource(source);
        setAiDrafts(parsed);
        if (userEditedRef.current) {
          // Don't clobber manual edits — offer the parsed result instead.
          setAiState('ready');
        } else {
          setDrafts(parsed);
          setPrefillSource(source);
          setAiState('applied');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        logger.error('FixTreadmillDialog: AI notes parse failed', err);
        setAiState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const { segments, hasErrors } = useMemo(() => flattenDrafts(drafts), [drafts]);
  const totals = useMemo(() => computeTotals(segments), [segments]);

  const durationMismatch = useMemo(() => {
    if (!activity || !activity.moving_time || totals.timeSec <= 0) return false;
    return Math.abs(totals.timeSec - activity.moving_time) / activity.moving_time > 0.15;
  }, [activity, totals.timeSec]);

  const updateDraft = (id: number, patch: Partial<TreadmillSegmentDraft>) => {
    userEditedRef.current = true;
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  };

  const removeDraft = (id: number) => {
    userEditedRef.current = true;
    setDrafts((ds) => ds.filter((d) => d.id !== id));
  };

  const duplicateDraft = (id: number) => {
    userEditedRef.current = true;
    setDrafts((ds) => {
      const i = ds.findIndex((d) => d.id === id);
      if (i === -1) return ds;
      const copy = { ...ds[i], id: nextDraftId() };
      return [...ds.slice(0, i + 1), copy, ...ds.slice(i + 1)];
    });
  };

  const addDraft = () => {
    userEditedRef.current = true;
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
  };

  const applyAiDrafts = () => {
    if (!aiDrafts) return;
    userEditedRef.current = true;
    setDrafts(aiDrafts);
    setPrefillSource(aiSource);
    setAiState('applied');
  };

  const resetToPlanned = () => {
    if (plannedRuns.length === 0) return;
    userEditedRef.current = true;
    setDrafts(plannedRunsToDrafts(plannedRuns));
    setPrefillSource('planned');
    if (aiState === 'applied') setAiState('ready');
  };

  const handleConfirm = async () => {
    if (hasErrors || segments.length === 0) return;
    // A late AI result must not replace the segments being uploaded.
    userEditedRef.current = true;
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

  const valueInvalid = (d: TreadmillSegmentDraft) =>
    d.mode === 'time'
      ? parseDurationSec(d.value) === null
      : parseDistanceKmToMeters(d.value) === null;
  const paceInvalid = (d: TreadmillSegmentDraft) => parsePaceSecPerKm(d.pace) === null;
  const inclineInvalid = (d: TreadmillSegmentDraft) => parseIncline(d.incline) === null;

  const setMode = (d: TreadmillSegmentDraft, mode: 'time' | 'distance') => {
    if (d.mode === mode) return;
    // Converting preserves the segment: same pace, equivalent value.
    const c = computeSegment(d);
    updateDraft(d.id, {
      mode,
      value: c
        ? mode === 'distance'
          ? (c.distanceM / 1000).toFixed(2)
          : fmtMinSecTotal(c.timeSec)
        : d.value,
    });
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

                {activityStale && (
                  <Alert className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      {activity
                        ? "Couldn't reach the original Strava activity — showing the details saved when it was linked."
                        : "Couldn't reach the original Strava activity, and no saved details are available."}{' '}
                      This is expected if you deleted it to clear a duplicate-upload block; the fix can
                      still proceed using the data read the first time you tried.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="fix-name" className="text-xs">
                    Activity name
                  </Label>
                  <Input id="fix-name" value={name} onChange={(e) => setName(e.target.value)} className="h-8" />
                </div>

                {aiState === 'parsing' && (
                  <div className="flex items-center gap-2 rounded-lg border border-dashed p-2.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    Reading your workout notes to prefill the segments…
                  </div>
                )}
                {aiState === 'applied' && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border p-2.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>
                      Prefilled from <strong>{PREFILL_LABEL[prefillSource]}</strong> — check and adjust
                      below.
                    </span>
                    {plannedRuns.length > 0 && prefillSource !== 'planned' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs ml-auto"
                        onClick={resetToPlanned}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" /> Use planned instead
                      </Button>
                    )}
                  </div>
                )}
                {aiState === 'ready' && aiDrafts && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border p-2.5 text-xs">
                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>
                      Read {aiDrafts.length} segment{aiDrafts.length === 1 ? '' : 's'} from{' '}
                      {PREFILL_LABEL[aiSource]}.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs ml-auto"
                      onClick={applyAiDrafts}
                    >
                      Apply
                    </Button>
                  </div>
                )}
                {aiState === 'failed' && (
                  <div className="flex items-center gap-2 rounded-lg border p-2.5 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    Couldn&apos;t auto-read your workout notes — edit the segments below manually.
                  </div>
                )}

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
                            <div
                              className="inline-flex rounded-md border p-0.5 gap-0.5"
                              role="group"
                              aria-label="Segment measured by time or distance"
                            >
                              <button
                                type="button"
                                className={`px-1.5 py-0 rounded text-[10px] uppercase tracking-wide leading-4 ${
                                  d.mode === 'time'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setMode(d, 'time')}
                                aria-pressed={d.mode === 'time'}
                              >
                                Time
                              </button>
                              <button
                                type="button"
                                className={`px-1.5 py-0 rounded text-[10px] uppercase tracking-wide leading-4 ${
                                  d.mode === 'distance'
                                    ? 'bg-primary text-primary-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                                onClick={() => setMode(d, 'distance')}
                                aria-pressed={d.mode === 'distance'}
                              >
                                Dist
                              </button>
                            </div>
                            <Input
                              value={d.value}
                              onChange={(e) => updateDraft(d.id, { value: e.target.value })}
                              className={`h-7 text-sm ${valueInvalid(d) ? 'border-destructive' : ''}`}
                              inputMode="decimal"
                              placeholder={d.mode === 'time' ? 'mm:ss' : 'km'}
                              aria-label={d.mode === 'time' ? 'Duration (mm:ss)' : 'Distance (km)'}
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground leading-5 inline-block">
                              Pace /km
                            </span>
                            <Input
                              value={d.pace}
                              onChange={(e) => updateDraft(d.id, { pace: e.target.value })}
                              className={`h-7 text-sm ${paceInvalid(d) ? 'border-destructive' : ''}`}
                              inputMode="decimal"
                              placeholder="5:30"
                              aria-label="Pace per km (mm:ss)"
                            />
                          </div>
                          <div className="space-y-1">
                            <span className="text-[10px] uppercase tracking-wide text-muted-foreground leading-5 inline-block">
                              Incline %
                            </span>
                            <Input
                              value={d.incline}
                              onChange={(e) => updateDraft(d.id, { incline: e.target.value })}
                              className={`h-7 text-sm ${inclineInvalid(d) ? 'border-destructive' : ''}`}
                              inputMode="decimal"
                              placeholder="0"
                              aria-label="Incline percent"
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
                  {hasErrors && (
                    <span className="text-destructive">
                      Fill in the highlighted fields to continue.
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
