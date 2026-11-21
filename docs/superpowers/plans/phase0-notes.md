# Phase 0 notes — Foundation

Branch `p0-foundation-771e0b`. Read this with the plan before starting Phases 1–5. Where this file and the plan disagree, this file wins (it records what was actually built).

## What was built

| Task | Where | Notes |
|---|---|---|
| 0.1 scaffold | root config, `firebase.json`, `.firebaserc`, CI | pnpm workspace `apps/*`, `packages/*`, `functions`, `tests/*` |
| 0.2 types + helpers | `packages/core/src/{types,time,names,staff,color,paths,api}.ts` | |
| 0.3 clash engine | `packages/core/src/clash.ts`, `fixtures.ts` | clash = clock-time overlap |
| 0.4 availability etc. | `packages/core/src/{plan,availability,progress,blocks,fill,usage}.ts` | all busy/free checks reuse `findConflicts` |
| 0.5 publish + now | `packages/core/src/{publish,now}.ts` | |
| 0.6 i18n | `packages/i18n` (`common`, `shell` namespaces) | en/si key parity enforced by a test |
| 0.7 app shell | `apps/app/src/{app,lib,ui,test}` | providers, router, UI kit |

Tests at HEAD: core 111, i18n 5, app 76 (192 total). `pnpm --filter app build` passes.

## How to run

```bash
pnpm install
pnpm typecheck
pnpm test                      # packages/* + apps/app (Vitest)
pnpm --filter app build
pnpm dev:app                   # VITE_USE_EMULATORS=true to use emulators
pnpm emulators                 # needs firestore.rules etc. (Phase 1)
pnpm test:emulators            # functions + rules tests under emulators (Phase 1)
```

App env: `VITE_USE_EMULATORS=true` (auth 9099, firestore 8080, functions 5001, storage 9199 on 127.0.0.1), `VITE_FUNCTIONS_REGION` (default us-central1 — must match the functions' region).

Local dev ran on Node 26 / pnpm 11; CI pins Node 20 / pnpm 9. `allowBuilds` in `pnpm-workspace.yaml` is a pnpm 11 key (pnpm 9 ignores it and builds anyway). The lockfile is `lockfileVersion 9.0`; `--frozen-lockfile` under pnpm 9 has not been run yet — check on the first CI run.

## Contract deviations and additions (vs plan "Produces")

All additions are additive; every name/signature in the plan still exists.

### Firestore paths (`paths.ts`)
The plan/spec paths `years/{y}/published/classes/{cid}` and `platform/terms/{v}` are not valid document paths (odd segment count). Built:
- `paths.publishedClass(sid, yid, cid)` → `schools/{sid}/years/{yid}/publishedClasses/{cid}`
- `paths.publishedTeacher(sid, yid, tid)` → `schools/{sid}/years/{yid}/publishedTeachers/{tid}`
- `paths.platform.terms(v)` → `platform/terms/versions/{v}`
- `paths.templates(sid)` → `schools/{sid}/periodTemplates`
- `paths.directory(sid)` → `schoolDirectory/{sid}`
- Added: `paths.user(uid)` → `users/{uid}`, `paths.publishedClasses(sid, yid)`, `paths.publishedTeachers(sid, yid)`.
Phase 1 rules (1.3) and publishYear (1.2) and Phase 5 (5.1) must use these, not the plan text.

### School location (added after review)
- `School`: added `city: string` (required), `address?: string`, `phone?: string`. `RegisterSchoolReq.school` picks them up through its `Omit<School, …>`, so `city` is required there too.
- Added `SchoolDirectoryEntry { nameEn; nameSi?; district; city; status }`: the shape of `schoolDirectory/{sid}` (public, no address/phone).
- Added `directoryEntry(school)`: builds that entry. `registerSchool`, `setSchoolStatus` and any profile edit of name/district/city must write it.
- Added `directoryLabel(entry, lang)`: gives `"name, city"` (name in `lang`, English fallback; name alone when city is blank). The teacher login school search uses it.
- Fixture school: city `Kandy`.
- Firestore rejects `undefined`: strip `address`/`phone` when empty.

### API (`api.ts`)
Added `InviteAdminRes`, `ClaimInvitesReq`, `ClaimInvitesRes { schoolIds }`, `DeleteEntryRes`, `PublishYearRes { classes; teachers }`, `SetSchoolStatusRes`, `CallableName`, `CallableTypes` (req/res per callable). App `call('saveEntry', req)` infers types from `CallableTypes`; `call<Req, Res>(name, req)` still works.
Error contract: functions throw `HttpsError(code, message, { code: ApiErrorCode, ... })`. The app maps `details.code` first; otherwise permission-denied/unauthenticated → `not-allowed`, everything else → `invalid`. Clash: `failed-precondition` with `details: { code: 'clash', conflicts }`.

### Core logic
- `classOptionsForTeacherSlot` args: added `editingEntryId?`.
- `Warning`: added `planKey?` (set for `over-target`). `detail` is English only; UIs translate from `kind`/`refId`/`planKey`/`day`.
- `SnapshotCell`: added `subSi?` (teacher cell: Sinhala subject name) and `otherClasses?` (class group cell). Class group `sub` is still the English "Group" / "Group · 6A" — UIs should build that label from `isGroup` + `otherClasses` via i18n.
- Added `bestOverlapPeriod(template, day, window)` (time.ts), shared by `matchClassPeriod` and teacher snapshots.
- `currentAndNext` decides current/next by each cell's own clock times (teacher cells keep the real class times). A teacher grid may hold two cells in one default row when the class template has shorter periods (e.g. Primary P5 + P6 both map to default P5) — Phase 4.3 / 5.1 week grids must render that.
- `findConflicts` returns `[]` when the draft's (day, period) doesn't exist in the class template; same for `teacherOptionsForSlot`/`joinableClasses` (treated as free). `saveEntry` must reject an invalid period before calling it.
- `findConflicts` reads teachers from `lessons`, not stored `teacherIds`.
- No group same-template/same-grade validation in core — `saveEntry` validates it.

### Behaviour rulings
- `fillWithClassTeacher`: only plan *subject* items with remaining need > 0 (most need first, ties by plan order); slot left empty when none; teacher qualification not checked; slots day-major then period.
- `teacherOptionsForSlot`: reason precedence not-qualified > busy > limit; `loadToday` excludes the entry being edited.
- `usageCount`: teacher/subject/class → number of entries using it; template → number of classes using it.
- Snapshot class cell: title = subject short (group: group nameEn), titleSi = subject/group nameSi; teacher cell: title = class names joined `+`, sub = subject nameEn, start/end = real class window, period = best-overlap default period.

### App shell
- `SchoolProvider` prop `scope?: 'full' | 'school'`. `/me` uses `'school'`: only the school doc is read (teachers may not read setup/draft data). Teacher views read `publishedTeachers/{tid}` themselves.
- `useYear()` also returns `loading` and `error?`; `useSchool()` also returns `error?`.
- `useReadOnly()` (from `ui/AdminLayout`) is true in the super admin school view.
- `useDoc`/`useCollection`: memo or inline constraints are fine (keyed by serialised value); never stale data after a path change.
- Test helper `apps/app/src/test/renderWithSchool.tsx` (`renderWithSchool(ui, { ctx, entries, ... })`) with injectable `AuthContextProvider`, `SchoolContextProvider`, `LangContextProvider` — use it instead of mocking firebase.

## Router contract (feature sessions)
Each feature adds `apps/app/src/features/<name>/routes.tsx` exporting `routes: RouteObject[]` with **absolute** paths. The shell groups by prefix:
- `/admin`, `/admin/*` → RequireRole admin + AdminLayout (sidebar). Automatically mirrored to `/s/:sid/*` for super admins (read-only: check `useReadOnly()`).
- `/admin/print*` → RequireRole admin + SchoolProvider, no sidebar shell (also mirrored to `/s/:sid/print*`).
- `/me*` → RequireRole teacher (or admin with `tid`) + SchoolProvider scope `school`.
- `/super*` → RequireRole super.
- anything else (`/login`, `/register`) → public.
- `/` redirects by claims: admin → `/admin`, teacher → `/me`, super → `/super`, signed in without claims → `/register`, signed out → `/login`. Wrong role on a guarded route → `/`.
User-visible strings: add `packages/i18n/src/en/<ns>.json` + `si/<ns>.json` (every en key must exist in si).

## Fixtures (`@sathiya/core/fixtures`)
Siripura Central College: templates default (8 periods), Short Friday, Primary (P3 09:00–09:40); grades 1, 6, 12; classes 1A, 6A, 6B, 6C, 12A (planOverride); 6B grid from the canvas (36 filled, 4 empty). Id maps `T`, `S`, `C`, `TPL`, `G`; `ctx`, `entries6B`, `entries`. Two teachers are invented (not on the canvas): Ms. R. Senanayake (Dancing, SCC058) and staff ID SCC055 for Mrs. L. Dissanayake.

## Notes for Phase 1 (backend)
- Packages export TypeScript source (`exports: ./src/index.ts`, extensionless imports, `moduleResolution: Bundler`). Functions must bundle `@sathiya/core` (esbuild/tsup); a NodeNext tsconfig will fail on core's imports. Don't put `workspace:*` deps in the deployed `functions/package.json` (Cloud Build runs npm).
- Firestore rejects `undefined` fields (`phone?`, `groupKey?`, `titleSi?`): use `ignoreUndefinedProperties: true` or strip them.
- `@sathiya/i18n` uses `import.meta.glob` — Vite only; never import it from functions.
- `firebase.json` already references `firestore.rules`, `firestore.indexes.json`, `storage.rules` and `functions/`; until they exist `pnpm emulators` fails and the CI emulator step is skipped (gated on `firestore.rules`).
- Functions/rules tests run only via `pnpm test:emulators` (root `pnpm test` excludes them). Rules tests: make `tests/rules` a workspace package named `rules` with a `test` script. You may edit the `test:emulators` script.

## Notes for Phase 2 (website)
`apps/web` is not in the root Vitest workspace (its build test needs `dist`); give it its own `test` script that builds first.

## Left open
- Synthetic email domain follows the plan (`…@{schoolId}.teachers.sathiya.lk`), not spec §3.3.
- If a group entry's `groupKey` is removed from the plan, progress falls back to `lessons[0].subjectId`.
- `onColor`/`toMinutes` don't validate malformed input.
- `currentAndNext`: when now is in a free row, `next` is searched from the row end, so a cell from another template starting inside that free row is skipped.
- Mirrored `/s/:sid/*` admin routes would collide with a feature route of the same subpath; nothing checks duplicates.
- `/login` and `/register` don't exist until Phase 3, so redirects land on Not found until then.
