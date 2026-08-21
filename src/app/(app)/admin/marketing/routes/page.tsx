import { getAdminDb } from '@/lib/firebase-admin';
import { listRoutes } from '@/lib/marketing/route-store';
import { SUBSCRIBERS } from '@/lib/marketing/subscribers';
import { JOURNEYS } from '@/lib/marketing/journeys';
import { RoutesManager } from '@/components/marketing/routes-manager';

export const dynamic = 'force-dynamic';

/**
 * Where subscribers come from, and what happens when they arrive.
 *
 * A funnel launched on the marketing site registers itself here on its first
 * lead, so this page is also the place a new promotion is noticed — an
 * `unconfigured` route is one nobody has given a name, tags or a welcome
 * sequence yet.
 */
export default async function RoutesPage() {
  const db = getAdminDb();
  const routes = await listRoutes();

  // Per-route subscriber counts and whether anything is set up to greet them.
  // Both are aggregation queries rather than document reads: this page should
  // stay cheap however large the list gets.
  const [counts, journeys] = await Promise.all([
    Promise.all(
      routes.map(async (route) => {
        const snap = await db
          .collection(SUBSCRIBERS)
          .where('route', '==', route.id)
          .count()
          .get();
        return [route.id, snap.data().count] as const;
      }),
    ),
    db.collection(JOURNEYS).get(),
  ]);

  const subscriberCounts = Object.fromEntries(counts);

  // Which routes a journey targets, so the page can say plainly that a funnel
  // is collecting addresses nothing will ever act on.
  const journeysByRoute: Record<string, Array<{ id: string; name: string; status: string }>> = {};
  for (const doc of journeys.docs) {
    const data = doc.data() as { name?: string; status?: string; trigger?: { route?: string } };
    const route = data.trigger?.route;
    if (!route) continue;
    (journeysByRoute[route] ??= []).push({
      id: doc.id,
      name: data.name ?? 'Untitled journey',
      status: data.status ?? 'draft',
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-headline text-3xl font-bold">Intake routes</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Every way an address enters the list. A new funnel on the marketing site registers
          itself here the first time it sends a lead — give it a name, tags and a welcome
          journey, and it is live without a deploy.
        </p>
      </div>

      <RoutesManager
        routes={routes.map((r) => ({
          id: r.id,
          label: r.label,
          description: r.description,
          property: r.property,
          consentPolicy: r.consentPolicy,
          tags: r.tags,
          status: r.status,
          builtIn: r.builtIn,
          firstSeenFrom: r.firstSeenFrom ?? null,
        }))}
        subscriberCounts={subscriberCounts}
        journeysByRoute={journeysByRoute}
      />
    </div>
  );
}
