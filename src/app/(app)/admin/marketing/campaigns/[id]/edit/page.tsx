import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCampaign, listTags } from '@/lib/marketing/queries';
import { CampaignEditor } from '@/components/marketing/campaign-editor';
import { CampaignSendPanel } from '@/components/marketing/campaign-send-panel';
import type { EmailBlock } from '@/lib/marketing/blocks';
import type { SegmentDefinition } from '@/lib/marketing/segments';

export const dynamic = 'force-dynamic';

export default async function CampaignEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [campaign, tags] = await Promise.all([getCampaign(id), listTags()]);

  if (!campaign) notFound();

  // A campaign that is sending or sent is immutable — different recipients
  // receiving different content under one set of statistics is not a state
  // worth being able to reach. Send it to the report instead.
  if (campaign.status === 'sending' || campaign.status === 'sent') {
    redirect(`/admin/marketing/campaigns/${id}`);
  }

  const blocks = (campaign.blocks ?? []) as EmailBlock[];

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href={`/admin/marketing/campaigns/${id}`}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back to campaign
          </Link>
        </Button>
        <h1 className="mt-2 font-headline text-3xl font-bold">
          {campaign.subject || 'Untitled campaign'}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Edit the content, choose the audience, then send or schedule.
        </p>
      </div>

      <CampaignEditor
        campaignId={id}
        initial={{
          subject: campaign.subject ?? '',
          previewText: campaign.previewText ?? '',
          blocks,
          htmlBody: campaign.htmlBody ?? '',
        }}
        legacyHtmlOnly={blocks.length === 0 && Boolean(campaign.htmlBody)}
      />

      <CampaignSendPanel
        campaignId={id}
        status={campaign.status}
        initialSegment={(campaign.segment ?? {}) as SegmentDefinition}
        tags={tags}
      />
    </div>
  );
}
