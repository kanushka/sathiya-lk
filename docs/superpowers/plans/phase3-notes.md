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
- Profile adds `city` (required), `address?`, `phone?` via local `SchoolWithContact` type (core `School` gains these in Phase 6). Cleared optional fields (and `nameSi`) are removed with `deleteField()`.
- Contrast helper (`profile/contrast.ts`) is local since core `color.ts` keeps luminance private; warns when primary vs white < 4.5:1.
- Dashboard attention/stat links assume Phase 4 query params `/admin/timetable/class?c=<classId>` and `/admin/timetable/teacher?t=<teacherId>`; links keep the `/s/:sid` base in the super-admin mirror.
- Dashboard "clashes" counts unique conflicting entry pairs via `findConflicts`; "empty slots" = per-class week capacity minus entries placed in that class.
- New year: created as draft, then selected via `setYearId(newId)` (shell keeps it until the snapshot arrives).

## Task 3.7 — School city/address/phone in register and login search

- `schoolDirectory/{sid}` needs `city` and `cityLower` (lowercase) in addition to `nameLower`; login search runs two prefix queries (`nameLower`, `cityLower`), merges name matches first, dedupes by id, caps at 10. Both need single-field indexes (automatic). Directory sync (Phase 1 trigger) must write them.
- `registerSchool` req carries `school.city` (required) and `address?`/`phone?` (only when non-empty) via local `RegisterSchoolWithContactReq` in `features/register/model.ts`, until core `School`/`RegisterSchoolReq` gain these in Phase 6. The callable must persist them and write the directory doc.
- Single local type home: `SchoolWithContact`/`SchoolContact` in `features/register/model.ts`; profile imports it.
- Login result label is now "Name, City" (was district); omitted when the directory doc has no city.

## Task 3.8 — Registration abuse checks and report a school

- Local types (core gains them in Phase 6): `SchoolType = 'government'|'private'|'international'`, `censusNo?` live in `SchoolContact` (`features/register/model.ts`). `registerSchool` req `school` now carries `type` (always) and `censusNo` (omitted for private/international that tick "No census number"). Census is digits only, 4-6 long, required for government.
- Backend: `registerSchool` must enforce census uniqueness and the verified email requirement (`request.auth.token.email_verified` for password-provider users; Google users are verified already). Throw an `HttpsError` whose `details` is `{ code, schoolId? }` with `code` one of `'census-taken' | 'email-unverified' | 'already-has-school' | 'rate-limited'`. `census-taken` should include the existing `schoolId` so the Report popup can preselect it. `lib/callable.ts` `toApiError` maps these to `ApiError('invalid')` keeping `details`; the app reads `err.details.code` (`features/register/errors.ts`).
- `reportSchool` callable (not in `CallableTypes`; wrapped locally in `features/auth/api.ts` via `httpsCallable`): req `{ schoolId, reason: 'fake'|'duplicate'|'abuse'|'other', details?, email? }`, res `{ ok: true }`; rate limit failure is `details.code = 'rate-limited'`. Reporter identity must not be disclosed to the school. Add to `CallableTypes` in Phase 6.
- Verify-email gate placement: new accounts are created at step 3, so the gate cannot precede step 1 for them. Gate = `VerifyEmailGate` shown in place of the wizard when (a) the signed-in user has a `password` provider and `!emailVerified` (before step 1, as in the artboard), or (b) immediately after account creation at step 3 (verification email is sent in `createAccount`), or (c) `registerSchool` returns `email-unverified`. "I've confirmed it" = `user.reload()` + `getIdToken(true)`, proceeds only if `emailVerified`. `registerSchool` is therefore never called in the same submit that creates the account; the user presses "Create school" again after confirming (wizard state is preserved). Google users skip the gate.
- Artboard note "Checked when you press Next" (census pre-check at step 1) is not implemented: it needs a callable that does not exist. Census uniqueness is only checked at create time; the error returns the user to step 1.
- Private/international without "No census number" ticked must enter a valid census (assumption).

## Task 3.9 — Branded auth email action handler

- Public route `/auth/action` (`features/auth/ActionPage`) handles Firebase `mode` = `verifyEmail | resetPassword | recoverEmail` with `oobCode`.
- Deploy requirement: in the Firebase console (Authentication > Templates > each email template > customize action URL) set the action URL to `https://<app-domain>/auth/action`, otherwise emails keep pointing at the default firebaseapp.com handler.
- `continueUrl` / `lang` params are not used; the page uses the app's own language toggle.

## Backend / rules dependencies (consolidated)

- Admin create/update (direct Firestore) of `grades` (plan, perWeek), `classes` (incl. `planOverride` set/`deleteField`, `classTeacherId`, `templateId`), and `periodTemplates` (incl. batched `isDefault` flip across templates in one write).
- `deleteSetupItem` kinds `class` and `template` (template `usedIn` = classes using it) in addition to teacher/subject. In-use errors carry `details: { code: 'in-use', usedIn }`; the `{ deleted:false, usedIn }` result is also handled.
- New year = client `addDoc` to `years`. Rules should only let admins create `status: 'draft'`; publishing only via the `publishYear` callable.
- Profile writes `staffPrefix`, `colors`, `logoUrl`, names, `district`, `city`/`address`/`phone` on the school doc. Rules must forbid admin writes to `status`, `activeYearId`, `termsVersion`.
- `schoolDirectory` is publicly readable (unauthenticated) with `nameLower`, `cityLower`, `city` kept in sync by the backend on school create/update.
- Subject delete should count grade plans and teacher `subjectIds` as usage, otherwise the UI can show raw subject ids.
- Teacher edits are direct `updateDoc` by admins (name, subjects, grades, maxPerDay, phone, email); `staffId` is never changed, and edit validation ignores the current prefix for existing teachers.
- Members and invites collections must be admin-readable.
- `platform/defaultSubjects` shape `{ subjects: [{ nameEn, nameSi?, short, color }] }`, admin-readable. `platform/config.currentTermsVersion` is read for terms.
- Logo Storage path `schools/{sid}/logo.png` or `.svg` (<= 1 MB), written by admins of that school; app then writes `logoUrl`.

## Phase 6 cleanup

- Move shared pieces to `ui/` with a shared i18n namespace: delete guard (`features/teachers/useDeleteSetupItem`, `DeleteSetupModal`), `ColorSwatches` / `LogoUpload` / `BrandPreview` (`features/register`), `ReportSchoolModal` and `errors` (`features/auth`).
- Replace hardcoded danger colour `#A3262A` with a danger design token.
- Session teacher passwords are in-memory only, keyed by `uid:schoolId`.
