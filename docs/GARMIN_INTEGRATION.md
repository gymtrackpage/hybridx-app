# Garmin Integration

Two-way sync with Garmin Connect:
- **Outbound**: planned workouts pushed to the user's watch via the
  Training API and scheduled to calendar dates derived from
  `user.startDate + day`.
- **Inbound**: completed activities received via Activities API
  webhooks and stored in the `garminActivities` collection.

Auth uses **OAuth 2.0 + PKCE** as required by Garmin Connect Developer
Program (Connect's PKCE migration replaced OAuth 1.0a).

---

## 1. Garmin Developer Portal setup

In <https://developerportal.garmin.com>:

1. Create / open your application.
2. Add this OAuth redirect URI:
   ```
   https://app.hybridx.club/api/garmin/exchange
   ```
   For local dev (e.g. `npm run dev` on port 9002):
   ```
   http://localhost:9002/api/garmin/exchange
   ```
3. **Activity Push** webhook URL:
   ```
   https://app.hybridx.club/api/garmin/webhook
   ```
4. **User Permission Change / Deregistration** webhook URL:
   ```
   https://app.hybridx.club/api/garmin/deregistration
   ```
5. Note your **Client ID** and **Client Secret**.

---

## 2. Store secrets

Local development — paste values into [.env.local](../.env.local):

```bash
GARMIN_CLIENT_ID="your-client-id"
GARMIN_CLIENT_SECRET="your-client-secret"
```

Production — store the secrets in Google Secret Manager:

```bash
gcloud secrets create GARMIN_CLIENT_ID --replication-policy=automatic
echo -n "your-client-id" | gcloud secrets versions add GARMIN_CLIENT_ID --data-file=-

gcloud secrets create GARMIN_CLIENT_SECRET --replication-policy=automatic
echo -n "your-client-secret" | gcloud secrets versions add GARMIN_CLIENT_SECRET --data-file=-
```

Grant your App Hosting backend service account access:

```bash
PROJECT_ID="hyroxedgeai"
SA="$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding GARMIN_CLIENT_ID \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding GARMIN_CLIENT_SECRET \
  --member="serviceAccount:$SA" --role="roles/secretmanager.secretAccessor"
```

The bindings are also referenced in [apphosting.yaml](../apphosting.yaml).

---

## 3. Optional environment overrides

Only set these if your Partner Training API spec uses different hosts
(e.g. a sandbox):

| Variable | Default |
| --- | --- |
| `GARMIN_AUTHORIZE_URL` | `https://connect.garmin.com/oauth2Confirm` |
| `GARMIN_TOKEN_URL` | `https://diauth.garmin.com/di-oauth2-service/oauth/token` |
| `GARMIN_API_BASE` | `https://apis.garmin.com` |
| `GARMIN_SCOPES` | (none) |

---

## 4. End-user flow

1. User goes to **Profile → Garmin** card and clicks **Connect with Garmin**.
2. They are redirected to Garmin to grant access.
3. On return, tokens are persisted to `users/{uid}.garmin`.
4. They click **Sync next 14 days** — the next ~14 days of their plan
   are mapped, pushed as workouts, and scheduled to calendar dates.
5. As they complete activities on the watch, Garmin POSTs them to
   `/api/garmin/webhook`; the raw activities land in
   `garminActivities/{activityId}`.
6. Disconnecting calls Garmin's `DELETE /wellness-api/rest/user/registration`
   and clears local tokens.

---

## 5. Endpoints

| Route | Purpose |
| --- | --- |
| `POST /api/garmin/connect` | Builds an authorize URL with PKCE, stores `code_verifier` on the user doc |
| `GET  /api/garmin/exchange` | OAuth callback — exchanges `code` + verifier for tokens |
| `POST /api/garmin/disconnect` | Revokes the partner registration and clears tokens |
| `POST /api/garmin/sync-plan` | Pushes & schedules the next 14 days of the user's plan |
| `POST /api/garmin/webhook` | Receives activity push from Garmin |
| `POST /api/garmin/deregistration` | Receives Garmin user-deregistration ping |

---

## 6. How a run session is built

A run day is built from its stored `PlannedRun` rows rather than by reading
the joined description text. `program-adapter.ts` settles each row on one
unit — a duration the description states, then the row's stored distance,
then a distance the description states — and hands the mapper a `RunStepSpec`.
A step is timed or measured, never both.

Two guards matter, and both exist because the plans are written for humans:

- A time introduced by "hold for", "every", "each", "before" or "after" is an
  aside, not a length. Without this, "5km at Threshold pace (a pace you could
  hold for approx. 1 hour)" goes to the watch as an hour-long run.
- A duration is rejected when it could not cover the row's stored distance —
  outside 2:30/km to 20:00/km. Rows that pack a session into shorthand
  ("WU 10. 3x90s at 6% incline, 2 min walk. CD 5." over 5.2 km) otherwise
  send the walk as the whole session.

Sessions with repeats, and those whose titles name interval work, are
bookended: a stored warm-up or cool-down is honoured in its own unit, and only
a session with neither gets a 15-minute warm-up and a lap-press cool-down. Rep
recovery is never left open — the row's own figure where it gives one,
otherwise 2 minutes after a rep of a kilometre or three minutes and over, 90
seconds below that.

Rest days stored as an empty run row push nothing. Their `sessionType` is
`run`, so they bypass the classifier; without the check, `mapRunEasy`'s
30-minute default sent every rest day to the watch as a half-hour run.

Days that come from a CSV import carry no `RunStepSpec` and still map through
the older text-parsing builders.
## 6. How the outbound sync avoids duplicates

Both the on-demand route and the nightly cron delegate to the reconciler in
[src/lib/garmin/plan-sync.ts](../src/lib/garmin/plan-sync.ts). It is a
*reconcile*, not a re-push:

- **Every pushed session carries a content hash** (`garminPlanSync.workouts[key].hash`).
  A session whose mapped content and calendar date are unchanged is left
  completely alone — a repeat sync of an unchanged plan makes zero Garmin write
  calls. This is the main defence against duplicates: nothing is deleted and
  re-created unless it actually changed.
- **Keys are `${day}_${sessionIndex}`**, indexed over *all* sessions of that day
  gathered across every program row for the day. Two program rows can share a
  `day` (the CSV importer buckets by `day::title`), and under the old bare-`day`
  key they overwrote each other in the record — orphaning one real workout per
  sync. Legacy bare-`day` keys are migrated on read.
- **State is persisted after every mutation**, not once at the end. If the run
  is cut short (route timeout, or the fire-and-forget sync being cancelled when
  the page navigates), the record still reflects exactly what is on the watch,
  so the next run replaces rather than duplicates.
- **Replacing unschedules before deleting.** Deleting the workout does not
  reliably clear its calendar entry, so the schedule goes first.
- **Failed removals are queued**, not swallowed: `garminPlanSync.pendingDeletes`
  is retried on every later sync until Garmin confirms the workout is gone
  (a 404 counts as gone).
- **One sync per athlete at a time**, enforced by a 5-minute lease in
  `users/{uid}.garminSyncLock`
  ([src/lib/garmin/sync-lock.ts](../src/lib/garmin/sync-lock.ts)). The card
  button, the program-change push and the cron can all fire at once; without
  the lease each would read the same record and push its own copy. The
  on-demand route returns **409** when a sync is already running.

Anything outside the horizon window is left untouched: past days are the
athlete's history, and days beyond the horizon are still-valid future workouts.

> **Cleaning up duplicates created before this change.** Copies that were
> pushed but never recorded are invisible to the reconciler — there is no local
> id for them. Delete them in Garmin Connect (Training → Workouts, and the
> calendar entries), or disconnect and reconnect the account and re-sync.
> Everything pushed from now on is tracked.

---

## 7. Limitations / TODO

- **Strength weights aren't pushed** — the mapper omits `weightValue`
  until per-user 1RM data is wired through. Fill it in at
  [src/lib/garmin/workout-mapper.ts](../src/lib/garmin/workout-mapper.ts) `mapStrength()`.
- **Hyrox simulations** are emitted as a single OTHER step with the
  full prose. Switch to per-station OTHER steps once the simulation
  schema supports it.
- **Activity → WorkoutSession linking** is not yet implemented; the
  webhook just persists raw payloads. Add a downstream worker that
  matches `garminActivities` against `workoutSessions` by date or
  scheduled workout id.
- **Webhook auth** — Garmin uses IP-allowlisting rather than signed
  headers for partner webhooks. If your portal exposes a verifying
  secret/signature, validate it inside the webhook route.
- **Enum IDs are verified** against Training API V2 v1.0 (26/05/2025)
  §3.2.1: sports, intensities, duration types and repeat types all
  conform, and no workout comes near the 100-step or 512-character
  limits. Two things remain open. `durationValueType` is described as a
  modifier for HR and POWER only, yet every DISTANCE example in the spec
  sets it to `METER` — we currently send `null`, so confirm which is
  right. And the `exerciseCategory` / `exerciseName` enums live in
  Appendix B, an Excel file supplied separately, so the lookup table in
  `program-enricher.ts` is still unchecked against them.

- **Targets are only as good as the athlete's zones.** A zone target sets
  `targetType: 'HEART_RATE'` with the zone in `targetValue` (1-5);
  `targetValueLow`/`High` are for a custom bpm range instead. The spec
  notes the zones must already be defined and saved on the athlete's
  Garmin account, so a workout can arrive with a zone the watch has no
  bounds for.
- **Multi-instance scaling**: `src/lib/rate-limit.ts` is in-process. Move
  to Redis if App Hosting maxInstances goes above 1.
