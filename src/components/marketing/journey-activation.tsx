'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, Send, Zap } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { sendTestEmail } from '@/lib/marketing/actions';
import { activateJourney } from '@/lib/marketing/studio-actions';

interface Props {
  journeyId: string;
  status: string;
  trigger: string;
  problems: string[];
  firstCampaignId?: string;
}

/**
 * The gate between a draft and a live automation.
 *
 * A live journey emails real athletes with nobody watching, so activation is
 * deliberately more work than a single button: structural problems block it,
 * and anything that fires automatically requires an explicit confirmation that
 * a test send was actually read.
 */
export function JourneyActivation({
  journeyId,
  status,
  trigger,
  problems,
  firstCampaignId,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [activating, setActivating] = useState(false);

  if (status === 'live') {
    return (
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertTitle>This journey is live</AlertTitle>
        <AlertDescription>
          Athletes are enrolled automatically as the trigger fires. Pause it from the journeys list
          to stop without losing anyone&apos;s place.
        </AlertDescription>
      </Alert>
    );
  }

  if (status === 'archived') return null;

  const isAutomated = trigger !== 'manual' && trigger !== 'scheduled';
  const blocked = problems.length > 0 || (isAutomated && !reviewed);

  const handleTest = async () => {
    if (!firstCampaignId || !testEmail) return;
    setSendingTest(true);
    const result = await sendTestEmail(firstCampaignId, testEmail);
    setSendingTest(false);

    toast(
      result.success
        ? { title: 'Test sent', description: `Check ${testEmail}.` }
        : { title: 'Test failed', description: result.error, variant: 'destructive' },
    );
  };

  const handleActivate = async () => {
    setActivating(true);
    const result = await activateJourney(journeyId, { testSendReviewed: reviewed });
    setActivating(false);

    if (result.success) {
      toast({ title: 'Journey is live' });
      router.refresh();
    } else {
      toast({ title: 'Could not activate', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Go live</CardTitle>
        <CardDescription>
          {isAutomated
            ? 'This journey will email athletes automatically once it is live. Send yourself a test first.'
            : 'This journey is sent by hand, so nothing happens until you send it.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {problems.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Not ready</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 list-inside list-disc space-y-1">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {firstCampaignId && (
          <div className="space-y-2">
            <Label htmlFor="test-email">Send a test</Label>
            <div className="flex gap-2">
              <Input
                id="test-email"
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="you@hybridx.club"
              />
              <Button variant="outline" onClick={handleTest} disabled={sendingTest || !testEmail}>
                {sendingTest ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send test
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Sends the first email with tracking disabled, so a preview never distorts the
              campaign&apos;s figures.
            </p>
          </div>
        )}

        {isAutomated && (
          <div className="flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="reviewed"
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="reviewed" className="text-sm font-normal leading-relaxed">
              I have sent myself a test, read every email in this journey, and I understand it will
              send to real athletes without further review.
            </Label>
          </div>
        )}

        <Button onClick={handleActivate} disabled={blocked || activating}>
          {activating ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Zap className="mr-2 h-4 w-4" />
          )}
          Activate journey
        </Button>
      </CardContent>
    </Card>
  );
}
