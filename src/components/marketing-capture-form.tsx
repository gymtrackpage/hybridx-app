// src/components/marketing-capture-form.tsx
'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAttribution } from '@/lib/attribution';

interface Props {
  /** Free-form tag recorded against the lead, e.g. 'homepage-hero'. */
  placement?: string;
  className?: string;
}

/**
 * Newsletter capture for the marketing site.
 *
 * Submitting is the opt-in, and the copy says so directly above the button —
 * consent has to be informed to be worth anything, and a form that quietly
 * enrols people produces a list that cannot lawfully be mailed.
 */
export function MarketingCaptureForm({ placement = 'landing', className }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setState('submitting');

    try {
      const attribution = getAttribution();
      const res = await fetch('/api/marketing/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          consent: true,
          tags: [placement],
          attribution: attribution
            ? {
                utmSource: attribution.utmSource,
                utmMedium: attribution.utmMedium,
                utmCampaign: attribution.utmCampaign,
                utmTerm: attribution.utmTerm,
                utmContent: attribution.utmContent,
                landingPage: attribution.landingPage,
                referrer: attribution.referrer,
              }
            : undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? 'Something went wrong. Please try again.');
      }
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setState('idle');
    }
  };

  if (state === 'done') {
    return (
      <div className={className}>
        <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
          <p className="text-sm">
            You&apos;re on the list. Look out for HYROX training tips and race guides.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="First name (optional)"
          autoComplete="given-name"
          className="sm:max-w-[180px]"
          disabled={state === 'submitting'}
        />
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          disabled={state === 'submitting'}
          aria-label="Email address"
        />
        <Button type="submit" disabled={state === 'submitting' || !email}>
          {state === 'submitting' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Get training tips
        </Button>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        By subscribing you agree to receive HYROX training tips and product news from HYBRIDX. No
        spam, and you can unsubscribe from any email.
      </p>

      {error && (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
