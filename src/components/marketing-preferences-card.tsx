// src/components/marketing-preferences-card.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getAuthInstance } from '@/lib/firebase';

/**
 * Marketing email opt-in.
 *
 * Goes through /api/marketing/preferences rather than writing the user document
 * directly: the flag is mirrored onto the athlete's `marketingSubscribers`
 * record, which is what the send path checks, and both must move together.
 */
export function MarketingPreferencesCard() {
  const { toast } = useToast();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const authedFetch = useCallback(async (init?: RequestInit) => {
    const auth = await getAuthInstance();
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error('You must be logged in.');
    const idToken = await currentUser.getIdToken();
    return fetch('/api/marketing/preferences', {
      ...init,
      headers: { ...init?.headers, 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authedFetch();
        if (!res.ok) throw new Error('Could not load your preference.');
        const data = await res.json();
        if (!cancelled) setConsent(data.marketingConsent === true);
      } catch {
        // Fall back to showing the toggle off rather than blocking the page —
        // the server remains the source of truth either way.
        if (!cancelled) setConsent(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedFetch]);

  const handleChange = async (next: boolean) => {
    const previous = consent;
    setConsent(next); // optimistic
    setSaving(true);
    try {
      const res = await authedFetch({
        method: 'POST',
        body: JSON.stringify({ marketingConsent: next }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Update failed.');

      toast({
        title: next ? 'Subscribed' : 'Unsubscribed',
        description: next
          ? "You'll get training tips and HYROX updates from HYBRIDX."
          : "You won't receive marketing emails. Account and coaching emails still apply.",
      });
    } catch (err) {
      setConsent(previous); // roll back so the switch never lies about saved state
      toast({
        title: 'Could not save',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Email preferences
        </CardTitle>
        <CardDescription>
          Choose whether to receive training tips, HYROX race guides and product news.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {consent === null ? (
          <Skeleton className="h-10 w-full" />
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="marketing-consent" className="text-base">
                Marketing emails
              </Label>
              <p className="text-sm text-muted-foreground">
                Account, verification and coaching emails are sent regardless — they are part of
                the service.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <Switch
                id="marketing-consent"
                checked={consent}
                disabled={saving}
                onCheckedChange={handleChange}
                aria-label="Receive marketing emails"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
