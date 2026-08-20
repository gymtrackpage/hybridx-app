# Deploying Firestore rules and indexes

## Why this is separate from the app deploy

Firebase App Hosting builds and deploys the **Next.js app only**. It does not
read `firestore.rules` or `firestore.indexes.json`. Pushing to `main` therefore
ships new application code against whatever rules and indexes the live project
happened to already have.

That gap caused a multi-day production outage in the program-scheduling flow.
The app shipped `workoutSessions` queries whose composite indexes had never been
created, so they failed at runtime with
`FAILED_PRECONDITION: The query requires an index`. Because those queries run in
the browser, the failures never appeared in Cloud Logging either — the server
logs were clean while the dashboard and calendar rendered empty.

`.github/workflows/firestore-config.yml` closes the gap: it applies both files
whenever they change on `main`.

## One-time setup

### 1. Make `firestore.indexes.json` a superset of production first

Indexes have historically been created by hand in the Firebase console and never
written back to this repo, so production contains indexes the file does not.
Deploying the file as-is risks the CLI proposing to delete them.

From a machine with the Firebase CLI authenticated to `hyroxedgeai`:

```bash
firebase firestore:indexes --project hyroxedgeai > /tmp/live-indexes.json
```

Diff that against `firestore.indexes.json`, add anything the live project has
that the repo lacks, and commit the result. After this, the file describes
everything production relies on.

### 2. Add the `FIREBASE_SERVICE_ACCOUNT` secret

Create (or reuse) a service account in the `hyroxedgeai` project with:

- **Firebase Rules Admin** (`roles/firebaserules.admin`)
- **Cloud Datastore Index Admin** (`roles/datastore.indexAdmin`)

Download a JSON key and add it under
**GitHub → Settings → Secrets and variables → Actions** as
`FIREBASE_SERVICE_ACCOUNT`, pasting the whole JSON document.

## Deploying by hand

The workflow runs the same command you can run locally:

```bash
npm run deploy:firestore
```

## Adding a query that needs a new index

Composite indexes are needed whenever a query combines an equality filter with a
range/`orderBy` on a *different* field, or combines several filters. Firestore
rejects such a query outright until the index exists.

1. Add the index to `firestore.indexes.json` in the same PR as the query.
2. Merge to `main` — the workflow applies it.
3. Wait for the index to report **Enabled** (not *Building*) in the console
   before relying on it; a building index fails exactly like a missing one.

If you hit a missing index at runtime, the Firestore error carries a
`console.firebase.google.com/.../indexes?create_composite=...` link that creates
precisely the right index. Use it to unblock, then **write the same index into
`firestore.indexes.json`** so the repo does not drift again.

> Client-side Firestore errors surface in the browser console, not in Cloud
> Logging. `src/lib/logger.ts` prints the error type, code and message in
> production so these stay diagnosable.
