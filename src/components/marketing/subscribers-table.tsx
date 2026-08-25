'use client';

import { useMemo, useState, useTransition } from 'react';
import { Loader2, Search, UserMinus, UserPlus, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
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
import type { IntakeProperty } from '@/lib/marketing/sources';
import type { SubscriberStatus } from '@/lib/marketing/types';

/** Trimmed route record, passed from the server so runtime routes are included. */
interface RouteOption {
  id: string;
  label: string;
  property: IntakeProperty;
}

interface Props {
  subscribers: SerialisableSubscriber[];
  tags: Array<{ tag: string; count: number }>;
  routes: RouteOption[];
}

/** Marks records written before the intake registry existed. */
const NO_ROUTE = '__none__';

const PROPERTY_LABELS = {
  website: 'hybridx.club',
  app: 'app.hybridx.club',
  admin: 'Administrative',
} as const;

const STATUS_STYLES: Record<SubscriberStatus, string> = {
  active: 'bg-green-500/15 text-green-600 dark:text-green-400',
  unsubscribed: 'bg-muted text-muted-foreground',
  bounced: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  complained: 'bg-destructive/15 text-destructive',
};

export function SubscribersTable({ subscribers, tags, routes }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | SubscriberStatus>('all');
  const [tag, setTag] = useState('all');
  const [route, setRoute] = useState('all');
  const [syncing, setSyncing] = useState(false);

  const grouped = useMemo(() => {
    const byProperty: Record<IntakeProperty, RouteOption[]> = { website: [], app: [], admin: [] };
    for (const r of routes) byProperty[r.property]?.push(r);
    return byProperty;
  }, [routes]);

  const routeById = useMemo(() => new Map(routes.map((r) => [r.id, r])), [routes]);

  /** How many subscribers arrived by each route, so the filter shows its own weight. */
  const routeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of subscribers) {
      const key = s.route ?? NO_ROUTE;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [subscribers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subscribers.filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (tag !== 'all' && !(s.tags ?? []).includes(tag)) return false;
      if (route !== 'all' && (s.route ?? NO_ROUTE) !== route) return false;
      if (!q) return true;
      return (
        s.email.toLowerCase().includes(q) ||
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
      );
    });
  }, [subscribers, search, status, tag, route]);

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

  /** The route a subscriber arrived by, or the raw id when the registry has no
   *  record of it — showing the id beats showing nothing, it says what to look up. */
  const routeLabel = (s: SerialisableSubscriber) => {
    const r = s.route ? routeById.get(s.route) : undefined;
    if (r) {
      return (
        <span className="text-sm">
          {r.label}
          <span className="block text-xs text-muted-foreground">
            {PROPERTY_LABELS[r.property]}
          </span>
        </span>
      );
    }
    return <span className="text-sm text-muted-foreground">{s.route ?? '—'}</span>;
  };

  const statusAction = (s: SerialisableSubscriber) => {
    if (s.status === 'active') {
      return (
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          onClick={() => handleStatusChange(s, 'unsubscribe')}
        >
          <UserMinus className="mr-1 h-3.5 w-3.5" />
          Remove
        </Button>
      );
    }
    if (s.status === 'complained') {
      // No resubscribe affordance: mailing someone who filed a spam report
      // endangers the sending domain for everyone else, so it must not be one
      // click away.
      return <span className="text-xs text-muted-foreground">Locked</span>;
    }
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() => handleStatusChange(s, 'resubscribe')}
      >
        <UserPlus className="mr-1 h-3.5 w-3.5" />
        Restore
      </Button>
    );
  };

  const tagBadges = (s: SerialisableSubscriber) => (
    <div className="flex flex-wrap gap-1">
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
  );

  return (
    <div className="space-y-4">
      {/* Search takes the full width on a phone; the three filters sit on their
          own rows beneath rather than shrinking to unreadable stubs. */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-row sm:flex-wrap sm:items-center">
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-full sm:w-[170px]">
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

          <Select value={route} onValueChange={setRoute}>
            <SelectTrigger className="w-full sm:w-[230px]">
              <SelectValue placeholder="How they joined" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Every route</SelectItem>
              {(['website', 'app', 'admin'] as const).map((property) => (
                <SelectGroup key={property}>
                  <SelectLabel>{PROPERTY_LABELS[property]}</SelectLabel>
                  {grouped[property].map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label} ({(routeCounts.get(r.id) ?? 0).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              {routeCounts.has(NO_ROUTE) && (
                <SelectGroup>
                  <SelectLabel>Before routes were recorded</SelectLabel>
                  <SelectItem value={NO_ROUTE}>
                    Unrecorded ({(routeCounts.get(NO_ROUTE) ?? 0).toLocaleString()})
                  </SelectItem>
                </SelectGroup>
              )}
            </SelectContent>
          </Select>

          <Select value={tag} onValueChange={setTag}>
            <SelectTrigger className="w-full sm:w-[200px]">
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

          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sync athletes
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Showing {filtered.length.toLocaleString()} of {subscribers.length.toLocaleString()}
      </p>

      {/* Mobile: a card per subscriber. The nine-column table needs roughly
          three phone widths to be legible, so it only appears from lg. */}
      <div className="space-y-3 lg:hidden">
        {filtered.length === 0 ? (
          <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
            No subscribers match those filters.
          </div>
        ) : (
          filtered.map((s) => (
            <div key={s.id} className="space-y-3 rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {[s.firstName, s.lastName].filter(Boolean).join(' ') || '—'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{s.email}</p>
                </div>
                <Badge variant="secondary" className={`${STATUS_STYLES[s.status]} shrink-0`}>
                  {s.status}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Consent</p>
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
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Joined via</p>
                  {routeLabel(s)}
                </div>
              </div>

              {(s.tags?.length ?? 0) > 0 && tagBadges(s)}

              <div className="flex items-center justify-between gap-3 border-t pt-3">
                <dl className="flex gap-4 text-sm">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-xs text-muted-foreground">Sent</dt>
                    <dd className="font-medium tabular-nums">{s.totalSent ?? 0}</dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-xs text-muted-foreground">Opens</dt>
                    <dd className="font-medium tabular-nums">{s.openCount ?? 0}</dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-xs text-muted-foreground">Clicks</dt>
                    <dd className="font-medium tabular-nums">{s.clickCount ?? 0}</dd>
                  </div>
                </dl>
                {statusAction(s)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden rounded-md border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subscriber</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Consent</TableHead>
              <TableHead>Joined via</TableHead>
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
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
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
                  <TableCell>{routeLabel(s)}</TableCell>
                  <TableCell>
                    <div className="max-w-[260px]">{tagBadges(s)}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.totalSent ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.openCount ?? 0}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.clickCount ?? 0}</TableCell>
                  <TableCell className="text-right">{statusAction(s)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
