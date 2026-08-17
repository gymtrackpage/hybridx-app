import { listSegments } from '@/lib/marketing/segment-store';
import { listTags } from '@/lib/marketing/queries';
import { SegmentsManager } from '@/components/marketing/segments-manager';

export const dynamic = 'force-dynamic';

export default async function SegmentsPage() {
  const [segments, tags] = await Promise.all([listSegments(), listTags()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold">Segments</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Named audiences, reusable across campaigns and journeys. Saving one means two campaigns
          aimed at the same people actually reach the same people.
        </p>
      </div>

      <SegmentsManager segments={segments} tags={tags} />
    </div>
  );
}
