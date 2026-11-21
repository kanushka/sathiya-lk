# Phase 2 notes — Website (apps/web)

Branch `p2-website-7f4bb5` (cut from `p0-foundation-771e0b` at 75d4b94). Only `apps/web/`, `pnpm-lock.yaml` and this file changed.

## What was built

- Astro 4 (`astro@4.16.19`) static site, package name `web`, `build.format: 'directory'`, `site: 'https://sathiya.lk'`, canonical + hreflang alternates.
- Pages: `/`, `/terms/`, `/privacy/`, `/contact/` and `/si/` equivalents, plus `/404.html` (Firebase Hosting serves it automatically).
- Home follows the canvas "Home website" artboard: header, hero with a mock 6B grid, features, steps, CTA and footer. A short FAQ section (`#faq`) was added because the artboard's nav links to FAQ.
- Strings are in `src/content/en.ts` and `src/content/si.ts`; `si` is typed to `en`'s shape. The site does not use `@sathiya/i18n`.
- App links are built in `src/lib/links.ts` from `PUBLIC_APP_URL` (default `https://app.sathiya.lk`): Register → `/register`, Log in → `/login`, Teacher login → `/login?as=teacher`.
- Analytics: gtag `G-Z7BE11T4C9` loads only after the user clicks "Allow analytics" on the consent banner (off by default). The choice is stored in localStorage `sathiya.consent` (`granted`/`denied`). A footer "Analytics settings" button reopens the banner; it is shown only when JS runs.
- Terms and Privacy are v1 drafts: version `2026-11-21`, marked as needing the owner's legal review, with contact `[CONTACT EMAIL]`.

## How to run

```bash
pnpm --filter web dev
pnpm --filter web test        # astro build && vitest run (62 tests read dist/)
pnpm --filter web typecheck   # astro check
```

Checked on Node 20 / pnpm 9 (frozen-lockfile install, typecheck, build, tests) and on Node 26 / pnpm 11.

## For Phase 6

- **CI never builds or tests the website.** `apps/web` is not in the root Vitest workspace, so root `pnpm test` skips it. Add a CI step `pnpm --filter web test`. Root `pnpm typecheck` does run `astro check`.
- **pnpm 11 locally:** Astro's optional `sharp` dependency has a blocked build script. pnpm 11 fails with `ERR_PNPM_IGNORED_BUILDS` and writes a placeholder line into `pnpm-workspace.yaml`. This breaks every `pnpm` script locally on pnpm 11 (root `pnpm test` and `pnpm typecheck` included) until it is fixed. Running the binaries directly works. Fix: add `sharp: false` under `allowBuilds` in the root `pnpm-workspace.yaml` (Phase 2 may not edit root config). pnpm 9 / CI is unaffected.
- **App routes the site links to:** `/register`, `/login` and `/login?as=teacher`. Phase 3 should read `as=teacher` to open the teacher (staff ID) login.
- **Before launch:**
  - Replace `[CONTACT EMAIL]` in `src/content/{en,si}.ts`.
  - The owner must review the legal text.
  - A native speaker should proofread the Sinhala copy, the legal pages especially.
  - If the Terms/Privacy version changes, keep it in sync with `platform/terms/versions/{v}` and the registration acceptance (Phase 3/5).
- **Privacy text matches the data model as specified:**
  - It lists admin email and Google name, the terms acceptance version and time, the teacher's `lastLoginAt`, and the public `schoolDirectory` entry (name EN/SI, district, status).
  - It says Google Fonts load from Google before consent.
  - If Phases 1/3/5 collect more fields, update `privacy` in both content files.
- **Deploy:** the Hosting target `web` serves `apps/web/dist`, which `pnpm --filter web build` produces. `.firebaserc` maps it to site `sathiya-lk-web`, which must exist in the console; the custom domain `sathiya.lk` is the owner's to set up.

## Left open (minor, deliberately not fixed)

- Unused content keys (`legal.lastUpdated`, `brand`, `otherLang` in `links.ts`).
- `build.test.ts` hardcodes the default app URL, so it fails if `PUBLIC_APP_URL` is set at build time.
- No `robots.txt` or sitemap.
- Denying analytics after granting it sets `ga-disable` but doesn't delete existing `_ga` cookies.
- The consent banner isn't announced to screen readers when it appears.
