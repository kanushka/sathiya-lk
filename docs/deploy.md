# Deploying

Two Firebase projects: production `sathiya-lk` (alias `default`) and staging `sathiya-lk-staging` (alias `staging`), both in `.firebaserc`. Hosting targets `web` and `app` map to a site per project:

| Target | Production site | Staging site |
|---|---|---|
| `web` | `sathiya-lk-web` | `sathiya-lk-staging-web` |
| `app` | `sathiya-lk-app` | `sathiya-lk-staging-app` |

Production deploys only from `main`, after the same build was checked on staging.

## 1. Create the staging project (once)
1. Firebase console → add project `sathiya-lk-staging`.
2. Upgrade to Blaze (functions and extensions need it) and add a budget alert (e.g. 5 USD) in Google Cloud billing.
3. Authentication → enable Email/Password. Settings → Authorized domains → add `staging.sathiya.kanushka.com` and `app.staging.sathiya.kanushka.com`.
4. Firestore database: create in the same location as production (native mode). Storage: create the default bucket.
5. Hosting: add two sites, `sathiya-lk-staging-web` and `sathiya-lk-staging-app` (these ids are what `.firebaserc` maps; if the console gives different ids, update `.firebaserc`).
6. Project settings → add two web apps (website and app). Copy their config into `stagingWebConfig` / `stagingAppConfig` in `packages/firebase-config/src/index.ts` (replace the `REPLACE_WITH_...` placeholders; these are public values, not secrets). The app picks them when built with `VITE_FIREBASE_ENV=staging` (already set in `apps/app/.env.staging`).
7. App Check: register the app with reCAPTCHA Enterprise, create a site key for `app.staging.sathiya.kanushka.com`, then put it in `apps/app/.env.staging.local` as `VITE_APPCHECK_SITE_KEY` (git-ignored). Enforce App Check for Functions once it works. For a debug token (local testing against staging): create it in App Check → Apps → Manage debug tokens and put it in `.env.staging.local` as `VITE_APPCHECK_DEBUG_TOKEN`; staging builds honour it because `VITE_APPCHECK_ALLOW_DEBUG=true`. Production builds ignore it.
8. Email: install the Trigger Email from Firestore extension in the staging project and set up Resend as in `docs/email/setup.md` (use a sender on a domain Resend has verified). Functions params for staging live in `functions/.env.sathiya-lk-staging` (URLs and `MAIL_SUBJECT_PREFIX=[staging]`, so test mails are marked).
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
From `main`, after checking the change on staging:
```bash
pnpm install --frozen-lockfile
pnpm --filter functions build
pnpm build                  # app and web with production URLs
firebase deploy -P default --only hosting,functions,firestore,storage
```
There is no production deploy workflow; production is deployed by hand.

## Preview channels
`firebase hosting:channel:deploy <name> -P default` previews frontend changes only. A preview channel still talks to the production database and functions, so use staging for anything that needs backend changes or writes test data.

## Super admin
Super admins are Auth custom claims, granted from a machine with credentials for the target project (`GOOGLE_APPLICATION_CREDENTIALS` = that project's service account key). The project defaults to `sathiya-lk`; set `GCLOUD_PROJECT` for staging:
```bash
pnpm --filter functions grant-super <email>                                  # production
GCLOUD_PROJECT=sathiya-lk-staging pnpm --filter functions grant-super <email>  # staging
```
The account must already exist (sign up in the app first); the user must sign out and in again to pick up the claim.
