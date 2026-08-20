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

Needs the `gcloud` and `gh` CLIs, both authenticated against an account that can
administer the project. Steps 1-3, 5 and 6 run from anywhere; **step 4 must run
from the repository root**, because `firebase deploy` reads `firebase.json` to
know which files to apply. Run it elsewhere and it exits with
`Not in a Firebase app directory` — the verification is skipped, not passed.

```bash
PROJECT_ID=hyroxedgeai
REPO=gymtrackpage/hybridx-app
SA_NAME=github-firestore-deploy
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# 1. Create the service account.
gcloud iam service-accounts create "$SA_NAME" \
  --project="$PROJECT_ID" \
  --display-name="GitHub Actions Firestore config deploy"

# 2. Grant only what deploying rules and indexes needs.
for ROLE in roles/firebaserules.admin roles/datastore.indexAdmin roles/firebase.viewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None
done

# 3. Mint a key.
gcloud iam service-accounts keys create ./firebase-sa.json \
  --iam-account="$SA_EMAIL" \
  --project="$PROJECT_ID"

# 4. Prove the roles are sufficient BEFORE trusting CI with them.
#    Must run from the repo root (needs firebase.json), and only after step 1
#    above (the index export), or it may propose deleting indexes that
#    production relies on. Note the absolute path to the key.
cd /path/to/hybridx-app
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/firebase-sa.json \
  npx --yes firebase-tools@14 deploy \
    --only firestore:rules,firestore:indexes \
    --project "$PROJECT_ID" --non-interactive

# 5. Store it as the repository secret the workflow reads.
gh secret set FIREBASE_SERVICE_ACCOUNT --repo "$REPO" < /absolute/path/to/firebase-sa.json

# 6. Delete the local copy — it is a long-lived credential.
rm -f /absolute/path/to/firebase-sa.json
```

If step 4 was skipped, the workflow run below is the verification instead — it
performs the same deploy from a checkout, so a missing role surfaces there. That
is a valid substitute; there is no need to mint a second key just to re-test.

Then trigger the workflow once by hand to confirm it works end to end:

```bash
gh workflow run firestore-config.yml --repo "$REPO"
gh run watch --repo "$REPO"
```

Notes:

- If step 3 fails with a policy error, the org enforces
  `constraints/iam.disableServiceAccountKeyCreation`. Use
  [Workload Identity Federation](https://github.com/google-github-actions/auth#workload-identity-federation)
  instead of a key — it is the better option regardless, since it issues
  short-lived credentials and leaves nothing to leak or rotate.
- If step 4 fails on a permission the roles above do not cover, add
  `roles/firebase.developAdmin` rather than reaching for `roles/editor`.
- Without `gh`, paste the contents of `firebase-sa.json` into
  **GitHub → Settings → Secrets and variables → Actions** as
  `FIREBASE_SERVICE_ACCOUNT`.

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
