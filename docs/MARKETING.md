# Marketing system

The HXMailer mailing system, merged into this codebase. Campaigns, subscribers,
automated journeys and delivery all live under `/admin/marketing`.

## Layout

```
src/lib/marketing/
  types.ts          data model
  subscribers.ts    the only write path for the subscriber list
  capture.ts        one entry point for every lead form
  sync.ts           users -> marketingSubscribers, nightly
  segments.ts       audience resolution (tags + athlete predicates)
  tokens.ts         HMAC signing for unsubscribe and tracking links
  transport.ts      pooled Brevo SMTP for bulk
  personalise.ts    merge tokens, tracking injection, unsubscribe footer
  queue.ts          enqueue / drain / retry / finalise
  bots.ts           open- and click-tracking noise filtering
  blocks.ts         structured content schema
  render.ts         blocks -> email-safe HTML (deterministic)
  knowledge.ts      live business snapshot for AI prompts
  validate.ts       fact-checking for drafts
  journeys.ts       automation model
  engine.ts         enrolment and step execution
  events.ts         the trigger bus
  frequency.ts      shared weekly send cap
  actions.ts        admin server actions
  studio-actions.ts AI-backed studio actions

src/ai/flows/marketing/
  compose-journey.ts   prompt -> plan
  draft-email.ts       brief -> structured blocks
  revise-block.ts      one block, on instruction
  subject-variants.ts  alternatives ranked on real history
```

## Firestore collections

All top-level, all admin-read, none client-writable — every write goes through
the Admin SDK.

| Collection | Notes |
|---|---|
| `marketingSubscribers` | Doc id is sha256 of the lowercased email, so dedupe is structural |
| `marketingCampaigns` | `sends` and `linkClicks` subcollections |
| `marketingJourneys` | Trigger + ordered steps |
| `marketingJourneyRuns` | Doc id `${journeyId}_${subscriberId}`, which is what enforces `onceOnly` |
| `marketingEvents` | The trigger bus; pruned after 30 days |
| `marketingPlans` | Archived HXMailer planner output |
| `marketingSegments` | Saved, named audiences reusable across campaigns and journeys |
| `marketingBriefs` | Weekly snapshots; each run diffs against the previous |
| `marketingSettings/config` | Sender, batch size, frequency cap, sending switch |

## Environment

| Variable | Purpose |
|---|---|
| `BREVO_SMTP_USER`, `BREVO_SMTP_KEY` | Bulk delivery. Sending is blocked without them. |
| `MARKETING_TOKEN_SECRET` | Signs unsubscribe and tracking links. Minimum 32 characters; sending is blocked without it, rather than emitting forgeable links. |
| `MARKETING_EMAIL_FROM` | Campaign From address. Keep separate from `EMAIL_FROM` so a bad campaign cannot damage delivery of verification email. |
| `MARKETING_EMAIL_FROM_NAME` | Display name, defaults to HYBRIDX. |
| `MARKETING_PRICE_LABEL` | Price shown in AI-drafted copy. Defaults to `£5/month`. |
| `MARKETING_BRIEF_RECIPIENT` | Where the weekly brief is emailed. Falls back to `EMAIL_FROM`. |
| `CRON_SECRET` | Shared bearer secret for the cron endpoints. |
| `BREVO_WEBHOOK_SECRET` | Shared secret for Brevo's delivery webhook. The endpoint rejects everything without it, so bounces and complaints would go unrecorded. |
| `HXMAILER_SERVICE_ACCOUNT_KEY` | Migration only. Remove after cutover. |

## Scheduled jobs

All require `Authorization: Bearer $CRON_SECRET`.

| Endpoint | Frequency | Does |
|---|---|---|
| `/api/cron/marketing-send` | every minute | Drains the send queue; enqueues scheduled campaigns that are due |
| `/api/cron/marketing-journeys` | every 5 minutes | Enrols from events, advances runs whose next step is due |
| `/api/cron/marketing-journeys?derived=1` | daily | Also evaluates derived triggers and prunes processed events |
| `/api/cron/marketing-sync` | daily | Reconciles the athlete roster into the subscriber list |
| `/api/cron/marketing-brief` | weekly | Compiles the week, drafts proposals, emails the brief |

Example Cloud Scheduler entry:

```bash
gcloud scheduler jobs create http marketing-send \
  --schedule="* * * * *" \
  --uri="https://app.hybridx.club/api/cron/marketing-send" \
  --http-method=GET \
  --headers="Authorization=Bearer ${CRON_SECRET}" \
  --location=us-central1
```

## How a send works

1. A campaign's audience is resolved and one `sends` row per recipient is
   written with `status: 'pending'`.
2. The cron claims a bounded page of pending rows. Each row moves to `sending`
   in a transaction **before** any SMTP call, so two overlapping cron runs
   cannot both mail the same person.
3. Recipients are re-checked at send time — someone who unsubscribes mid-send
   does not receive the campaign.
4. Hard bounces (SMTP 5xx) mark the subscriber `bounced`. Soft failures return
   to `pending` and retry up to three times. Unrecognised errors are treated as
   temporary, because wrongly marking a real subscriber as bounced is worse than
   a retry.
5. When nothing is left pending or in flight, the campaign is finalised.

Send doc ids are `${campaignId}_${subscriberId}`, which makes the whole pipeline
idempotent: re-enqueueing or re-draining cannot produce a second send.

## Subject A/B testing

A campaign with `abTest` sends each variant to a small slice of the audience,
picks a winner on open rate, and sends the winning subject to the remainder —
usually the large majority. That is worth more than an even split: the point is
not to measure precisely, it is to send the better subject to most people.

Assignment is a hash of `${campaignId}:${subscriberId}`, so it is deterministic
(a retry cannot hand someone a different subject than their first attempt
carried) and rotates which people are in the test group between campaigns.

The winner is decided at the top of a drain rather than on its own schedule,
because the held remainder can only be released once one exists. Below 20 sends
per variant no winner is declared and the original subject is used — at that
sample a single extra open moves the rate five points, which is noise. A gap
under two points is reported as "no clear winner" but still picks the leader, so
the send always completes.

## Conversion attribution

Tracked links to hybridx.club carry `utm_campaign=<campaignId>`, and the app
already records first-touch UTM data onto `acquisitionCampaign` at signup.
Joining the two turns "12% clicked" into "this campaign produced nine trials",
which is the only figure that answers whether a campaign was worth sending. It
is first-touch, so it under-counts rather than over-claims, and third-party
links are never tagged.

## Consent

Consent lives in two places and both must move together:
`users/{uid}.marketingConsent` (what the profile page reads) and
`marketingSubscribers/{id}.consent.marketing` (what the send path checks).
`firestore.rules` blocks direct client writes to the former, so the toggle goes
through `/api/marketing/preferences`, which updates both.

Transactional email — verification, onboarding nudges, receipts — is unaffected
by this flag and continues to use `src/lib/email-service.ts`.

A subscriber who filed a spam complaint can never be restored through the UI.
Mailing a complainant risks the sending domain's reputation for everyone else.

## Safety rails

- **Sending switch** (`/admin/marketing/settings`) halts every campaign and
  journey at the next run without losing queued work.
- **Pause all journeys** on the journeys list, for automations specifically.
- **Frequency cap**: a shared weekly budget across campaigns and journeys, so an
  automation and a broadcast cannot double up on the same athlete.
- **Journeys always save as drafts.** Activation is a separate action and, for
  anything that fires automatically, requires confirming a test send was read.
- **`exitOnConversion`** stops a journey once its purpose is met.
- **Fact validation** blocks drafts citing a price, trial length or programme
  that does not match live data, and re-runs after manual edits.

## Migration from HXMailer

```bash
HXMAILER_SERVICE_ACCOUNT_KEY='<source project json>' \
FIREBASE_SERVICE_ACCOUNT_KEY='<this project json>' \
npx tsx scripts/migrate-hxmailer.ts --dry-run
```

Reconcile the printed counts against the HXMailer admin, then re-run without
`--dry-run`. The script is idempotent.

It merges every HXMailer account's subscribers into one list, keyed by email
hash. Where the same person appears twice, tags are unioned and **any
unsubscribe wins** — losing a tag is an inconvenience, resurrecting someone who
opted out is a compliance failure. A re-run never downgrades a record that has
since unsubscribed here.

Migrated campaigns are HTML-only (no `blocks`), so they are treated as legacy
content. Their open counts come from a system with no bot filtering, so they are
recorded as `openRaw`; post-migration open rates will read lower than the
historical figures and are not directly comparable.

The Gmail OAuth `refreshToken` is deliberately not carried across.

### Cutover

1. Deploy. The console is admin-only, so nothing is public.
2. Run the migration dry-run, reconcile, then run it live.
3. Spot-check a historical campaign report.
4. Send one real campaign to an internal tag.
5. Add the Cloud Scheduler entries above.
6. Set HXMailer's App Hosting `maxInstances: 0` and keep the old project
   read-only for a month before deleting anything.
7. Remove `HXMAILER_SERVICE_ACCOUNT_KEY`.

## Delivery feedback

SMTP acceptance is not delivery: a message the relay accepts can bounce minutes
later, and a recipient can report spam days later. `/api/marketing/webhooks/brevo`
ingests those events.

Point a Brevo transactional webhook at
`https://app.hybridx.club/api/marketing/webhooks/brevo?token=$BREVO_WEBHOOK_SECRET`
for hard bounce, invalid email, blocked, spam and unsubscribe events.

| Event | Effect |
|---|---|
| `hard_bounce`, `invalid_email`, `blocked` | Subscriber marked `bounced`; the send row is marked failed |
| `spam`, `complaint` | Subscriber marked `complained` — the one status the UI cannot reverse |
| `unsubscribed` | Subscriber marked `unsubscribed` |
| `soft_bounce`, `deferred` | Nothing. Transient conditions; the queue's own retry handles them, and suppressing here would steadily delete real subscribers whose mailbox was briefly full |
| `delivered`, `opened`, `click` | Nothing. Engagement is tracked through our own signed endpoints, which filter bots |

## The weekly brief

`/api/cron/marketing-brief` is the semi-automated half of the system. Once a
week it:

1. Compiles the period — list growth, unsubscribes, bounces, complaints,
   campaign performance, journey completions — into a `marketingBriefs`
   document. Each run measures against the previous snapshot, so the brief
   reports *change* rather than lifetime totals. The first run says so rather
   than presenting a lifetime figure as a week's work.
2. Derives plain-language observations. These are computed arithmetically, not
   asked of the model: they are threshold comparisons, and a language model adds
   nothing to them but the chance of getting them wrong.
3. Asks `propose-campaigns` for one to three campaigns worth running, grounded
   in those figures and constrained to segments that exist.
4. Drives each proposal through the same `composeJourney` + `draftEmail` flows
   the studio uses, saving a full **draft** journey tagged `aiProposed`.
5. Emails the brief to `MARKETING_BRIEF_RECIPIENT` through the *transactional*
   transport — internal correspondence must not be subject to the marketing
   frequency cap or appear in campaign statistics.

**Nothing it produces can send.** Every journey is a draft, and activation still
requires reading it, sending a test and confirming, exactly as if a person had
written it. A proposal that fails to draft still reaches the inbox as a prompt
that can be pasted into the studio.

## Consolidation — one email system

Three systems could previously email the same athlete: the journeys engine,
`/api/cron/onboarding-nudge` + `/api/cron/re-engagement` (copy hard-coded in
`email-service.ts`), and `functions/src/index.ts` (a Cloud Functions drip on
Gmail using the deprecated `functions.config()` API). None shared a suppression
list, a consent check or a frequency cap with the others.

All three are now one. The onboarding nudges and the re-engagement email are
seeded as journeys:

```bash
FIREBASE_SERVICE_ACCOUNT_KEY='<json>' npx tsx scripts/seed-journeys.ts --dry-run
```

Seeded journeys are created **paused**, and re-running never touches one that
has since been activated. Before activating:

1. Read the copy in `/admin/marketing/journeys` — carried across from the old
   templates, and now editable without a deploy.
2. Send yourself a test of each email.
3. Delete the old Cloud Scheduler jobs for `onboarding-nudge` and
   `re-engagement` — those routes no longer exist.
4. Run `firebase deploy --only functions` so the retired `dailyEmailCampaigns`
   scheduled function and its scheduler job are actually removed.
5. Only then activate. Never with the old crons still running.

What the journeys gain over what they replace: consent and unsubscribe are
honoured, the shared frequency cap applies, copy is editable in the console,
opens and clicks are attributed per campaign, and delivery goes through the
authenticated hybridx.club domain rather than a Gmail account.

## Triggers wired into the app

| Event | Raised from |
|---|---|
| `signup` | `src/services/user-service.ts`, where the user document is created |
| `subscriptionCanceled`, `paymentFailed` | `src/app/api/stripe/webhook/route.ts` |
| `stravaConnected` | `src/app/api/strava/exchange/route.ts` |
| `garminConnected` | `src/app/api/garmin/exchange/route.ts` |
| `tagAdded` | `setSubscriberTags` in `actions.ts`, for newly-applied tags only |

All are emitted fire-and-forget through `emitMarketingEventAsync`, *after* the
write they describe. A marketing automation must never be able to fail a signup,
an OAuth callback, or a Stripe webhook that Stripe would then retry.

Derived triggers (`trialEndingSoon`, `onboardingStalled`, `noWorkoutAfterNDays`,
`churnRisk`, `raceDateApproaching`) are not events — nothing "happens" when a
trial starts running out — so the daily `?derived=1` sweep evaluates them
instead.
