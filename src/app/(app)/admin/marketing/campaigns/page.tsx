import { listCampaigns } from '@/lib/marketing/queries';
import { CampaignsTable } from '@/components/marketing/campaigns-table';
import { NewCampaignButton } from '@/components/marketing/new-campaign-button';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold sm:text-3xl">Campaigns</h1>
          <p className="mt-1 text-muted-foreground">
            Drafts, scheduled sends and delivery reports.
          </p>
        </div>
        <NewCampaignButton />
      </div>

      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
