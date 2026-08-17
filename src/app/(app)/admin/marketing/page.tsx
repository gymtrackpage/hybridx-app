import Link from 'next/link';
import { Mail, Send, Users, MousePointerClick, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getDashboardStats, listCampaigns } from '@/lib/marketing/queries';
import { CampaignStatusBadge } from '@/components/marketing/campaign-status-badge';
import { NewCampaignButton } from '@/components/marketing/new-campaign-button';

export const dynamic = 'force-dynamic';

function percent(value: number | null): string {
  return value === null ? '—' : `${(value * 100).toFixed(1)}%`;
}

export default async function MarketingDashboardPage() {
  const [stats, campaigns] = await Promise.all([getDashboardStats(), listCampaigns(8)]);

  const tiles = [
    {
      label: 'Mailable subscribers',
      value: stats.consentedSubscribers.toLocaleString(),
      // The headline number is consented, not total: it is the only one that
      // describes who a campaign can actually reach.
      hint: `${stats.totalSubscribers.toLocaleString()} on the list in total`,
      icon: Users,
    },
    { label: 'Campaigns sent', value: String(stats.campaignsSent), hint: `${stats.campaignsDraft} drafts`, icon: Send },
    { label: 'Average open rate', value: percent(stats.averageOpenRate), hint: 'Bot opens excluded', icon: Mail },
    { label: 'Average click rate', value: percent(stats.averageClickRate), hint: 'Unique clicks', icon: MousePointerClick },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">Marketing</h1>
          <p className="mt-1 text-muted-foreground">
            Campaigns, subscribers and delivery for HYBRIDX.
          </p>
        </div>
        <NewCampaignButton />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(({ label, value, hint, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(stats.unsubscribed > 0 || stats.bounced > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              List health
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="font-semibold">{stats.unsubscribed.toLocaleString()}</span>
              <span className="ml-2 text-muted-foreground">unsubscribed</span>
            </div>
            <div>
              <span className="font-semibold">{stats.bounced.toLocaleString()}</span>
              <span className="ml-2 text-muted-foreground">bounced</span>
            </div>
            <div>
              <span className="font-semibold">
                {(stats.activeSubscribers - stats.consentedSubscribers).toLocaleString()}
              </span>
              <span className="ml-2 text-muted-foreground">active but not opted in</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent campaigns</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/marketing/campaigns">View all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {campaigns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No campaigns yet. Describe what you want to send in the studio, or start a blank
              draft.
            </p>
          ) : (
            <ul className="divide-y">
              {campaigns.map((c) => {
                const openRate = c.recipientCount ? (c.openCount ?? 0) / c.recipientCount : null;
                return (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/marketing/campaigns/${c.id}`}
                        className="truncate font-medium hover:underline"
                      >
                        {c.subject || 'Untitled campaign'}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {c.recipientCount ? `${c.recipientCount.toLocaleString()} recipients` : 'Not sent'}
                        {openRate !== null && ` · ${percent(openRate)} opened`}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {c.sendState && c.status === 'sending' && (
                        <Badge variant="outline">
                          {c.sendState.sent}/{c.sendState.total}
                        </Badge>
                      )}
                      <CampaignStatusBadge status={c.status} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
