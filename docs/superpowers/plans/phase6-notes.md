# Phase 6 notes — Integration

## Run it locally

```bash
pnpm install
pnpm dev:local
```

Builds functions, starts the emulators (auth, firestore, storage, functions + UI), seeds them, then runs the app (vite dev, `VITE_USE_EMULATORS=true`, App Check off) and the website (astro dev, app links pointing at the local app). Ctrl-C stops everything. Needs Java (emulators) and free ports 4000, 4321, 5001, 5173, 8080, 9099, 9199.

| What | URL |
|---|---|
| App | http://localhost:5173 |
| Website | http://localhost:4321 |
| Emulator UI | http://127.0.0.1:4000 |

Seeded logins (emulator-only test values, defined in `scripts/seed.ts`):

| Role | Where | Login |
|---|---|---|
| School admin | `/login` → Admin login | `admin@siripura.example.com` / `admin-pass-1` |
| Teacher | `/login?as=teacher`, school "Siripura Central College" | staff ID `SCC024` (Mrs. N. Perera) / `teach234` |
| Teacher | same school | staff ID `SCC011` (Mr. R. Silva) / `teach234` |
| Super admin | `/login` → Admin login (lands on `/super`) | `super@sathiya.example.com` / `super-pass-1` |

All 19 fixture teachers exist with password `teach234` (`pnpm seed` prints the list). The seeded year 2027 is a draft, so teachers see "Not published yet" until the admin publishes it from the dashboard.

`pnpm seed` re-seeds running emulators at any time (it wipes the emulator's Firestore and Auth data first). Project id `sathiya-lk` (the app's Firebase config is fixed to it); the seed refuses to run unless the emulator hosts are local.

## End-to-end tests

```bash
pnpm --filter e2e exec playwright install chromium   # once
pnpm e2e
```

Builds functions, runs `firebase emulators:exec` (auth, firestore, storage, functions), and inside it Playwright (`e2e/`, chromium, one worker). Playwright's global setup re-seeds the emulators, then builds the app in emulator mode into `apps/app/dist-e2e` and serves it with `vite preview` on port 4173. Specs run in file order (`e2e/specs/0N-*.spec.ts`); each re-uses the seed or makes its own school, except that later class/teacher grids include earlier specs' edits. Screenshots of key screens go to `e2e/__screenshots__/` (gitignored).

Against an already running stack (`pnpm dev:local`): `E2E_BASE_URL=http://localhost:5173 pnpm --filter e2e test` (re-seeds, so local edits are wiped). Not part of root `pnpm test`; CI runs it in the `ci-e2e` job (see below).

## Staging and CI

- Staging is a second Firebase project, `sathiya-lk-staging` (`.firebaserc` alias `staging`, hosting sites `sathiya-lk-staging-web` / `sathiya-lk-staging-app`). Setup and deploy steps: `docs/deploy.md`. Nothing is deployed from code here; the user creates the project and fills the placeholders in `packages/firebase-config/src/index.ts`.
- Per-environment config: `functions/.env.sathiya-lk-staging` (URLs, `MAIL_SUBJECT_PREFIX=[staging]`), `apps/app/.env.staging` (`VITE_FIREBASE_ENV=staging`, `VITE_WEB_URL`, `VITE_APPCHECK_ALLOW_DEBUG`), web `PUBLIC_SITE_URL` / `PUBLIC_APP_URL`. `pnpm build:staging` builds app and web for staging.
- App Check debug token outside emulators needs both `VITE_APPCHECK_ALLOW_DEBUG=true` and a token (keep it in `apps/app/.env.staging.local`); production builds ignore it.
- CI (`.github/workflows/ci.yml`): runs on push to `main`, PRs and manual dispatch; one run per ref (older PR runs cancelled; runs on main are never cancelled). `ci-fast` always runs (licence, typecheck, unit tests, app build, web test). `ci-emulators` always reports, but its steps run on PRs only when functions, rules, indexes, `tests/rules` or `packages/core` changed (always on push/dispatch). `ci-e2e` runs on push to `main`, manual dispatch, or PRs labelled `e2e`. Caches: pnpm store, Firebase emulator jars, Playwright browsers.
- `.github/workflows/deploy-staging.yml`: manual staging deploy using secret `FIREBASE_SERVICE_ACCOUNT_STAGING`. There is no production deploy workflow.

## Merge summary

Branch `p6-integration-400978`, cut from `75d4b94` (Phase 0 tip). Merged with `--no-ff`, in order: `docs/design-spec` (AGPL LICENSE), `p0-review-082e2f`, `p1-backend-1d2227`, `p2-website-7f4bb5`, `p3-admin-setup-9ecca8`, `p4-timetable-581fc0`, `p5-teacher-super-f4b387`. The only conflicts were in `pnpm-lock.yaml` (regenerated). `pnpm-workspace.yaml` gained `sharp: false` under `allowBuilds` (Phase 2 note; pnpm 11 refused to install without it).

## What Phase 6 changed

- **Contract:** the local mirrors from Phases 1, 3 and 5 are gone. Functions and the app use `@sathiya/core` for School `city`/`address`/`phone`/`type`/`censusNo`, `reportSchool`, `sendAuthEmail`, `SchoolReport`, the new error codes and the platform doc types. Runtime lists (`SCHOOL_TYPES`, `REPORT_REASONS`, `AUTH_EMAIL_KINDS`, `CENSUS_NO_RE`) are in core. Report status is `open | closed` everywhere: the rules said `resolved | dismissed`, so the super admin's Close button would have been refused.
- **Shell:**
  - App Check client init: reCAPTCHA Enterprise, key from `VITE_APPCHECK_SITE_KEY`, debug token in emulators/staging only (`lib/appCheck.ts`).
  - `VITE_WEB_URL` drives the terms/privacy links.
  - `AnnouncementBanner` is in the admin layout; `SuperAdminLink` is in the sidebar.
  - Session teacher passwords are cleared on sign-out.
  - `/login?report=1` opens the report form.
  - A `--danger` token replaces `#A3262A`.
- **Route checks:** a test collects every `features/*/routes.tsx` path, including the `/s/:sid` and print mirrors, and asserts no duplicates and the right role guard. None collided. Tests now cover combined cells rendering `otherClasses` (class view, print, published) and two stacked cells in one `/me/week` row. Both already worked.
- **Hosting (`firebase.json`):**
  - Both targets send `X-Frame-Options DENY`, CSP `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy`, HSTS and `Permissions-Policy`.
  - Caching is `no-cache` on every path (so SPA deep links and directory URLs fetch a fresh `index.html`); `/assets/**` and `/_astro/**` are `immutable`. The later header block wins: verified in the Hosting emulator only, so check it with `curl -I` after the first deploy.
  - The functions entry has a predeploy build and an `ignore` list.
  - The `app` target has an App Check predeploy guard (see `docs/deploy.md`).
- **`grant-super`** script (plan 5.2, never built before): `pnpm --filter functions grant-super <email>`.
- **Seed, `dev:local`, e2e:** see the sections above. e2e found and fixed two app bugs: the block editor listed teachers who don't teach the subject (shown as "Doesn't teach Grade 6"), and the `/auth/action` error states had no way back to login.
- **Design check** against the canvas artboards; fixed:
  - page offsets on Teachers and Subjects;
  - "1 classes" plural on Templates;
  - the dashboard greeting;
  - the verify-gate icon;
  - required markers on Register;
  - the invisible Week tab on `/me`;
  - the order of items on the login card;
  - the super sidebar brand mark;
  - the `#F3F2EE` background on Login, Register and Super.

  Left:
  - small differences in the login slip layout and in where the Templates per-day toggle sits;
  - the artboards' dynamic parts, which could not render without `support.js` and were compared on structure only.
- **Final review fixes:**
  - The Grades plan capacity now comes from the grade's class templates, not the default one: Grade 1 on Primary shows 30/30 in green, and an under-filled plan is amber.
  - Deploy builds are guarded against a missing App Check key.
  - The Auth action URL is documented as required.
  - The e2e clock is fixed.
  - CI never cancels runs on `main`.
  - The App Check debug token is ignored in production builds.
- **Staging + CI:** see "Staging and CI" above and `docs/deploy.md`.

## Test counts (HEAD)

| Suite | Result |
|---|---|
| `pnpm test` | 642 pass (core 132, i18n 5, app 503; 76 files) |
| `pnpm --filter web test` | 84 pass |
| `pnpm test:emulators` | functions 209, rules 404 (last run after the contract change; see below) |
| `pnpm e2e` | 12/12, three runs in a row (before the design-check and final-review fixes; see below) |
| `pnpm typecheck`, `pnpm --filter app build`, `pnpm check:license` (371 files), `pnpm install --frozen-lockfile`, actionlint | pass |

## Open findings

Not fixed. Full detail in the final review (M6–M12) and the phase notes.

| # | What | Suggested |
|---|---|---|
| 1 | Teachers can change their generated 8-character password to any 6 characters, which reopens the guessing risk for that account. | Require 8 or more in `ChangePasswordModal`, and set the Auth password policy in the console. |
| 2 | The founding admin can be linked to a teacher record only by inviting their own email, then signing out and in. Nothing in the UI says so. | Add a "Link my account to a teacher" action on Members. |
| 3 | A disabled school's admin UI shows no banner; writes just fail. | Add a banner and read-only mode. |
| 4 | Rules allow client-side grade delete with no usage check. `deleteSetupItem` is not transactional with `saveEntry`. | Drop grade `delete` from the rules. |
| 5 | Hard-coded tints remain (danger and success shades), the dashboard imports from `features/teacher`, and `Field` sets no `aria-required`. | Tidy-up. |
| 6 | App Check deploy guard: it doesn't check that the built mode matches the target project, and it reads only `functions/.env.<project id>`. | Always build right before deploying. |
| 7 | Phase 0 review items still open: O5 (no `--brand-ink` for light brand colours), O9, O10, O12, O15, O16, O17, and O18 (synthetic email domain; your decision). | — |
| 8 | Earlier open items: no census-number release for a squatted census number; Sinhala copy (UI, emails, legal) needs a native speaker; the legal text needs your review; the rate-limit client IP must be checked on the first deploy (phase1 notes §4); there is no `robots.txt` or sitemap. | — |

## Deploy checklist (your manual steps)

Nothing has been deployed. Do these in the Firebase and Google Cloud consoles, then deploy. Details are in `docs/deploy.md` and `docs/email/setup.md`.

1. **App Check + reCAPTCHA Enterprise** (each project):
   - Create a website key for `app.sathiya.kanushka.com`.
   - Register the app web app in App Check with that key.
   - Put the key in `apps/app/.env.production` as `VITE_APPCHECK_SITE_KEY` and commit it.
   - Deploy `hosting:app` before functions. Until the key exists, set `ENFORCE_APP_CHECK=false` in `functions/.env.sathiya-lk`.
   - Later, enforce App Check for Auth, Firestore and Storage.
2. **Resend domain** `sathiya.kanushka.com`: add it in Resend and create its DNS records (SPF, DKIM, return path, DMARC).
3. **Trigger Email extension:** install it on collection `mail`, with Resend SMTP (`smtps://resend@smtp.resend.com:465`) and the API key stored as the extension secret.
4. **Auth:**
   - Enable the Email/Password and Google providers.
   - Templates → customise the action URL to `https://app.sathiya.kanushka.com/auth/action` (required).
   - Authorised domains: add `sathiya.kanushka.com` and `app.sathiya.kanushka.com`.
5. **Hosting:**
   - Create the sites `sathiya-lk-web` and `sathiya-lk-app`.
   - Connect the custom domains `sathiya.kanushka.com` (web) and `app.sathiya.kanushka.com` (app), and add their DNS records.
6. **Storage rules:** the console's test-mode rules are replaced when you deploy `storage.rules` (`--only storage`). Check in the console that test mode is gone.
7. **Firestore:** deploy rules and indexes. After the first deploy, confirm the TTL policy on `rateLimits.expiresAt` is active.
8. **Super admin claim bootstrap:**
   - Sign up in the app.
   - Run `GOOGLE_APPLICATION_CREDENTIALS=<sa.json> pnpm --filter functions grant-super <email>`.
   - Sign out and back in.
   - Set `SUPER_EMAILS` in `functions/.env.sathiya-lk` so report emails reach you.
9. **After the first deploy:**
   - Run `curl -I` on an asset and on a deep link to check the cache headers.
   - Log `x-forwarded-for` once to confirm the rate-limit IP.
10. **Staging** (optional): follow `docs/deploy.md` §1. Then add the `FIREBASE_SERVICE_ACCOUNT_STAGING` secret, the `e2e` PR label, and the required checks `ci-fast`, `ci-emulators`, `ci-e2e`.

Deploy commands (you run these):
```bash
pnpm install --frozen-lockfile
pnpm --filter functions build
pnpm build
firebase deploy -P default --only hosting:app        # first, with the App Check key in the build
firebase deploy -P default --only hosting,functions,firestore,storage
```
Staging: `pnpm build:staging`, then `firebase deploy -P staging --only hosting,functions,firestore,storage`, or the "Deploy staging" workflow.
