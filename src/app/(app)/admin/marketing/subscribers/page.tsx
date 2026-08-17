import { listSubscribers, listTags } from '@/lib/marketing/queries';
import { SubscribersTable } from '@/components/marketing/subscribers-table';
import { AddSubscriberDialog } from '@/components/marketing/add-subscriber-dialog';

export const dynamic = 'force-dynamic';

export default async function SubscribersPage() {
  const [subscribers, tags] = await Promise.all([listSubscribers(), listTags()]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold">Subscribers</h1>
          <p className="mt-1 text-muted-foreground">
            Athletes and leads. Only active subscribers who have consented receive campaigns.
          </p>
        </div>
        <AddSubscriberDialog />
      </div>

      <SubscribersTable subscribers={subscribers} tags={tags} />
    </div>
  );
}
