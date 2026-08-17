'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Archive, MoreHorizontal, Pause, Play, Search, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  cancelSchedule,
  pauseCampaign,
  resumeCampaign,
  setCampaignArchived,
} from '@/lib/marketing/actions';
import type { SerialisableCampaign } from '@/lib/marketing/queries';
import { CampaignStatusBadge } from './campaign-status-badge';

const FILTERS = ['active', 'draft', 'sent', 'archived'] as const;
type Filter = (typeof FILTERS)[number];

function rate(numerator: number | undefined, denominator: number): string {
  if (!denominator) return '—';
  return `${(((numerator ?? 0) / denominator) * 100).toFixed(1)}%`;
}

export function CampaignsTable({ campaigns }: { campaigns: SerialisableCampaign[] }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (q && !(c.subject ?? '').toLowerCase().includes(q)) return false;

      if (filter === 'archived') return c.archived === true;
      if (c.archived) return false;
      if (filter === 'draft') return c.status === 'draft';
      if (filter === 'sent') return c.status === 'sent';
      // 'active' — anything currently in motion or waiting to go.
      return c.status === 'scheduled' || c.status === 'sending' || c.status === 'paused';
    });
  }, [campaigns, filter, search]);

  const run = (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    startTransition(async () => {
      const result = await fn();
      toast(
        result.success
          ? { title: label }
          : { title: 'Action failed', description: result.error, variant: 'destructive' },
      );
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            {FILTERS.map((f) => (
              <TabsTrigger key={f} value={f} className="capitalize">
                {f}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="relative min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subjects"
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaign</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Recipients</TableHead>
              <TableHead className="text-right">Opened</TableHead>
              <TableHead className="text-right">Clicked</TableHead>
              <TableHead className="text-right">Unsubs</TableHead>
              <TableHead className="w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  Nothing here.
                </TableCell>
              </TableRow>
            ) : (
              visible.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/admin/marketing/campaigns/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.subject || 'Untitled campaign'}
                    </Link>
                    {c.status === 'sending' && c.sendState && (
                      <div className="mt-1.5 max-w-[220px]">
                        <Progress
                          value={
                            c.sendState.total
                              ? ((c.sendState.sent + c.sendState.failed) / c.sendState.total) * 100
                              : 0
                          }
                          className="h-1.5"
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          {c.sendState.sent.toLocaleString()} of{' '}
                          {c.sendState.total.toLocaleString()} sent
                          {c.sendState.failed > 0 && ` · ${c.sendState.failed} failed`}
                        </p>
                      </div>
                    )}
                    {c.scheduledAt && c.status === 'scheduled' && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Scheduled for {new Date(c.scheduledAt).toLocaleString()}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <CampaignStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.recipientCount ? c.recipientCount.toLocaleString() : '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rate(c.openCount, c.recipientCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rate(c.clickCount, c.recipientCount)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.unsubscribeCount ?? 0}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={pending}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {c.status === 'scheduled' && (
                          <DropdownMenuItem
                            onClick={() => run('Schedule cancelled', () => cancelSchedule(c.id))}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel schedule
                          </DropdownMenuItem>
                        )}
                        {c.status === 'sending' && (
                          <DropdownMenuItem
                            onClick={() => run('Campaign paused', () => pauseCampaign(c.id))}
                          >
                            <Pause className="mr-2 h-4 w-4" />
                            Pause sending
                          </DropdownMenuItem>
                        )}
                        {c.status === 'paused' && (
                          <DropdownMenuItem
                            onClick={() => run('Campaign resumed', () => resumeCampaign(c.id))}
                          >
                            <Play className="mr-2 h-4 w-4" />
                            Resume sending
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={() =>
                            run(c.archived ? 'Restored' : 'Archived', () =>
                              setCampaignArchived(c.id, !c.archived),
                            )
                          }
                        >
                          <Archive className="mr-2 h-4 w-4" />
                          {c.archived ? 'Restore' : 'Archive'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
