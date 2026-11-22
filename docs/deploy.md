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
There is no production deploy workflow; production is deployed by hand.

## App Check
Every callable function enforces App Check (`functions/src/lib/callOptions.ts`) unless `ENFORCE_APP_CHECK=false` is set in the project's functions env. An app built without `VITE_APPCHECK_SITE_KEY` sends no App Check token, so every callable (register, save, publish, …) fails with `unauthenticated`. The `app` hosting target's predeploy (`apps/app/deploy/check-app-check.mjs`, also a step in the staging workflow) therefore refuses to deploy a build without a site key while the target project enforces App Check. It reads `apps/app/dist/.build-env.json` (written by the build, never uploaded) and `functions/.env` + `functions/.env.<project id>`. `firebase deploy --only functions` does not run it, so keep the order below.

Per project (production `sathiya-lk` / app domain `app.sathiya.kanushka.com`; staging `sathiya-lk-staging` / `app.staging.sathiya.kanushka.com`):
1. Google Cloud console (that project) → Security → Fraud Defense (formerly reCAPTCHA Enterprise) → enable the API if asked → **Create key**: type **Website**, score-based (no checkbox challenge), domains: the app domain plus `<site>.web.app` and `<site>.firebaseapp.com` (production: `app.sathiya.kanushka.com`, `sathiya-lk-portal.web.app`, `sathiya-lk-portal.firebaseapp.com`). Copy the key ID: that is the **site key**. reCAPTCHA Classic (v3) is deprecated in App Check; don't use it.
2. Firebase console → App Check → Apps → the **app** web app → Fraud Defense → paste the site key → Save. This registers the web app with App Check.
3. Put the site key in `apps/app/.env.production` (production) or `apps/app/.env.staging` (staging) as `VITE_APPCHECK_SITE_KEY=…` and commit it. Site keys are public; they are not secrets.
4. Deploy the app with the key **before** functions that enforce App Check: `pnpm build` (or `pnpm build:staging`), then `firebase deploy -P <alias> --only hosting:app`. Open the app, sign in, and check App Check → APIs → Cloud Functions shows verified requests.
5. Then deploy functions (`--only functions`, or the full deploy above). If the key is not ready yet and the backend must go out first, set `ENFORCE_APP_CHECK=false` in `functions/.env.<project id>` (`functions/.env.sathiya-lk` is git-ignored), deploy, and remove the line and redeploy functions once step 4 is live.
6. Debug tokens (local testing against staging only): App Check → Apps → ⋮ → Manage debug tokens → add one; put it in `apps/app/.env.staging.local` as `VITE_APPCHECK_DEBUG_TOKEN`. Never register debug tokens on production; production-mode builds ignore them anyway.
7. Later, once App Check metrics show (nearly) all requests verified: App Check → APIs → enforce for Authentication, Cloud Firestore and Cloud Storage. Old app versions without App Check stop working at that point.

## Preview channels
`firebase hosting:channel:deploy <name> -P default` previews frontend changes only. A preview channel still talks to the production database and functions, so use staging for anything that needs backend changes or writes test data.

## Super admin
Super admins are Auth custom claims, granted from a machine with credentials for the target project (`GOOGLE_APPLICATION_CREDENTIALS` = that project's service account key). The project defaults to `sathiya-lk`; set `GCLOUD_PROJECT` for staging:
```bash
pnpm --filter functions grant-super <email>                                  # production
GCLOUD_PROJECT=sathiya-lk-staging pnpm --filter functions grant-super <email>  # staging
```
The account must already exist (sign up in the app first); the user must sign out and in again to pick up the claim.
