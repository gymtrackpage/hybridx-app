import { listCampaigns } from '@/lib/marketing/queries';
import { CampaignsTable } from '@/components/marketing/campaigns-table';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const campaigns = await listCampaigns();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">Campaigns</h1>
          <p className="mt-1 text-muted-foreground">
            Drafts, scheduled sends and delivery reports.
          </p>
        </div>
      </div>

      <CampaignsTable campaigns={campaigns} />
    </div>
  );
}
