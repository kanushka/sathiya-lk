# Phase 3 notes — Admin setup

## Task 3.1 — Auth + registration

- Post sign-in routing navigates to `/` and reuses the shell `HomeRedirect` (admin→/admin, teacher→/me, super→/super, none→/register) after `claimInvites` (admin only) + `refreshClaims`. No separate `homeFor`.
- Backend need (Phase 1): `schoolDirectory/{id}` docs must carry a lowercase `nameLower` field (and `nameEn`, `nameSi?`, `district`, `status`); `searchSchools` runs a `nameLower` prefix range query with `orderBy('nameLower')` (single-field index only). Sinhala-name prefixes are not searchable.
- Storage path is `schools/{sid}/logo.png|svg` (not bare `logo`) to match the plan's storage rule `schools/{sid}/logo.*`; `logoUrl` is written to the school doc client-side after upload (admin write allowed by rules).
- Terms version: read from `platform/config.currentTermsVersion` after the account is created (signed-in read); falls back to constant `'1'` (`FALLBACK_TERMS_VERSION` in `features/register/api.ts`) if missing/unreadable.
- Terms / Privacy links point at `https://sathiya.lk/terms` and `/privacy` (constants in `StepAccount.tsx`); adjust once the website routes exist.
- Re-accept-terms modal for admins with an older accepted version (plan 5.x mention) is not part of 3.1's brief and was not built.
- Register: an already signed-in user without claims (e.g. Google admin routed from login) skips email/password and only gives name + terms.
- Register shows one step card at a time (stepper pills on top) rather than all three stacked as on the canvas. Logo colour auto-pick ("Picked from your logo") not built; hint text shows the chosen hex instead.
- Reusable for 3.6: `features/register/{ColorSwatches,LogoUpload,BrandPreview}.tsx`, `api.uploadLogo(schoolId, file)`; strings live in the `register` i18n namespace.
- Auth tests: `features/auth/testHarness.tsx` provides a stateful auth context plus real `HomeRedirect` for route-by-claims assertions.
