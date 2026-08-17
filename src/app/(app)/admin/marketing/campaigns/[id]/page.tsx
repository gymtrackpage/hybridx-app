import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, AlertTriangle, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { getCampaignReport } from '@/lib/marketing/queries';
import { CampaignStatusBadge } from '@/components/marketing/campaign-status-badge';

export const dynamic = 'force-dynamic';

function pct(numerator: number, denominator: number): string {
  return denominator ? `${((numerator / denominator) * 100).toFixed(1)}%` : '—';
}

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getCampaignReport(id);
  if (!report) notFound();

  const { campaign, linkClicks, failures } = report;
  const recipients = campaign.recipientCount ?? 0;

  const metrics = [
    { label: 'Recipients', value: recipients.toLocaleString(), sub: null },
    {
      label: 'Opened',
      value: pct(campaign.openCount ?? 0, recipients),
      sub: `${(campaign.openCount ?? 0).toLocaleString()} unique · bots excluded`,
    },
    {
      label: 'Clicked',
      value: pct(campaign.clickCount ?? 0, recipients),
      sub: `${(campaign.clickCount ?? 0).toLocaleString()} unique`,
    },
    {
      label: 'Unsubscribed',
      value: pct(campaign.unsubscribeCount ?? 0, recipients),
      sub: `${(campaign.unsubscribeCount ?? 0).toLocaleString()} people`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/marketing/campaigns">
            <ChevronLeft className="mr-1 h-4 w-4" />
            All campaigns
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-headline text-3xl font-bold">
            {campaign.subject || 'Untitled campaign'}
          </h1>
          <CampaignStatusBadge status={campaign.status} />
        </div>
        {campaign.sentAt && (
          <p className="mt-1 text-sm text-muted-foreground">
            Sent {new Date(campaign.sentAt).toLocaleString()}
          </p>
        )}

        {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
          <Button asChild className="mt-4">
            <Link href={`/admin/marketing/campaigns/${campaign.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit and send
            </Link>
          </Button>
        )}
      </div>

      {campaign.status === 'sending' && campaign.sendState && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Delivery in progress</CardTitle>
          </CardHeader>
          <CardContent>
            <Progress
              value={
                campaign.sendState.total
                  ? ((campaign.sendState.sent + campaign.sendState.failed) /
                      campaign.sendState.total) *
                    100
                  : 0
              }
            />
            <p className="mt-2 text-sm text-muted-foreground">
              {campaign.sendState.sent.toLocaleString()} sent,{' '}
              {campaign.sendState.failed.toLocaleString()} failed, of{' '}
              {campaign.sendState.total.toLocaleString()} queued. The send cron continues
              automatically.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{m.value}</div>
              {m.sub && <p className="mt-1 text-xs text-muted-foreground">{m.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Link performance</CardTitle>
          <CardDescription>
            Every click, not just the first per person — this is what tells you which link worked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {linkClicks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No clicks recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {linkClicks.map((link) => (
                <li key={link.id} className="flex items-center justify-between gap-4 py-2.5">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm hover:underline"
                  >
                    {link.url}
                  </a>
                  <span className="shrink-0 text-sm font-medium tabular-nums">
                    {link.clickCount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {failures.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Delivery failures
            </CardTitle>
            <CardDescription>
              Hard bounces have been removed from the list automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {failures.map((f) => (
                <li key={f.email} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-mono text-xs">{f.email}</span>
                  <span className="text-xs text-muted-foreground">{f.error}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Email preview</CardTitle>
        </CardHeader>
        <CardContent>
          <iframe
            srcDoc={campaign.htmlBody}
            title="Campaign preview"
            className="h-[600px] w-full rounded-md border bg-white"
            sandbox=""
          />
        </CardContent>
      </Card>
    </div>
  );
}
