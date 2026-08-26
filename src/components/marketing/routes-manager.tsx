'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { AlertTriangle, Check, Loader2, Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { archiveMarketingRoute, saveRoute, seedRoutes } from '@/lib/marketing/actions';

interface RouteRow {
  id: string;
  label: string;
  description: string;
  property: 'website' | 'app' | 'admin';
  consentPolicy: 'implied' | 'explicit' | 'confirmed' | 'none';
  tags: string[];
  status: 'active' | 'unconfigured' | 'archived';
  builtIn: boolean;
  firstSeenFrom: string | null;
}

interface Props {
  routes: RouteRow[];
  subscriberCounts: Record<string, number>;
  journeysByRoute: Record<string, Array<{ id: string; name: string; status: string }>>;
}

const CONSENT_HELP: Record<RouteRow['consentPolicy'], string> = {
  implied: 'The form states that signing up means ongoing email. Mailable on capture.',
  explicit: 'A marketing checkbox was ticked. Mailable on capture.',
  confirmed: 'Nothing until a confirmation link is clicked. Not mailable on capture.',
  none: 'Arriving this way never implies consent. The address is known, not mailable.',
};

const PROPERTY_LABELS: Record<RouteRow['property'], string> = {
  website: 'hybridx.club',
  app: 'app.hybridx.club',
  admin: 'Administrative',
};

export function RoutesManager({ routes, subscriberCounts, journeysByRoute }: Props) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [seeding, setSeeding] = useState(false);

  const needsAttention = useMemo(
    () => routes.filter((r) => r.status === 'unconfigured'),
    [routes],
  );

  /**
   * A route that is live and mailable but has no journey is collecting
   * addresses that nothing will ever greet — the exact failure this whole
   * system was built to remove, so it is called out rather than left to be
   * noticed.
   */
  const silentRoutes = useMemo(
    () =>
      routes.filter(
        (r) =>
          r.status === 'active' &&
          r.property === 'website' &&
          r.consentPolicy !== 'none' &&
          !(journeysByRoute[r.id] ?? []).some((j) => j.status === 'live'),
      ),
    [routes, journeysByRoute],
  );

  const handleSeed = async () => {
    setSeeding(true);
    const result = await seedRoutes();
    setSeeding(false);

    toast(
      result.success
        ? { title: 'Built-in routes seeded', description: `${result.data.created} added.` }
        : { title: 'Could not seed', description: result.error, variant: 'destructive' },
    );
  };

  const handleArchive = (route: RouteRow) => {
    startTransition(async () => {
      const result = await archiveMarketingRoute(route.id);
      toast(
        result.success
          ? { title: 'Route archived', description: route.label }
          : { title: 'Could not archive', description: result.error, variant: 'destructive' },
      );
    });
  };

  return (
    <div className="space-y-6">
      {needsAttention.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-medium">
                {needsAttention.length} new{' '}
                {needsAttention.length === 1 ? 'funnel has' : 'funnels have'} sent leads
              </p>
              <p className="text-sm text-muted-foreground">
                {needsAttention.map((r) => r.id).join(', ')} — registered automatically. Set a
                name, tags and consent posture, then attach a welcome journey.
              </p>
            </div>
          </div>
        </div>
      )}

      {silentRoutes.length > 0 && (
        <div className="rounded-md border border-border bg-muted/40 p-4">
          <p className="text-sm">
            <span className="font-medium">No live journey:</span>{' '}
            {silentRoutes.map((r) => r.label).join(', ')}. These are capturing mailable
            addresses that nothing is set up to greet.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleSeed}
          disabled={seeding}
        >
          {seeding ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Seed built-in routes
        </Button>
      </div>

      {/* Mobile: a card per route. Configure is a full-width button here rather
          than a small ghost link in a sixth table column. */}
      <div className="space-y-3 lg:hidden">
        {routes.map((route) => {
          const journeys = journeysByRoute[route.id] ?? [];
          return (
            <div
              key={route.id}
              className={`space-y-3 rounded-md border p-4 ${
                route.status === 'archived' ? 'opacity-60' : ''
              }`}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{route.label}</span>
                  {route.status === 'unconfigured' && (
                    <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                      New
                    </Badge>
                  )}
                  {route.status === 'archived' && <Badge variant="outline">Archived</Badge>}
                  {route.builtIn && (
                    <Badge variant="outline" className="text-[10px]">
                      built-in
                    </Badge>
                  )}
                </div>
                <div className="break-all font-mono text-xs text-muted-foreground">{route.id}</div>
              </div>

              <dl className="grid grid-cols-3 gap-2 border-y py-3 text-sm">
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Property</dt>
                  <dd className="truncate">{PROPERTY_LABELS[route.property]}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Consent</dt>
                  <dd className="truncate">{route.consentPolicy}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Subscribers</dt>
                  <dd className="tabular-nums">
                    {(subscriberCounts[route.id] ?? 0).toLocaleString()}
                  </dd>
                </div>
              </dl>

              <div>
                <p className="text-xs text-muted-foreground">Welcome journey</p>
                {journeys.length === 0 ? (
                  <p className="text-sm text-muted-foreground">None</p>
                ) : (
                  <div className="space-y-1">
                    {journeys.map((j) => (
                      <div key={j.id} className="flex items-center gap-2 text-sm">
                        <Link
                          href={`/admin/marketing/journeys/${j.id}`}
                          className="underline underline-offset-2"
                        >
                          {j.name}
                        </Link>
                        {j.status === 'live' ? (
                          <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {j.status}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditing(route)}>
                  Configure
                </Button>
                {!route.builtIn && route.status !== 'archived' && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    aria-label={`Archive ${route.label}`}
                    disabled={pending}
                    onClick={() => handleArchive(route)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden rounded-md border lg:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Route</TableHead>
              <TableHead>Property</TableHead>
              <TableHead>Consent</TableHead>
              <TableHead>Welcome journey</TableHead>
              <TableHead className="text-right">Subscribers</TableHead>
              <TableHead className="w-[150px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {routes.map((route) => {
              const journeys = journeysByRoute[route.id] ?? [];
              return (
                <TableRow key={route.id} className={route.status === 'archived' ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{route.label}</span>
                      {route.status === 'unconfigured' && (
                        <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400">
                          New
                        </Badge>
                      )}
                      {route.status === 'archived' && <Badge variant="outline">Archived</Badge>}
                      {route.builtIn && (
                        <Badge variant="outline" className="text-[10px]">
                          built-in
                        </Badge>
                      )}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{route.id}</div>
                  </TableCell>

                  <TableCell className="text-sm">{PROPERTY_LABELS[route.property]}</TableCell>

                  <TableCell>
                    <span className="text-sm">{route.consentPolicy}</span>
                  </TableCell>

                  <TableCell>
                    {journeys.length === 0 ? (
                      <span className="text-sm text-muted-foreground">None</span>
                    ) : (
                      <div className="space-y-1">
                        {journeys.map((j) => (
                          <div key={j.id} className="flex items-center gap-2 text-sm">
                            <Link
                              href={`/admin/marketing/journeys/${j.id}`}
                              className="underline underline-offset-2"
                            >
                              {j.name}
                            </Link>
                            {j.status === 'live' ? (
                              <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                            ) : (
                              <Badge variant="outline" className="text-[10px]">
                                {j.status}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-right tabular-nums">
                    {(subscriberCounts[route.id] ?? 0).toLocaleString()}
                  </TableCell>

                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEditing(route)}>
                      Configure
                    </Button>
                    {!route.builtIn && route.status !== 'archived' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Archive ${route.label}`}
                        disabled={pending}
                        onClick={() => handleArchive(route)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <RouteDialog route={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function RouteDialog({ route, onClose }: { route: RouteRow | null; onClose: () => void }) {
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [consentPolicy, setConsentPolicy] = useState<RouteRow['consentPolicy']>('none');
  const [property, setProperty] = useState<RouteRow['property']>('website');
  const [tags, setTags] = useState('');

  // Re-seed the fields whenever a different route is opened.
  const [loadedId, setLoadedId] = useState<string | null>(null);
  if (route && route.id !== loadedId) {
    setLoadedId(route.id);
    setLabel(route.label);
    setDescription(route.description);
    setConsentPolicy(route.consentPolicy);
    setProperty(route.property);
    setTags(route.tags.join(', '));
  }

  const handleSave = () => {
    if (!route) return;
    startTransition(async () => {
      const result = await saveRoute(route.id, {
        label: label.trim(),
        description: description.trim(),
        consentPolicy,
        property,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      });

      if (result.success) {
        toast({ title: 'Route saved', description: label });
        onClose();
      } else {
        toast({ title: 'Could not save', description: result.error, variant: 'destructive' });
      }
    });
  };

  return (
    <Dialog open={!!route} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto sm:w-full">
        <DialogHeader>
          <DialogTitle>Configure route</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{route?.id}</span>
            {route?.firstSeenFrom && (
              <span className="mt-1 block">First seen via {route.firstSeenFrom}.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="route-label">Name</Label>
            <Input
              id="route-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Spring HYROX challenge"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="route-description">What the person did</Label>
            <Input
              id="route-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Signed up for the spring challenge on the landing page."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="route-property">Property</Label>
            <Select value={property} onValueChange={(v) => setProperty(v as RouteRow['property'])}>
              <SelectTrigger id="route-property">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="website">hybridx.club</SelectItem>
                <SelectItem value="app">app.hybridx.club</SelectItem>
                <SelectItem value="admin">Administrative</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="route-consent">Consent posture</Label>
            <Select
              value={consentPolicy}
              onValueChange={(v) => setConsentPolicy(v as RouteRow['consentPolicy'])}
            >
              <SelectTrigger id="route-consent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="implied">Implied — the form said so</SelectItem>
                <SelectItem value="explicit">Explicit — a box was ticked</SelectItem>
                <SelectItem value="confirmed">Confirmed — needs a click</SelectItem>
                <SelectItem value="none">None — known, not mailable</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{CONSENT_HELP[consentPolicy]}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="route-tags">Tags</Label>
            <Input
              id="route-tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="source:website, promo:spring-2026"
            />
            <p className="text-xs text-muted-foreground">
              Comma separated, applied to everyone who arrives by this route. The{' '}
              <span className="font-mono">route:</span> tag is added automatically.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || !label.trim()}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save route
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
