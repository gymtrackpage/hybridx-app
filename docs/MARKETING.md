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
| `marketingSettings/config` | Sender, batch size, frequency cap, sending switch |

## Environment

| Variable | Purpose |
|---|---|
| `BREVO_SMTP_USER`, `BREVO_SMTP_KEY` | Bulk delivery. Sending is blocked without them. |
| `MARKETING_TOKEN_SECRET` | Signs unsubscribe and tracking links. Minimum 32 characters; sending is blocked without it, rather than emitting forgeable links. |
| `MARKETING_EMAIL_FROM` | Campaign From address. Keep separate from `EMAIL_FROM` so a bad campaign cannot damage delivery of verification email. |
| `MARKETING_EMAIL_FROM_NAME` | Display name, defaults to HYBRIDX. |
| `MARKETING_PRICE_LABEL` | Price shown in AI-drafted copy. Defaults to `£5/month`. |
| `CRON_SECRET` | Shared bearer secret for the cron endpoints. |
| `HXMAILER_SERVICE_ACCOUNT_KEY` | Migration only. Remove after cutover. |

## Scheduled jobs

All require `Authorization: Bearer $CRON_SECRET`.

| Endpoint | Frequency | Does |
|---|---|---|
| `/api/cron/marketing-send` | every minute | Drains the send queue; enqueues scheduled campaigns that are due |
| `/api/cron/marketing-journeys` | every 5 minutes | Enrols from events, advances runs whose next step is due |
| `/api/cron/marketing-journeys?derived=1` | daily | Also evaluates derived triggers and prunes processed events |
| `/api/cron/marketing-sync` | daily | Reconciles the athlete roster into the subscriber list |

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

## Known follow-up

`functions/src/index.ts` is a legacy Cloud Functions drip that still sends via
Gmail using the deprecated `functions.config()` API, overlapping
`/api/cron/onboarding-nudge`. Once journeys are live it should be retired and
its drips rebuilt as authored journeys — otherwise two systems email the same
athletes the same nudges.
