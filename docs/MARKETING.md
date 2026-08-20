# Marketing system

The HXMailer mailing system, merged into this codebase. Campaigns, subscribers,
automated journeys and delivery all live under `/admin/marketing`.

## The three properties

HYBRIDX spans three Next.js apps in three Firebase projects. Knowing which is
which explains most of the architecture below.

| Property | Repo | Firebase project | Owns |
|---|---|---|---|
| `hybridx.club` | `gymtrackpage/hybridx-web` | `hybridx-hub` | Marketing site, lead magnets, SEO |
| `app.hybridx.club` | `gymtrackpage/hybridx-app` | `hyroxedgeai` | The app, and **this** marketing system |
| — | `gymtrackpage/HXMailer` | `studio-2581739992-b1f46` | The old mailer, being retired |

**The campaign manager is in the app**, at `app.hybridx.club/admin/marketing`,
behind the admin layout guard (`users/{uid}.isAdmin`). The marketing site has
its own unrelated admin at `hybridx.club/admin/leads` gated by `ADMIN_EMAILS`,
which shows that project's raw `leads` collection — a local view of its own
capture, not a second campaign tool.

What connects them:

- **GA4 cross-domain linker** (`src/app/layout.tsx`) stitches a visitor's
  session across both domains.
- **`TrackedLink`** on the marketing site forwards UTM params onto absolute
  cross-domain CTAs, so `captureAttribution` on the app records first-touch
  attribution and campaigns get credit for the signups they drive.
- **The lead bridge** (below) pushes captured leads into this system and shares
  one suppression list.

## Layout

```
src/lib/marketing/
  types.ts          data model
  sources.ts        the intake registry — every route in, declared once
  activity.ts       athlete counters + behavioural events, from the session stream
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
| `marketingSettings/activity` | Cursor for the workout-session scan; `caughtUp` gates event emission |

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
| `LEAD_BRIDGE_SECRET` | Server-to-server credential for the marketing-site bridge — lead intake, suppression lookups and custom events. Must be the SAME value in `hyroxedgeai` and `hybridx-hub`. Minimum 32 characters; unset fails closed. |
| `HXMAILER_SERVICE_ACCOUNT_KEY` | Migration only. Remove after cutover. |

## Scheduled jobs

All require `Authorization: Bearer $CRON_SECRET`.

| Endpoint | Frequency | Does |
|---|---|---|
| `/api/cron/marketing-send` | every minute | Drains the send queue; enqueues scheduled campaigns that are due |
| `/api/cron/marketing-journeys` | every 5 minutes | Advances the activity scan, enrols from events, advances runs whose next step is due |
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

### Cutover — ordered

The steps below have real dependencies. Doing them out of order either
double-mails people or silently sends nothing.

**1 — Secrets, before any deploy**

| Secret | Project | Note |
|---|---|---|
| `MARKETING_TOKEN_SECRET` | `hyroxedgeai` | 32+ chars. Sending fails closed without it. |
| `BREVO_WEBHOOK_SECRET` | `hyroxedgeai` | Bounces and complaints go unrecorded without it. |
| `LEAD_BRIDGE_SECRET` | **both** `hyroxedgeai` and `hybridx-hub` | **Same value in both.** The app verifies it; the site sends it. |
| `SMTP_USER` / `SMTP_PASSWORD` | `hybridx-hub` | Point at the Brevo credentials. |

Authenticate the campaign sender (SPF/DKIM/DMARC) in Brevo and set
`MARKETING_EMAIL_FROM`. Warm it before the first large send.

**2 — Deploy both apps.** Everything is admin-gated, so nothing is public and
nothing sends yet: no scheduler jobs exist and every journey is a draft.

**3 — Verify before trusting anything.** Open `/admin/marketing/settings`; all
five health checks must be green. They read from the running process, so this
catches a secret that was created but not bound.

**4 — Migrate.** Dry-run `scripts/migrate-hxmailer.ts`, reconcile the counts
against the HXMailer admin, then run it live. Spot-check a historical report.

**5 — Switch the marketing site to Brevo.** Send a test magnet from
`hybridx.club` and confirm it arrives. **Only then** remove `RESEND_API_KEY` —
while that secret exists the code still prefers Resend, which is the rollback.

**6 — Retire the legacy drips, in this order:**
   a. Delete the old Cloud Scheduler jobs for `onboarding-nudge` and
      `re-engagement`. Those routes no longer exist.
   b. `firebase deploy --only functions` — deploying the now-empty function set
      is what removes `dailyEmailCampaigns` and its scheduler job.
   c. `npx tsx scripts/seed-journeys.ts`, read each seeded journey, test-send
      each email, then activate. **Never before (a) and (b)** — otherwise two
      systems mail the same athletes the same nudges.

**7 — Add the Cloud Scheduler jobs** from the table above, and point the Brevo
webhook at `/api/marketing/webhooks/brevo?token=$BREVO_WEBHOOK_SECRET`.

**8 — First real send.** One campaign to an internal tag. Check the raw headers
carry `List-Unsubscribe`, click the unsubscribe, confirm the subscriber flips.

**9 — Afterwards.** Remove `HXMAILER_SERVICE_ACCOUNT_KEY`. Leave HXMailer
read-only (`maxInstances: 0`) for a month before deleting the project.

## The lead bridge

The marketing site captures the top of the funnel — the VO2max guide, the
race-day card, the free plan — into its own `leads` collection in `hybridx-hub`.
Two endpoints connect that to this system:

| Endpoint | Purpose |
|---|---|
| `POST /api/marketing/leads` | Takes a lead at write time, so someone is mailable seconds after submitting rather than after a manual export. Magnet names become tags, UTMs become first-touch attribution. |
| `GET /api/marketing/suppression?email=` | One suppression list across both properties. Reports `suppressed` and, separately, `complained`. |
| `POST /api/marketing/events` | Behavioural signals from the site, raised as `apiEvent`. Names come from a server-side allow-list. |

Both authenticate with `LEAD_BRIDGE_SECRET`, compared in constant time and
failing closed when unset. Deliberately **not** `CRON_SECRET`: the marketing
site should not hold a credential that also unlocks the send cron. The secret
must be identical in both Firebase projects — the app verifies it, the site
sends it.

**Consent is carried, not assumed.** Single opt-in magnets forward with consent,
because those forms state that signing up means ongoing email. The race-card
magnet uses confirmed opt-in, so its pending write forwards *without* consent
and only the confirmation click grants it — someone who has been sent a
confirmation link has not yet given one.

**Only complaints block the marketing site's own sends.** Everything it sends
was requested seconds earlier; withholding a guide because the person once
unsubscribed from a campaign fails them while solving nothing. A complaint is
different, because mailing a complainant again endangers delivery for everyone
on a domain both properties share. The check fails open, so a bridge outage
cannot break lead magnets.

**One ESP.** The marketing site sends through the same Brevo relay and sending
domain as the app, so one sender reputation is built rather than two. Its
`RESEND_API_KEY` binding is commented out rather than deleted: `getEmailProvider()`
prefers Resend whenever that key is present, which makes re-adding the secret
the rollback.

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

## Intake routes

Every address enters through one **route**, declared once in
`src/lib/marketing/sources.ts`. A route carries its label, the tags it applies,
the property it belongs to, and — importantly — its consent posture. Adding an
intake path is one registry entry rather than a scattering of literals across
route handlers.

| Route | Property | Consent | Arrives from |
|---|---|---|---|
| `magnet-free-plan` | hybridx.club | implied | Free HYROX plan download |
| `magnet-vo2max` | hybridx.club | implied | Build a Bigger Engine guide |
| `magnet-race-card` | hybridx.club | **confirmed** | Race day rules card |
| `website-signup` | hybridx.club | implied | Direct sign-up, no magnet |
| `website-other` | hybridx.club | none | Fallback for an unrecognised source |
| `app-homepage` | app.hybridx.club | explicit | Homepage capture form |
| `app-account` | app.hybridx.club | none | Account creation |
| `beta-android` | app.hybridx.club | none | Android beta request |
| `admin-manual` | admin | none | Added by hand in the console |
| `admin-import` | admin | none | CSV import |
| `account-sync` | admin | none | Nightly athlete reconciliation |
| `migration` | admin | none | Carried over from HXMailer |

Consent postures: `implied` (the form says signing up means ongoing email),
`explicit` (a marketing checkbox was ticked), `confirmed` (nothing until the
confirmation link is clicked), `none` (the address is known, not mailable).

Every subscriber carries a `route:<id>` tag and a `route` field, so the console
can filter by origin and any journey can be narrowed to one route. Route tags
are applied by the registry, never taken from a request — the bridge strips
`route:` from any tags the marketing site sends, so an origin cannot be forged.

**Bulk intake raises events like any other.** A CSV import of 5,000 rows emits
5,000 `subscriberCreated` events. That is correct — an imported contact should
be as reachable by automation as any other — but it means a *route-less* welcome
journey would enrol the whole file. The seeded welcome journeys are each scoped
to a route, and none of them to `admin-import`, so an import matches nothing by
default. Keep it that way, or pause journeys before a large import.

**The marketing site keeps its own vocabulary.** It sends `source` values like
`build_a_bigger_engine`; `aliases` on the registry map them. An unrecognised
name resolves to `website-other` rather than being rejected, so a new magnet
does not require both projects to deploy in lockstep — the lead lands, tagged
`route:unclassified`, which is the prompt to add a proper entry.

## Triggers wired into the app

| Event | Raised from |
|---|---|
| `subscriberCreated` | `captureLead()` — any route, the first time an address is seen |
| `consentGranted` | `captureLead()` — when someone becomes mailable, including a confirmation click |
| `signup` | `src/services/user-service.ts`, where the user document is created |
| `firstWorkoutCompleted`, `workoutMilestone` | `lib/marketing/activity.ts`, from the session stream |
| `programStarted` | `lib/marketing/sync.ts`, by diffing the mirrored `programId` |
| `apiEvent` | `POST /api/marketing/events`, from the marketing site |
| `subscriptionCanceled`, `paymentFailed` | `src/app/api/stripe/webhook/route.ts` |
| `stravaConnected` | `src/app/api/strava/exchange/route.ts` |
| `garminConnected` | `src/app/api/garmin/exchange/route.ts` |
| `tagAdded` | `setSubscriberTags` in `actions.ts`, for newly-applied tags only |

All are emitted fire-and-forget through `emitMarketingEventAsync`, *after* the
write they describe. A marketing automation must never be able to fail a signup,
an OAuth callback, or a Stripe webhook that Stripe would then retry.

**Use `consentGranted`, not `subscriberCreated`, for a nurture sequence.**
Creation says we know someone; consent says we may mail them. On a single
opt-in route the two fire together, but on the confirmed opt-in race-card route
creation happens when the card is *requested* and consent only when the link is
clicked. A welcome journey keyed on creation would enrol people who never
confirmed, and then never send to them — the engine refuses to mail without
consent, so the run would sit there looking active and doing nothing.

Any event trigger can be narrowed with `trigger.route`, so "welcome the people
who took the VO2max guide" and "welcome everyone" are the same journey with and
without that field. A route-less welcome journey will overlap with every
route-scoped one; the shared frequency cap prevents a pile-up, but scoping each
journey to a route is the clearer design.

The nightly athlete sync deliberately raises **no** events. It is
reconciliation, not intake: emitting `subscriberCreated` for the existing roster
would enrol the entire back catalogue into whatever welcome journey is live.

### Athlete activity, and the counter that was never written

`lib/marketing/activity.ts` walks the `workoutSessions` stream from a stored
cursor, maintains `users/{uid}.completedWorkouts` and `lastWorkoutAt`, and
raises `firstWorkoutCompleted` and `workoutMilestone`.

It reads the session stream rather than hooking a completion handler because
there isn't one: workouts are finished by the **client** Firestore SDK through
at least four paths (active workout, manual log, Strava-linked activity,
import). Reading the stream catches every path by construction.

It also repairs a field that was never persisted. `completedWorkouts` was on the
`User` type and read by segments, engagement tags and two derived triggers — but
the only code that set it was `getAllUsers()`, which computes it in memory for
the admin table. Every athlete document therefore read back `undefined`:

- `churnRisk` requires `completedWorkouts >= 3`, so it could never fire.
- `noWorkoutAfterNDays` requires it to be `0`, so it matched **every** athlete
  in the window, including people training four times a week. The seeded
  re-engagement journey uses that trigger.
- Every athlete was tagged `engagement:none`, making that dimension meaningless.

**Backfill and steady state are the same loop.** While the scan is still walking
history, `caughtUp` is false and it corrects counters silently — emitting
milestones for workouts finished months ago would mail the back catalogue a
congratulations note. Once it reaches the end of the stream it flips to
emitting. There is no separate backfill script to forget to run.

`completedWorkouts` and `lastWorkoutAt` are in the protected-fields list in
`firestore.rules`: a client that could set them could place itself into any
engagement segment.

### Triggers that were removed rather than left unwired

`streakMilestone` and `programCompleted` are no longer in the vocabulary.
Nothing could raise either, but both were offered in the studio and to the AI
composer — so a journey could be built on one, activated, and silently enrol
nobody for ever. A trigger that cannot fire is worse than a missing feature,
because it fails quietly.

| Trigger | What it would need |
|---|---|
| `streakMilestone` | Streaks are computed in the browser (`utils/streak-calculator.ts`) and never stored. Persist a streak alongside `completedWorkouts` in `activity.ts`, then emit on crossings. |
| `programCompleted` | A cleared `programId` cannot be told apart from switching plans or giving up, and congratulating someone who quit is worse than staying quiet. Needs a real completion signal — programme length against `startDate`, or an explicit "finished" action. |

`programStarted` **is** wired, by mirroring `programId` onto the subscriber in
the nightly sync and emitting on a change. Programmes are assigned by the client
writing straight to the user document, so a diff is the only reliable signal. An
absent mirror means "never seen", which is what stops the first sync after
deploy treating the whole roster as having just started one.

### `segmentEntered`

Now implemented. The sweep resolves the watched segment, diffs it against the
`matchedSegments` mirror on each subscriber, and enrols only those who have
*started* matching — otherwise someone who matches "churn risk" would be
re-enrolled every night for as long as they kept matching. Leaving the segment
clears the mirror, which is what lets a genuine re-entry fire later.

The first evaluation of a segment seeds membership without enrolling anyone.
Everyone matching when a journey goes live was already there rather than newly
arrived, and treating them as new would mail the whole segment at once.

`validateJourney` now requires a `segmentId`. Previously the trigger was exempt
from the day-count check and the engine had no case for it, so a journey could
pass validation, go live, and do nothing — the failure mode that looks like
success at every step.

### Custom events from the marketing site

`POST /api/marketing/events` (behind `LEAD_BRIDGE_SECRET`) raises an `apiEvent`.
Before it existed the bridge could carry one thing — "this address exists" —
so nothing the marketing site knew about behaviour could reach an automation.

Event names come from an allow-list in `events.ts`, not the request: the site is
a separate deployment holding a shared secret, and letting it invent names would
mean a journey triggered by a string nobody in this codebase has seen. Payloads
are reduced to at most ten scalar values. Either `email` or `userId` is
required — the engine discards events it cannot attribute, so accepting one
without an identity would be a silent no-op.

Derived triggers (`trialEndingSoon`, `onboardingStalled`, `noWorkoutAfterNDays`,
`churnRisk`, `raceDateApproaching`) are not events — nothing "happens" when a
trial starts running out — so the daily `?derived=1` sweep evaluates them
instead.
