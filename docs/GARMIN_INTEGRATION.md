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

## 6. Limitations / TODO

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
- **Verify enum IDs**: the canonical Garmin Connect step/sport/duration
  IDs in the mapper match most published partner specs, but cross-check
  against your specific Training API contract once you have it.
- **Multi-instance scaling**: `src/lib/rate-limit.ts` is in-process. Move
  to Redis if App Hosting maxInstances goes above 1.
