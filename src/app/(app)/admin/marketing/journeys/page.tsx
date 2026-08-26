import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { listJourneys } from '@/lib/marketing/journey-queries';
import { JourneysList } from '@/components/marketing/journeys-list';

export const dynamic = 'force-dynamic';

export default async function JourneysPage() {
  const journeys = await listJourneys();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold sm:text-3xl">Journeys</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">
            Automations that send on a trigger — a welcome series, a trial-ending nudge, a winback.
            A one-off broadcast is a journey too, with a manual trigger and one email.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/admin/marketing/studio">
            <Sparkles className="mr-2 h-4 w-4" />
            New in studio
          </Link>
        </Button>
      </div>

      <JourneysList journeys={journeys} />
    </div>
  );
}
