'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Search, UserMinus, UserPlus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  resubscribeSubscriber,
  runAthleteSync,
  unsubscribeSubscriber,
} from '@/lib/marketing/actions';
import type { SerialisableSubscriber } from '@/lib/marketing/queries';
import type { SubscriberStatus } from '@/lib/marketing/types';

interface Props {
  subscribers: SerialisableSubscriber[];
  tags: Array<{ tag: string; count: number }>;
}

const STATUS_STYLES: Record<SubscriberStatus, string> = {
  active: 'bg-green-500/15 text-green-600 dark:text-green-400',
  unsubscribed: 'bg-muted text-muted-foreground',
  bounced: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  complained: 'bg-destructive/15 text-destructive',
};

export function SubscribersTable({ subscribers, tags }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | SubscriberStatus>('all');
  const [tag, setTag] = useState('all');
  const [syncing, setSyncing] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (tag !== 'all' && !(s.tags ?? []).includes(tag)) return false;
      if (!q) return true;
      return (
        s.email.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      );
    });
  }, [subscribers, search, status, tag]);

  const handleStatusChange = (sub: SerialisableSubscriber, next: 'unsubscribe' | 'resubscribe') => {
    startTransition(async () => {
      const result =
        next === 'unsubscribe'
          ? await unsubscribeSubscriber(sub.id)
          : await resubscribeSubscriber(sub.id);

      if (result.success) {
        toast({
          title: next === 'unsubscribe' ? 'Unsubscribed' : 'Resubscribed',
          description: sub.email,
        });
      } else {
        toast({ title: 'Could not update', description: result.error, variant: 'destructive' });
      }
    });
  };

  const handleSync = async () => {
    setSyncing(true);
    const result = await runAthleteSync();
    setSyncing(false);

    if (result.success) {
      toast({
        title: 'Sync complete',
        description: `${result.data.created} added, ${result.data.updated} updated, ${result.data.skippedSuppressed} left suppressed.`,
      });
    } else {
      toast({ title: 'Sync failed', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>

        <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="unsubscribed">Unsubscribed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
            <SelectItem value="complained">Complained</SelectItem>
          </SelectContent>
        </Select>

        <Select value={tag} onValueChange={setTag}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map((t) => (
              <SelectItem key={t.tag} value={t.tag}>
                {t.tag} ({t.count})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" onClick={handleSync} disabled={syncing}>
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync athletes
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length.toLocaleString()} of {subscribers.length.toLocaleString()}
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subscriber</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Consent</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead className="text-right">Sent</TableHead>
              <TableHead className="text-right">Opens</TableHead>
              <TableHead className="text-right">Clicks</TableHead>
              <TableHead className="w-[130px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No subscribers match those filters.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="font-medium">
                      {[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}
                    </div>
                    <div className="text-xs text-muted-foreground">{s.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={STATUS_STYLES[s.status]}>
                      {s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {s.consent.marketing ? (
                      <span className="text-sm">
                        Yes
                        <span className="block text-xs text-muted-foreground">
                          {s.consent.method}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">No</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[260px] flex-wrap gap-1">
                      {(s.tags ?? []).slice(0, 4).map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                      {(s.tags?.length ?? 0) > 4 && (
                        <Badge variant="outline" className="text-[10px]">
                          +{(s.tags?.length ?? 0) - 4}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.totalSent ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.openCount ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.clickCount ?? 0}</TableCell>
                  <TableCell className="text-right">
                    {s.status === 'active' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleStatusChange(s, 'unsubscribe')}
                      >
                        <UserMinus className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    ) : s.status === 'complained' ? (
                      // No resubscribe affordance: mailing someone who filed a
                      // spam report endangers the sending domain for everyone
                      // else, so it must not be one click away.
                      <span className="text-xs text-muted-foreground">Locked</span>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={pending}
                        onClick={() => handleStatusChange(s, 'resubscribe')}
                      >
                        <UserPlus className="mr-1 h-3.5 w-3.5" />
                        Restore
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
