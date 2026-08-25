'use client';

import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { setSendingPaused, updateSettings } from '@/lib/marketing/actions';
import type { MarketingSettings } from '@/lib/marketing/types';

interface Health {
  transportConfigured: boolean;
  tokenSecretConfigured: boolean;
  bridgeConfigured: boolean;
  sharesTransactionalSender: boolean;
  senderDomain: string | null;
  appUrl: string | null;
  fromAddress: string | null;
}

export function MarketingSettingsForm({
  settings,
  health,
}: {
  settings: MarketingSettings;
  health: Health;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [paused, setPaused] = useState(settings.sendingPaused);
  const [form, setForm] = useState({
    senderName: settings.senderName,
    replyTo: settings.replyTo,
    batchSize: settings.batchSize,
    frequencyCapPerWeek: settings.frequencyCapPerWeek,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await updateSettings({
      senderName: form.senderName,
      replyTo: form.replyTo,
      batchSize: Number(form.batchSize),
      frequencyCapPerWeek: Number(form.frequencyCapPerWeek),
    });
    setSaving(false);

    toast(
      result.success
        ? { title: 'Settings saved' }
        : { title: 'Could not save', description: result.error, variant: 'destructive' },
    );
  };

  const handlePauseToggle = async (next: boolean) => {
    setPaused(next);
    const result = await setSendingPaused(next);
    if (!result.success) {
      setPaused(!next);
      toast({ title: 'Could not change', description: result.error, variant: 'destructive' });
      return;
    }
    toast({
      title: next ? 'Sending paused' : 'Sending resumed',
      description: next
        ? 'No campaign or journey will send until this is switched back on.'
        : 'Queued campaigns resume on the next send run.',
    });
  };

  const checks = [
    {
      ok: health.transportConfigured,
      label: 'Brevo SMTP credentials',
      detail: health.transportConfigured
        ? 'Configured'
        : 'Missing BREVO_SMTP_USER / BREVO_SMTP_KEY — campaigns cannot send.',
    },
    {
      ok: health.tokenSecretConfigured,
      label: 'Link signing secret',
      detail: health.tokenSecretConfigured
        ? 'Configured'
        : 'Missing MARKETING_TOKEN_SECRET — unsubscribe links cannot be signed, so sending is blocked.',
    },
    {
      ok: health.bridgeConfigured,
      label: 'Marketing-site bridge',
      detail: health.bridgeConfigured
        ? 'Configured — hybridx.club can push leads in and read the suppression list.'
        : 'LEAD_BRIDGE_SECRET is unset, so leads captured on hybridx.club will not reach this list.',
    },
    {
      ok: !!health.appUrl,
      label: 'Public app URL',
      detail: health.appUrl ?? 'NEXT_PUBLIC_APP_URL is unset — tracking and unsubscribe links would be broken.',
    },
    {
      ok: !!health.fromAddress,
      label: 'From address',
      detail: health.fromAddress ?? 'No MARKETING_EMAIL_FROM or EMAIL_FROM configured.',
    },
    {
      // Not a blocker — the fix is DNS and a warmed subdomain, which cannot be
      // done from here. But it should be visible before a send rather than
      // discovered when verification email stops arriving.
      ok: !health.sharesTransactionalSender,
      label: 'Separate bulk sender',
      detail: health.sharesTransactionalSender
        ? `Campaigns send from ${health.fromAddress}, the same address as verification email. ` +
          'A campaign that draws complaints will degrade delivery of mail people are waiting for. ' +
          'Point MARKETING_EMAIL_FROM at a dedicated, authenticated subdomain.'
        : `Campaigns send from ${health.senderDomain ?? 'a separate address'}, apart from transactional mail.`,
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Delivery health</CardTitle>
          <CardDescription>
            Read from the running server, so this reflects what is actually configured.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {checks.map((c) => (
              <li key={c.label} className="flex items-start gap-3">
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="break-words text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className={paused ? 'border-orange-500/50' : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-orange-500" />
            Sending switch
          </CardTitle>
          <CardDescription>
            Stops every campaign and journey at the next send run without losing queued work.
            Turning it back on resumes exactly where things stopped.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <Label htmlFor="paused" className="text-sm sm:text-base">
            {paused ? 'Sending is paused' : 'Sending is live'}
          </Label>
          <Switch id="paused" checked={paused} onCheckedChange={handlePauseToggle} />
        </CardContent>
      </Card>

      <form onSubmit={handleSave}>
        <Card>
          <CardHeader>
            <CardTitle>Sender and throughput</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="senderName">Sender name</Label>
              <Input
                id="senderName"
                value={form.senderName}
                onChange={(e) => setForm({ ...form, senderName: e.target.value })}
                placeholder="HYBRIDX"
              />
              <p className="text-xs text-muted-foreground">
                The From address itself is an environment secret, not editable here.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="replyTo">Reply-to address</Label>
              <Input
                id="replyTo"
                type="email"
                value={form.replyTo}
                onChange={(e) => setForm({ ...form, replyTo: e.target.value })}
                placeholder="training@hybridx.club"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="batchSize">Messages per send run</Label>
                <Input
                  id="batchSize"
                  type="number"
                  min={1}
                  max={2000}
                  value={form.batchSize}
                  onChange={(e) => setForm({ ...form, batchSize: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">
                  The send cron runs every minute; a larger campaign simply spans more runs.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="frequencyCap">Max emails per person per week</Label>
                <Input
                  id="frequencyCap"
                  type="number"
                  min={1}
                  max={20}
                  value={form.frequencyCapPerWeek}
                  onChange={(e) =>
                    setForm({ ...form, frequencyCapPerWeek: Number(e.target.value) })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Shared budget across campaigns and journeys, so an automation and a broadcast
                  cannot double up on the same athlete.
                </p>
              </div>
            </div>

            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save settings
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
