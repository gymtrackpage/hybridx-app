# Project notes for Claude

## Infrastructure

- **Firebase project ID:** `hyroxedgeai`
- **Firebase App Hosting backend name:** `studio`
  - Used as `--backend studio` for commands like `firebase apphosting:secrets:grantaccess`.
  - Confirm with `firebase apphosting:backends:list --project hyroxedgeai` if a deploy
    ever shows more than one backend — this note assumes there's still just the one.

## Deploy gotchas

Firebase App Hosting (`apphosting.yaml`) only redeploys the Next.js app itself when
you push. The following are **not** part of that pipeline and need their own manual
step whenever they change:

- **Firestore rules / indexes** (`firestore.rules`, `firestore.indexes.json`):
  ```bash
  firebase deploy --only firestore:rules,firestore:indexes --project hyroxedgeai
  ```
  Forgetting this after adding a new collection or rule means the *live* rules are
  stale — reads/writes to anything new get denied for every user, which surfaces as
  a generic "Missing or insufficient permissions" error with no obvious cause.

- **New secrets referenced in `apphosting.yaml`**: adding a `secret:` entry there
  isn't enough — the secret must exist in Secret Manager *and* the App Hosting
  backend's service account must be granted access to it, or the build fails with
  `fah/misconfigured-secret`:
  ```bash
  # create/update the secret value
  echo -n "<value>" | firebase apphosting:secrets:set SECRET_NAME --project hyroxedgeai
  # grant the backend read access
  firebase apphosting:secrets:grantaccess SECRET_NAME --project hyroxedgeai --backend studio
  ```
  `grantaccess` also accepts a comma-separated list of secret names in one call.
