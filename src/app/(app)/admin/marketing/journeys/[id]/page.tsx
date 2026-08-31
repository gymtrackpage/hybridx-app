import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft, Clock, Mail, Tag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getJourney } from '@/lib/marketing/journey-queries';
import { getAllRoutes } from '@/lib/marketing/route-store';
import { describeAudience } from '@/lib/marketing/segments';
import { TRIGGER_DESCRIPTIONS, validateJourney, type TriggerType } from '@/lib/marketing/journeys';
import { JourneyActivation } from '@/components/marketing/journey-activation';

export const dynamic = 'force-dynamic';

export default async function JourneyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const journey = await getJourney(id);
  if (!journey) notFound();

  const problems = validateJourney(journey);
  const emailByStep = new Map(journey.emails.map((e) => [e.stepId, e]));

  // Who this journey will actually reach, spelled out. This page is the review
  // step before activation, and it used to show the trigger type and nothing
  // else — so "welcome the ATHX guide list" and "welcome the entire list"
  // looked identical here, right up to the send.
  const routes = await getAllRoutes();
  const triggerRoute = journey.trigger.route ? routes.get(journey.trigger.route) : undefined;
  const audience = describeAudience(journey.entryRules?.segment);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-3">
          <Link href="/admin/marketing/journeys">
            <ChevronLeft className="mr-1 h-4 w-4" />
            All journeys
          </Link>
        </Button>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-headline text-2xl font-bold sm:text-3xl">{journey.name}</h1>
          <Badge variant="secondary">{journey.status}</Badge>
        </div>
        <p className="mt-1 text-muted-foreground">{journey.goal}</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'In progress', value: journey.runCounts.active },
          { label: 'Completed', value: journey.runCounts.completed },
          { label: 'Exited early', value: journey.runCounts.exited },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="p-4 pb-2 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground sm:text-sm">{s.label}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl font-bold sm:text-2xl">{s.value.toLocaleString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <JourneyActivation
        journeyId={journey.id}
        status={journey.status}
        trigger={journey.trigger.type}
        problems={problems}
        firstCampaignId={journey.emails[0]?.campaignId}
      />

      <Card>
        <CardHeader>
          <CardTitle>Trigger and rules</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <strong>Starts when:</strong>{' '}
            {TRIGGER_DESCRIPTIONS[journey.trigger.type as TriggerType] ?? journey.trigger.type}
            {journey.trigger.days ? ` (${journey.trigger.days} days)` : ''}
          </p>
          {journey.trigger.route && (
            <p>
              <strong>Only people who arrived by:</strong>{' '}
              {triggerRoute?.label ?? journey.trigger.route}
              {!triggerRoute && (
                <span className="text-destructive">
                  {' '}
                  — no such route, so this journey will never enrol anybody
                </span>
              )}
            </p>
          )}
          <p>
            <strong>Audience:</strong> {audience}
          </p>
          <p className="text-muted-foreground">
            {journey.entryRules.onceOnly
              ? 'Each athlete may enter only once.'
              : 'Athletes may re-enter.'}
          </p>
          {journey.exitRules?.exitOnConversion && (
            <p className="text-muted-foreground">
              Stops early when: <strong>{journey.exitRules.exitOnConversion.type}</strong> — so it
              does not keep chasing someone who has already done what it was asking for.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sequence</CardTitle>
          <CardDescription>Steps run in order for each athlete who enters.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3">
            {journey.steps.map((step, i) => {
              const email = step.type === 'sendEmail' ? emailByStep.get(step.id) : undefined;
              return (
                <li key={step.id} className="flex gap-3 rounded-lg border p-4">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    {step.type === 'wait' && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Wait {step.hours} hours
                        {step.hours >= 24 && ` (${Math.round(step.hours / 24)} days)`}
                      </p>
                    )}

                    {(step.type === 'addTag' || step.type === 'removeTag') && (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Tag className="h-4 w-4" />
                        {step.type === 'addTag' ? 'Add' : 'Remove'} tag{' '}
                        <Badge variant="outline">{step.tag}</Badge>
                      </p>
                    )}

                    {step.type === 'exit' && (
                      <p className="text-sm text-muted-foreground">
                        Exit{step.reason ? ` — ${step.reason}` : ''}
                      </p>
                    )}

                    {step.type === 'branch' && (
                      <p className="text-sm text-muted-foreground">Branch: {step.description}</p>
                    )}

                    {step.type === 'sendEmail' && (
                      <>
                        <p className="flex items-center gap-2 text-sm font-medium">
                          <Mail className="h-4 w-4 text-primary" />
                          {email?.subject ?? 'Email'}
                        </p>
                        {email?.previewText && (
                          <p className="mt-1 text-xs text-muted-foreground">{email.previewText}</p>
                        )}
                        {email && (
                          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>{email.sent.toLocaleString()} sent</span>
                            <span>{email.opened.toLocaleString()} opened</span>
                            <span>{email.clicked.toLocaleString()} clicked</span>
                            <Link
                              href={`/admin/marketing/campaigns/${email.campaignId}`}
                              className="underline"
                            >
                              Report
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
