// src/components/garmin-integration-card.tsx
'use client';

import { useState } from 'react';
import { Loader2, Watch, RefreshCw, Link as LinkIcon, Unlink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getAuthInstance } from '@/lib/firebase';

interface Props {
  isConnected: boolean;
  onChange?: () => void; // called after connect/disconnect to refresh user data
}

async function refreshSessionCookie() {
  const auth = await getAuthInstance();
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('You must be logged in.');
  const idToken = await currentUser.getIdToken(true);
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to refresh authentication session.');
}

export function GarminIntegrationCard({ isConnected, onChange }: Props) {
  const { toast } = useToast();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await refreshSessionCookie();
      const res = await fetch('/api/garmin/connect', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Garmin connection.');
      toast({
        title: 'Redirecting to Garmin...',
        description: 'Please approve the connection in Garmin Connect.',
      });
      window.location.href = data.url;
    } catch (e: any) {
      toast({ title: 'Connection error', description: e.message, variant: 'destructive' });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await refreshSessionCookie();
      const res = await fetch('/api/garmin/disconnect', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disconnect.');
      toast({ title: 'Disconnected', description: 'Garmin account unlinked.' });
      onChange?.();
    } catch (e: any) {
      toast({ title: 'Disconnect failed', description: e.message, variant: 'destructive' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await refreshSessionCookie();
      const res = await fetch('/api/garmin/sync-plan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ horizonDays: 14 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed.');
      toast({
        title: 'Synced to Garmin',
        description: `Pushed ${data.pushed}, skipped ${data.skipped}, failed ${data.failed}.`,
      });
    } catch (e: any) {
      toast({ title: 'Sync failed', description: e.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Watch className="h-5 w-5" />
          Garmin
        </CardTitle>
        <CardDescription>
          Push your planned workouts to your Garmin watch and sync completed activities back.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isConnected ? (
          <p className="text-sm text-muted-foreground">
            Connected. The next 14 days of your plan can be pushed to your watch calendar at any time.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Not connected. Link your Garmin Connect account to start syncing workouts.
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap gap-2">
        {isConnected ? (
          <>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Sync next 14 days
            </Button>
            <Button variant="outline" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
              Disconnect
            </Button>
          </>
        ) : (
          <Button onClick={handleConnect} disabled={connecting}>
            {connecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
            Connect with Garmin
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
