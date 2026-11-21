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

## Task 3.2 — Teachers

- Dependency exception: added `qrcode` and `@types/qrcode` (dev) to `apps/app`. QR is rendered as an SVG data URI (`features/teachers/qr.ts`, `QRCode.toString`), no canvas needed.
- Reusable delete guard for 3.3/3.4/3.5: `useDeleteSetupItem()` and `<DeleteSetupModal schoolId kind id name onClose onDeleted? />` from `features/teachers`. Strings live in `teachers` namespace under `deleteGuard.*` (`body.<kind>`, `inUse.<kind>`; template copy says "classes").
- Edits of an existing teacher are a direct Firestore `updateDoc` (`teachers/api.ts`); cleared phone/email use `deleteField()`. Staff ID is not editable after creation (the login email derives from it). Rules must allow admin updates of `teachers/{id}`.
- Session passwords are a module-level store (`sessionPasswords.ts`); lost on reload, so "Print all login slips" prints every teacher but shows "Reset needed" for those without a password this session.

## Task 3.3 — Subjects

- Assumed shape of `platform/defaultSubjects`: a doc with a `subjects` array of `{nameEn, nameSi?, short, color}` (no ids). Phase 1/seed must match; missing doc or field loads zero.
- Load standard matches existing subjects by trimmed, case-insensitive `nameEn`; added in one `writeBatch`. Needs rules allowing admin create/update of `subjects/{id}` and read of `platform/defaultSubjects`.
- Reuses `register/ColorSwatches` (swatches prop) with a pastel palette; its custom-hex label comes from the `register` namespace.
- Add modal: empty short defaults to first 10 chars of the English name. Inline edit commits on blur/Enter; an emptied English name or short reverts; cleared Sinhala name removes the field (`deleteField`).
- "Used in" counts entries in the selected year via core `usageCount`.

## Task 3.6 — Dashboard, members, profile

- Invite doc shape assumed at `schools/{sid}/invites/{id}`: `{ email, teacherId?, createdAt? }` (`Invite` in `features/members/api.ts`). Admin must be able to read `members` and `invites`.
- Profile edits update only the school doc. `schoolDirectory/{sid}` (nameEn/nameSi/nameLower/district) is not written from the client; syncing it on profile edit is a Phase 1 concern (trigger on school doc update).
- Profile adds `city` (required), `address?`, `phone?` via local `SchoolWithContact` type (core `School` gains these in Phase 6). Cleared optional fields (and `nameSi`) are removed with `deleteField()`. `registerSchool` does not yet collect city.
- Contrast helper (`profile/contrast.ts`) is local since core `color.ts` keeps luminance private; warns when primary vs white < 4.5:1.
- Dashboard attention/stat links assume Phase 4 query params `/admin/timetable/class?c=<classId>` and `/admin/timetable/teacher?t=<teacherId>`; links keep the `/s/:sid` base in the super-admin mirror.
- Dashboard "clashes" counts unique conflicting entry pairs via `findConflicts`; "empty slots" = per-class week capacity minus entries placed in that class.
- New year: created as draft, then selected via `setYearId(newId)` (shell keeps it until the snapshot arrives).

## Task 3.7 — School city/address/phone in register and login search

- `schoolDirectory/{sid}` needs `city` and `cityLower` (lowercase) in addition to `nameLower`; login search runs two prefix queries (`nameLower`, `cityLower`), merges name matches first, dedupes by id, caps at 10. Both need single-field indexes (automatic). Directory sync (Phase 1 trigger) must write them.
- `registerSchool` req carries `school.city` (required) and `address?`/`phone?` (only when non-empty) via local `RegisterSchoolWithContactReq` in `features/register/model.ts`, until core `School`/`RegisterSchoolReq` gain these in Phase 6. The callable must persist them and write the directory doc.
- Single local type home: `SchoolWithContact`/`SchoolContact` in `features/register/model.ts`; profile imports it.
- Login result label is now "Name, City" (was district); omitted when the directory doc has no city.
