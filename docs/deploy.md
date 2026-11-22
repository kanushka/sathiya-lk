# Deploying

Two Firebase projects: production `sathiya-lk` (alias `default`) and staging `sathiya-lk-staging` (alias `staging`), both in `.firebaserc`. Hosting targets `web` and `app` map to a site per project:

| Target | Production site | Staging site |
|---|---|---|
| `web` | `sathiya-lk` | `sathiya-lk-staging-web` |
| `app` | `sathiya-lk-portal` | `sathiya-lk-staging-app` |

Production deploys only from `main`, after the same build was checked on staging.

## 1. Create the staging project (once)
1. Firebase console → add project `sathiya-lk-staging`.
2. Upgrade to Blaze (functions and extensions need it) and add a budget alert (e.g. 5 USD) in Google Cloud billing.
3. Authentication → enable Email/Password. Settings → Authorized domains → add `staging.sathiya.kanushka.com` and `app.staging.sathiya.kanushka.com`.
4. Firestore database: create in the same location as production (native mode). Storage: create the default bucket.
5. Hosting: add two sites, `sathiya-lk-staging-web` and `sathiya-lk-staging-app` (these ids are what `.firebaserc` maps; if the console gives different ids, update `.firebaserc`).
6. Project settings → add two web apps (website and app). Copy their config into `stagingWebConfig` / `stagingAppConfig` in `packages/firebase-config/src/index.ts` (replace the `REPLACE_WITH_...` placeholders; these are public values, not secrets). The app picks them when built with `VITE_FIREBASE_ENV=staging` (already set in `apps/app/.env.staging`).
7. App Check: follow "App Check" below for `sathiya-lk-staging`, with a key for `app.staging.sathiya.kanushka.com`, committed in `apps/app/.env.staging`. For a debug token (local testing against staging): App Check → Apps → Manage debug tokens; put it in `apps/app/.env.staging.local` (git-ignored) as `VITE_APPCHECK_DEBUG_TOKEN`. Staging-mode builds honour it because `.env.staging` sets `VITE_APPCHECK_ALLOW_DEBUG=true`; production-mode builds never use it.
8. Email: install the Trigger Email from Firestore extension in the staging project and set up Resend as in `docs/email/setup.md` (use a sender on a domain Resend has verified). Functions params for staging live in `functions/.env.sathiya-lk-staging` (URLs and `MAIL_SUBJECT_PREFIX=[staging]`, so test mails are marked). Authentication → Settings → Authorized domains → add `app.staging.sathiya.kanushka.com`. No custom action URL is needed: `sendAuthEmail` puts verify/reset links on `APP_URL/auth/action` itself (see `docs/email/setup.md` §4).
9. Custom domains: Hosting → connect `staging.sathiya.kanushka.com` to the staging `web` site and `app.staging.sathiya.kanushka.com` to the staging `app` site; add the DNS records shown.
10. Deploy rules/indexes once with the commands below.

## 2. Deploy to staging
```bash
pnpm install --frozen-lockfile
pnpm --filter functions build
pnpm build:staging          # app (vite --mode staging) + web with staging URLs
firebase deploy -P staging --only hosting,functions,firestore,storage
```
The same can be run from GitHub Actions: Actions → "Deploy staging" → Run workflow. It needs the repository secret `FIREBASE_SERVICE_ACCOUNT_STAGING` (JSON key of a service account in the staging project with Firebase Admin and Cloud Functions Admin roles; also Service Account User on the default compute service account).

## 3. Deploy to production
From `main`, after checking the change on staging. Before the first production deploy, do "App Check" below for `sathiya-lk` and the console steps in `docs/email/setup.md` (no custom Auth action URL is needed).
```bash
pnpm install --frozen-lockfile
pnpm --filter functions build
pnpm build                  # app and web with production URLs
firebase deploy -P default --only hosting,functions,firestore,storage
```
The same can be run from GitHub Actions, below.

### Production deploy workflow
Actions → "Deploy production" (`.github/workflows/deploy-prod.yml`) → Run workflow, from `main`. A `guard` job fails any other ref before the `production` environment is touched. The workflow runs the `ci-fast` checks, builds, then deploys `hosting:app` first and `hosting:web,functions,firestore,storage` second (the App Check order below). A running deploy is never cancelled; at most one more run waits behind it (a newer one replaces it), and a run waiting for approval holds that slot.

Set up once (repository → Settings → Environments):
1. Create the environment `production`.
2. Deployment branches and tags → **Selected branches** → add `main`.
3. Required reviewers → add yourself (and anyone else who may approve a production deploy). Optionally tick "Prevent self-review" once there is a second maintainer.
4. Environment secret `FIREBASE_SERVICE_ACCOUNT_PROD`: the JSON key of a service account in `sathiya-lk` with **Firebase Admin**, **Cloud Functions Admin** and **Service Account User** (the last on the default compute service account `<project-number>-compute@developer.gserviceaccount.com`, which gen-2 functions run as). Google Cloud console → IAM & Admin → Service accounts → create `github-deploy-prod` → grant the roles → Keys → Add key → JSON. Paste the whole file, then delete the local copy. The workflow writes it to a temp file and removes it when the step exits.
5. Environment secret `FUNCTIONS_ENV_PROD`: the full contents of `functions/.env.sathiya-lk` (multi-line, `KEY=value` per line), e.g. `SUPER_EMAILS=…` or `ENFORCE_APP_CHECK=false`. It is a secret rather than a variable because it can hold email addresses. Keep it in step with the file you use for hand deploys. A deploy replaces the functions env as a whole, so without it every production override is dropped; the workflow therefore fails when it is unset, unless the run ticks `use_committed_functions_env` to deploy only the committed `functions/.env`.

Before the first run: the service account cannot do one-time project setup, so do one deploy by hand as an Owner first (enables APIs and service-agent bindings), and run `firebase functions:artifacts:setpolicy -P default` once so the non-interactive deploy is not stopped by the Artifact Registry cleanup prompt. The workflow never deletes functions (`--non-interactive` without `--force` aborts instead, after `hosting:app` has already gone out); when a function is removed from source, delete it by hand first with `firebase functions:delete <name> -P default`.

## App Check
Every callable function enforces App Check (`functions/src/lib/callOptions.ts`) unless `ENFORCE_APP_CHECK=false` is set in the project's functions env. An app built without `VITE_APPCHECK_SITE_KEY` sends no App Check token, so every callable (register, save, publish, …) fails with `unauthenticated`. The `app` hosting target's predeploy (`apps/app/deploy/check-app-check.mjs`, also a step in the staging and production workflows) therefore refuses to deploy a build without a site key while the target project enforces App Check. It reads `apps/app/dist/.build-env.json` (written by the build, never uploaded) and `functions/.env` + `functions/.env.<project id>`. `firebase deploy --only functions` does not run it, so keep the order below.

Per project (production `sathiya-lk` / app domain `app.sathiya.kanushka.com`; staging `sathiya-lk-staging` / `app.staging.sathiya.kanushka.com`):
1. Google Cloud console (that project) → Security → Fraud Defense (formerly reCAPTCHA Enterprise) → enable the API if asked → **Create key**: type **Website**, score-based (no checkbox challenge), domains: the app domain plus `<site>.web.app` and `<site>.firebaseapp.com` (production: `app.sathiya.kanushka.com`, `sathiya-lk-portal.web.app`, `sathiya-lk-portal.firebaseapp.com`). Copy the key ID: that is the **site key**. reCAPTCHA Classic (v3) is deprecated in App Check; don't use it.
2. Firebase console → App Check → Apps → the **app** web app → Fraud Defense → paste the site key → Save. This registers the web app with App Check.
3. Put the site key in `apps/app/.env.production` (production) or `apps/app/.env.staging` (staging) as `VITE_APPCHECK_SITE_KEY=…` and commit it. Site keys are public; they are not secrets.
4. Deploy the app with the key **before** functions that enforce App Check: `pnpm build` (or `pnpm build:staging`), then `firebase deploy -P <alias> --only hosting:app`. Open the app, sign in, and check App Check → APIs → Cloud Functions shows verified requests.
5. Then deploy functions (`--only functions`, or the full deploy above). If the key is not ready yet and the backend must go out first, set `ENFORCE_APP_CHECK=false` in `functions/.env.<project id>` (`functions/.env.sathiya-lk` is git-ignored), deploy, and remove the line and redeploy functions once step 4 is live.
6. Debug tokens (local testing against staging only): App Check → Apps → ⋮ → Manage debug tokens → add one; put it in `apps/app/.env.staging.local` as `VITE_APPCHECK_DEBUG_TOKEN`. Never register debug tokens on production; production-mode builds ignore them anyway.
7. Later, once App Check metrics show (nearly) all requests verified: App Check → APIs → enforce for Authentication, Cloud Firestore and Cloud Storage. Old app versions without App Check stop working at that point.

## Password policy
The app requires at least 8 characters wherever a password is set (`apps/app/src/lib/password.ts`): admin sign-up, password reset, and a teacher changing their password. Generated teacher passwords are 8 characters from `functions/src/lib/password.ts`. To enforce the same minimum on the server, per project (once, by hand):

1. Firebase console → Authentication → Settings → Password policy (if it is missing, the project needs the Identity Platform upgrade first).
2. Enforcement mode: **Require enforcement**. Minimum length: **8**.
3. Leave every character requirement (uppercase, lowercase, numeric, special) **off**: generated passwords are lowercase letters and digits with no guaranteed digit, and Admin SDK writes skip the policy, so a requirement would only bite when a teacher changes it.
4. Leave "Require users to update password on sign in" **off**, so admins with an older 6–7 character password can still sign in.
5. Save. Sign-up, reset and change attempts below the minimum now fail with `auth/password-does-not-meet-requirements`, which the app shows as the length rule.

## Preview channels
`firebase hosting:channel:deploy <name> -P default` previews frontend changes only. A preview channel still talks to the production database and functions, so use staging for anything that needs backend changes or writes test data.

## Super admin
Super admins are Auth custom claims, granted from a machine with credentials for the target project (`GOOGLE_APPLICATION_CREDENTIALS` = that project's service account key). The project defaults to `sathiya-lk`; set `GCLOUD_PROJECT` for staging:
```bash
pnpm --filter functions grant-super <email>                                  # production
GCLOUD_PROJECT=sathiya-lk-staging pnpm --filter functions grant-super <email>  # staging
```
The account must already exist (sign up in the app first); the user must sign out and in again to pick up the claim.
