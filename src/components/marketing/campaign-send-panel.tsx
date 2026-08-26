'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CalendarClock, CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  preSendCheck,
  scheduleCampaign,
  sendCampaignNow,
  sendTestEmail,
  setCampaignAudience,
} from '@/lib/marketing/actions';
import type { SegmentDefinition } from '@/lib/marketing/segments';
import { AudiencePicker } from './audience-picker';

interface Props {
  campaignId: string;
  status: string;
  initialSegment: SegmentDefinition;
  tags: Array<{ tag: string; count: number }>;
}

export function CampaignSendPanel({ campaignId, status, initialSegment, tags }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  const [segment, setSegment] = useState<SegmentDefinition>(initialSegment);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [busy, setBusy] = useState(false);

  const [checkOpen, setCheckOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{
    audienceSize: number;
    warnings: string[];
    blockers: string[];
  } | null>(null);

  const editable = status === 'draft' || status === 'scheduled';

  if (!editable) {
    return null;
  }

  const persistSegment = async (next: SegmentDefinition) => {
    setSegment(next);
    // Saved as it changes so the checklist and the enqueue resolve exactly what
    // is on screen, rather than a definition held only in this component.
    await setCampaignAudience(campaignId, next);
  };

  const handleTest = async () => {
    if (!testEmail) return;
    setSendingTest(true);
    const result = await sendTestEmail(campaignId, testEmail);
    setSendingTest(false);

    toast(
      result.success
        ? { title: 'Test sent', description: `Check ${testEmail}.` }
        : { title: 'Test failed', description: result.error, variant: 'destructive' },
    );
  };

  /** Always run the checks before offering the button, never during the send. */
  const openChecklist = async () => {
    setChecking(true);
    setCheckOpen(true);
    const result = await preSendCheck(campaignId, segment);
    setChecking(false);

    if (result.success) setCheck(result.data);
    else {
      setCheckOpen(false);
      toast({ title: 'Could not run checks', description: result.error, variant: 'destructive' });
    }
  };

  const handleSend = async () => {
    setBusy(true);
    const result = await sendCampaignNow(campaignId, segment);
    setBusy(false);
    setCheckOpen(false);

    if (result.success) {
      toast({
        title: 'Campaign queued',
        description: `${result.data.queued.toLocaleString()} messages queued. The send cron delivers them.`,
      });
      router.refresh();
    } else {
      toast({ title: 'Could not send', description: result.error, variant: 'destructive' });
    }
  };

  const handleSchedule = async () => {
    if (!scheduleAt) return;
    setBusy(true);
    await setCampaignAudience(campaignId, segment);
    const result = await scheduleCampaign(campaignId, new Date(scheduleAt));
    setBusy(false);

    if (result.success) {
      toast({ title: 'Scheduled', description: new Date(scheduleAt).toLocaleString() });
      router.refresh();
    } else {
      toast({ title: 'Could not schedule', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle>Audience and sending</CardTitle>
          <CardDescription>
            Choose who receives this, send yourself a test, then send or schedule it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 p-4 pt-0 sm:p-6 sm:pt-0">
          <AudiencePicker tags={tags} value={segment} onChange={persistSegment} disabled={busy} />

          <div className="space-y-2">
            <Label htmlFor="test-email">Send a test</Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@hybridx.club"
              />
              <Button
                variant="outline"
                className="sm:shrink-0"
                onClick={handleTest}
                disabled={sendingTest || !testEmail}
              >
                {sendingTest ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Test
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sent without tracking, so a preview never distorts this campaign&apos;s figures.
            </p>
          </div>

          {/* Send is the primary action, so on a phone it gets its own
              full-width row above the scheduling controls. */}
          <div className="space-y-4 border-t pt-4 sm:flex sm:flex-wrap sm:items-end sm:gap-3 sm:space-y-0">
            <Button className="w-full sm:w-auto" onClick={openChecklist} disabled={busy}>
              <Send className="mr-2 h-4 w-4" />
              Review and send
            </Button>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="space-y-1">
                <Label htmlFor="schedule-at" className="text-xs">
                  Or schedule for
                </Label>
                <Input
                  id="schedule-at"
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(e) => setScheduleAt(e.target.value)}
                  className="w-full sm:w-[220px]"
                />
              </div>
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                onClick={handleSchedule}
                disabled={busy || !scheduleAt}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                Schedule
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={checkOpen} onOpenChange={setCheckOpen}>
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto sm:w-full">
          <DialogHeader>
            <DialogTitle>Before you send</DialogTitle>
            <DialogDescription>
              These checks run against live configuration and the resolved audience.
            </DialogDescription>
          </DialogHeader>

          {checking || !check ? (
            <div className="flex items-center gap-3 py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Running checks…</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border p-3">
                <p className="text-sm">
                  This will send to{' '}
                  <strong>{check.audienceSize.toLocaleString()}</strong>{' '}
                  {check.audienceSize === 1 ? 'person' : 'people'}.
                </p>
              </div>

              {check.blockers.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Cannot send</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 list-inside list-disc space-y-1">
                      {check.blockers.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {check.warnings.length > 0 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Worth checking</AlertTitle>
                  <AlertDescription>
                    <ul className="mt-1 list-inside list-disc space-y-1">
                      {check.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {check.blockers.length === 0 && check.warnings.length === 0 && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Ready to send</AlertTitle>
                  <AlertDescription>Everything checks out.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCheckOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={busy || checking || !check || check.blockers.length > 0}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Send to {check?.audienceSize.toLocaleString() ?? '…'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
