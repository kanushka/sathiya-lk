# Phase 5 notes — Teacher mobile + super admin

Branch `p5-teacher-super-f4b387` (from Phase 0 `75d4b94`). Read with the plan and `phase0-notes.md`; this file records what Phase 5 actually built and what other phases must do.

## What was built

| Task | Where | Notes |
|---|---|---|
| 5.1 teacher views | `apps/app/src/features/teacher/` | `/me` (today), `/me/week` (week grid), change password modal, sign out, language toggle |
| 5.2a super admin (schools) | `apps/app/src/features/superadmin/` | `/super` schools list, `/super/schools/:sid` detail, `/super/usage`, enable/disable, `SuperAdminLink` |
| 5.2b super admin (platform) | `apps/app/src/features/superadmin/` | `/super/subjects`, `/super/terms`, `/super/announcements`, `AnnouncementBanner` |

i18n: `packages/i18n/src/{en,si}/{teacher,superadmin}.json`. Sinhala strings are the builders' own and need a native-speaker pass.

## Deviations from the plan

- Teacher snapshot path is `paths.publishedTeacher(sid, school.activeYearId, claims.tid)` (phase0 notes), not `published/teachers/{tid}`. No active year or no doc → "Not published yet".
- Teacher "now" is computed in `Asia/Colombo` (`features/teacher/colomboNow.ts`), not device time, and converted before calling core `currentAndNext`. No workarounds for the known `currentAndNext` issues — those fixes land in Phase 6.
- Week grid rows = union of period numbers across all days (`weekSkeleton`), so per-day templates with different period counts drop nothing; row/interval times are shown only when all days agree, else each cell shows its own start. A default row may stack two cells.
- Task 5.2 was split in two sessions of work (5.2a, 5.2b); all plan pages exist.
- Schools list omits the canvas "current-year progress" column and stat cards: progress needs every school's entries + plan (high read cost). Counts only (spec §6a).
- Usage counts are read client-side with Firestore count aggregation (`getCountFromServer`) on `teachers`, `classes`, `years/{activeYearId}/entries`, plus `teachers` ordered by `lastLoginAt desc limit 1` for last activity. Behind the `UsageSource` context seam; cached per `schoolId:activeYearId`.
- Platform docs are written directly from the client by the super admin (no callable), behind the `PlatformWriter` seam. Terms publish is a transaction: fails if the version exists, sets the version doc and `platform/config.currentTermsVersion` together.
- `functions/scripts/grantSuper.ts` (plan 5.2) was not built — `functions/` is Phase 1's. Until it exists, grant `super: true` manually with the Admin SDK.

## Platform doc shapes (not in core; Phase 1 rules and Phase 3 should use these)

```ts
// platform/config
{ currentTermsVersion: string; announcement?: { textEn: string; textSi?: string; active: boolean; updatedAt: number } }
// platform/defaultSubjects
{ subjects: Array<{ nameEn: string; nameSi: string; short: string; color: string }>; updatedAt: number }
// platform/terms/versions/{v}   (paths.platform.terms(v))
{ version: string; termsMd: string; privacyMd: string; publishedAt: number }
```
Types live in `features/superadmin/platform.ts`; consider moving them to `packages/core` in Phase 6.

## Needs from other phases

### Phase 1 (rules)
- Super (`token.super == true`): read/list `schools`, and read + count aggregation on `schools/{sid}/teachers`, `/classes`, `/years/{y}/entries` (and the whole school tree for the read-only `/s/:sid` view).
- Super write: `platform/config` (merge), `platform/defaultSubjects`; `platform/terms/versions/{v}` **create-only** (no update/delete) plus get/list.
- Signed-in admins: read `platform/config` (banner, terms version), `platform/defaultSubjects` (Load standard list), `platform/terms/versions/{v}`.
- Teachers: read `schools/{sid}/years/{y}/publishedTeachers/{tid}` where `tid == token.tid`.
- `setSchoolStatus` callable per `api.ts` (`{ schoolId, status: 'active' | 'disabled' }`).
- `grantSuper` script (see above).

### Phase 6 (shell)
- Mount `<AnnouncementBanner />` (`features/superadmin/AnnouncementBanner`) at the top of `AdminLayout`; it reads `platform/config` itself. Optionally skip it in the read-only super view.
- Mount `<SuperAdminLink />` (`features/superadmin/SuperAdminLink`) in the admin sidebar: renders a link to `/super` only for users with the `super` claim (admin + super users land on `/admin`). The super area already links back to `/admin` for users with an admin role.
- The "My timetable" sidebar link for admins with `tid` already exists in `ui/Sidebar.tsx`.
- Phase 3.1's terms re-accept guard should compare the admin school's `termsVersion` against `platform/config.currentTermsVersion` (shape above). `platform/config` can exist without `currentTermsVersion` (an announcement saved before any terms version) — tolerate it missing.

## Left open (deferred minors)
- Hard-coded hex colours in teacher views and super admin pills instead of tokens.
- Schools list swatch uses white text on `colors.primary` (no `onColor`) and ignores `logoUrl`.
- Schools list fetches all four usage figures per school on mount though it shows only teacher/class counts; no cross-navigation cache, failed counts not retried. Fine at v1 scale.
- `publishTerms` transaction body is only tested via the writer seam; cover it in the Phase 1 emulator tests.
- Default subjects: no duplicate name/short check; last write wins between two super admins.
- Announcement preview is English only.
- Teacher views: selected day tab isn't reset at midnight after a manual pick; no tests for dashed free rows, dimmed past rows, the Next line or "times disagree" week rows.
- `colomboNow` round-trips through device-local time, so non-Sri-Lankan devices can be off by an hour inside their own DST gap (outside school hours).
- License: all Phase 5 `.ts/.tsx` files carry the AGPL-3.0-or-later SPDX header.

## Verification at HEAD
`pnpm typecheck` clean; `pnpm test` 255 (core 111, i18n 5, app 139 — 63 new in Phase 5); `pnpm --filter app build` passes.
