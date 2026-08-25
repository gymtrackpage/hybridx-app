import { listSubscribers, listTags } from '@/lib/marketing/queries';
import { listRoutes } from '@/lib/marketing/route-store';
import { SubscribersTable } from '@/components/marketing/subscribers-table';
import { AddSubscriberDialog } from '@/components/marketing/add-subscriber-dialog';
import { ImportSubscribersDialog } from '@/components/marketing/import-subscribers-dialog';

export const dynamic = 'force-dynamic';

export default async function SubscribersPage() {
  // Routes come from the store rather than the code registry, so a funnel that
  // registered itself since the last deploy is labelled here like any other.
  const [subscribers, tags, routes] = await Promise.all([
    listSubscribers(),
    listTags(),
    listRoutes(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold sm:text-3xl">Subscribers</h1>
          <p className="mt-1 text-muted-foreground">
            Athletes and leads. Only active subscribers who have consented receive campaigns.
          </p>
        </div>
        {/* Equal halves on a phone so neither action is a sliver. */}
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <ImportSubscribersDialog />
          <AddSubscriberDialog />
        </div>
      </div>

      <SubscribersTable
        subscribers={subscribers}
        tags={tags}
        routes={routes.map((r) => ({ id: r.id, label: r.label, property: r.property }))}
      />
    </div>
  );
}
