# Phase 1 notes — Backend

Read with phase0-notes.md. Where this file and the plan disagree, this file wins.

## Task 1.1 — Functions scaffold, auth/claims callables

### How to run

```bash
pnpm install
pnpm --filter functions build    # esbuild bundle -> functions/lib/index.js (CJS, node20)
pnpm typecheck                   # includes functions (src + test)
pnpm test:emulators              # builds functions, then auth/firestore/storage/functions emulators + functions tests
```

- `functions/` is a workspace package named `functions`. Tests: `functions/test/*.test.ts` (Vitest), run only under `pnpm test:emulators`; they call the real callables through the functions emulator with the client SDK and check data with the Admin SDK. Not part of root `pnpm test`.
- `@sathiya/core` is **not** listed in `functions/package.json` (npm rejects `workspace:` even in devDependencies, which breaks Cloud Build). It is resolved by alias to `packages/core/src` in `build.mjs`, `tsconfig.json` (`paths`) and `vitest.config.ts`. Runtime deps: `firebase-admin`, `firebase-functions` only.
- Deploy: `firebase.json` has no functions predeploy hook (out of Phase 1 scope) — run `pnpm --filter functions build` before `firebase deploy --only functions`.
- `firestore.rules` / `storage.rules` are deny-all placeholders (the storage emulator will not start without its rules file). Task 1.3 replaces them. Creating `firestore.rules` turns on the CI `pnpm test:emulators` step.
- `firestore.indexes.json`: collection-group field override on `invites.email` (needed by `claimInvites` in production).
- `pnpm-workspace.yaml`: added `'@firebase/util': false` to `allowBuilds` (pnpm 11 refused to install without a decision; its postinstall is not needed).

### Region and options
All callables use `callOpts` from `functions/src/lib/callOptions.ts`: `region: 'us-central1'`, `enforceAppCheck: appCheckEnforced()`. Task 1.2 callables must use the same object.
- App Check is **ON by default** in production. Off when `FUNCTIONS_EMULATOR=true` (set by the functions emulator, so tests/dev run without tokens) or `ENFORCE_APP_CHECK=false` (e.g. in `functions/.env.sathiya-lk` to deploy with it off temporarily).
- Calls without a valid App Check token are rejected by the SDK wrapper with `unauthenticated` (no `details.code`; the app maps it to `not-allowed`).

### App Check — console steps (user)
1. Google Cloud console → Security → reCAPTCHA Enterprise: create a **website** key for `app.sathiya.lk` (and `sathiya-lk-app.web.app`, `localhost` for dev if wanted).
2. Firebase console → App Check → Apps: register the **webapp** (`1:591171596099:web:6d617b8424ab69cd0489f6`) with the reCAPTCHA Enterprise provider and that site key.
3. Deploy the app with App Check (Phase 6) **before** deploying functions with enforcement ON, otherwise every callable fails.
4. Later, after checking App Check metrics: Firebase console → App Check → APIs → enforce for Authentication, Cloud Firestore and Cloud Storage.
5. Debug tokens: App Check → Apps → webapp → Manage debug tokens (for local dev against production / CI).

### App Check — what Phase 6 adds client-side
- `initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true })` in `apps/app/src/lib/firebase.ts`, before any Firestore/Functions call; skip it when `VITE_USE_EMULATORS=true` or the key is unset.
- Env: `VITE_APPCHECK_SITE_KEY` (public site key). For local dev against real services: `self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN` (register that token in the console; never commit it).

### Guards for reuse (`functions/src/lib/guards.ts`)
- `requireAuth(req)` → `{ uid, claims, token }` or unauthenticated/not-allowed.
- `requireSchoolAdmin(req, schoolId)` → admin of sid **and** school exists and not disabled → `{ uid, claims, token, sid, school }`. A super admin without admin-of-sid is denied.
- `requireSuper(req)`.
- `fail(code, apiCode, msg, extra)`, `invalid(msg)`, `notAllowed(msg)`, input validators `obj/str/optStr/bool/int/intList/strList/email`.
- Claims: `setSchoolClaims(uid, { sid, role, tid? })` in `lib/claims.ts` — always preserves an existing `super: true`.

### Claims shape
`{ sid, role: 'admin'|'teacher', tid?, super? }`. After any callable that changes claims, the client must `getIdToken(true)`.

### Callables and errors
Every callable: signed out → `unauthenticated` / `not-allowed`. Bad input → `invalid-argument` / `invalid`.

| Callable | Who | Writes | Other errors |
|---|---|---|---|
| `registerSchool` | signed in, no `sid` claim | `schools/{autoId}` (whitelisted fields only: nameEn, nameSi, district, grades, staffPrefix, colors; `status:'active'`, `termsVersion = acceptedTermsVersion`, `acceptedTerms {version, at, uid}`, `createdAt`), `schoolDirectory/{sid}`, `members/{uid}` `{uid, role:'admin', email, name}`, default `periodTemplates/{autoId}` (8 periods + interval, `isDefault`, `mode:'same'`, name "School default"); claims `{sid, role:'admin'}` | already has `sid` → `permission-denied`/`not-allowed` |
| `createTeacher` | admin of sid, school active | Auth user (synthetic email, 8-char password), `teachers/{autoId}` with `uid`, `members/{uid}` `{uid, role:'teacher', teacherId}`; claims `{sid, role:'teacher', tid}`; returns password once | not admin / disabled → `permission-denied`/`not-allowed`; bad staffId format → `invalid-argument`/`invalid`; duplicate staffId → `already-exists`/`invalid` (`details.field: 'staffId'`) |
| `resetTeacherPassword` | admin of sid, school active | new password + `revokeRefreshTokens` | unknown teacher → `not-found`/`invalid`; teacher without `uid` → `failed-precondition`/`invalid` |
| `inviteAdmin` | admin of sid, school active | `invites/{lowercased email}` `{email, teacherId?, invitedBy, createdAt}` (overwrites an existing invite) | unknown `teacherId` → `invalid-argument`/`invalid` |
| `claimInvites` | signed in, `email_verified` or `sign_in_provider == 'google.com'` | per invite: `members/{uid}` `{uid, role:'admin', email, teacherId?}`, deletes invite; claims `{sid, role:'admin', tid?}`; returns `{ schoolIds }` claimed | not verified → `permission-denied`/`not-allowed` |
| `setSchoolStatus` | `super` only | `schools/{sid}.status` + `schoolDirectory/{sid}.status` | unknown school → `not-found`/`invalid` |

`claimInvites` details: claims hold one school, so it claims invites only for the caller's current `sid` (if any) or the first invite of an active school; other invites stay pending. Invites of disabled schools are skipped (left in place). An invite without `teacherId` keeps the caller's existing `tid` / member `teacherId` for that school. Claims are set before the invite is consumed, so a failed call can be retried. `registerSchool` and `createTeacher` also set claims before writing docs (and roll back on failure), so a failure leaves no orphan school, member or teacher doc.

### For later phases
- Phase 3 (register/login/members): call `registerSchool` then refresh the token; call `claimInvites` after every admin sign-in (Google or verified email) and refresh the token if `schoolIds` is non-empty. Show the `createTeacher`/`resetTeacherPassword` password once (it is never stored).
- Task 1.2 `deleteSetupItem` for a teacher must also delete the teacher's Auth user and member doc: an orphaned Auth user with the same synthetic email makes `createTeacher` for that staff ID fail with `already-exists`.
- Phase 6 (super): `setSchoolStatus` is the only super-only callable; super is denied on school-data callables unless also admin of that sid.

### Deviations / open
- Teacher passwords (user decision, overrides the plan's 6 digits / R4): 8 chars via `crypto.randomInt` from `abcdefghjkmnpqrstuvwxyz23456789` (no 0, o, 1, l, i). Login slips (Phase 3/4) must show 8 chars.
- `registerSchool` ignores client `logoUrl`, `termsVersion`, `status`, `activeYearId`, `createdAt` (O2). Logo is set later by the admin (Phase 3).
- Super admin is denied on `createTeacher`/`resetTeacherPassword`/`inviteAdmin` unless admin of that sid (O3); 1.2 callables and 1.3 rules follow the same (super = read only).
- `registerSchool` stores `name` (adminName) on the member doc and `uid` in `acceptedTerms` — additive vs `Member` type.
- `acceptedTermsVersion` is not checked against `platform/terms/versions/{v}` (no platform seeding yet).
- `createTeacher` does not check that `subjectIds` exist.
- Two concurrent `registerSchool` calls by the same user could create two schools (claims check is not transactional).
- Local dev ran on Node 26 (functions emulator warns: requested node 20, using host 26).

## Task 1.2 — Entries, delete guard, publishing

All four callables use `callOpts` + `requireSchoolAdmin` (admin of sid, school active; super alone is denied — O3). `loadContext(sid)` (`functions/src/lib/loadContext.ts`) reads the school doc + teachers/subjects/periodTemplates/grades/classes; `loadEntries(sid, yid)` reads a year's entries.

| Callable | Writes | Errors |
|---|---|---|
| `saveEntry` `{schoolId, yearId, entry}` → `{entryId}` | `years/{yid}/entries/{id}` (`teacherIds` via `withTeacherIds`), slot locks | bad shape, day not 0–4, period not in the class template for that day (O8), unknown class/subject/teacher, block classes of different grade or template (O7), unknown year → `invalid-argument`/`invalid`; `entry.id` given but missing → `not-found`/`invalid`; clash → `failed-precondition` `{code:'clash', conflicts}` |
| `deleteEntry` `{schoolId, yearId, entryId}` → `{ok:true}` | deletes the entry | unknown entry → `not-found`/`invalid` |
| `deleteSetupItem` `{schoolId, kind, id}` → `{deleted, usedIn}` | deletes the item; teacher also deletes Auth user (not-found ignored), `members/{uid}`, and unsets `teacherId` on admin members linked to it | unknown kind → `invalid-argument`/`invalid`; unknown item → `not-found`/`invalid`. In use is **not** an error. |
| `publishYear` `{schoolId, yearId}` → `{classes, teachers}` | `publishedClasses/{cid}`, `publishedTeachers/{tid}` (batches ≤ 450 ops), deletes stale published docs, year `{status:'published', publishedAt: ms}`, school `activeYearId` | unknown year → `invalid-argument`/`invalid` |

### saveEntry concurrency (R6)
Inside the transaction, after reading the year (and the old entry when editing), it `getAll`s lock docs at
`schools/{sid}/years/{yid}/slotLocks/{day}_t_{teacherId}` and `{day}_c_{classId}` for the draft and the old version (sorted keys), then queries same-day entries with `teacherIds array-contains-any` / `classIds array-contains-any` (chunks of 30), runs `findConflicts`, then writes the locks (`updatedAt`, `entryId`) and the entry. Any clash shares a (day, teacher) or (day, class) key, so competing saves conflict on a lock doc and one retries and sees the other.
- `slotLocks` is functions-only and **not** in core `paths` (`functions/src/lib/slotLocks.ts`). **Task 1.3: rules must deny all client access to `slotLocks`.**
- The emulator serialises these transactions even without the locks (its query locking is stricter than production), so the concurrency tests pass either way there; the locks are for production phantom inserts. Tests: 5 rounds of two parallel callable saves (6A/6B, same teacher, same slot) and 5 rounds of three parallel in-process `saveEntry.run` saves (6A/6B/12A) — exactly one fulfilled each, the rest `clash`.
- Setup data (`loadContext`) is read outside the transaction; a template/class edit racing a save is not serialised.

### deleteSetupItem usage (R9 / O4)
`usedIn` = core `usageCount` over entries of **all** years of the school + setup references:
- subject: each grade plan item and class `planOverride` item that is the subject or lists it in `optionSubjectIds`;
- teacher: classes with `classTeacherId` = teacher;
- template: core counts classes using it; the default template adds 1 (so it is never deleted; `usedIn` ≥ 1);
- class: entries only.
The check and delete are not transactional with `saveEntry` (a save racing a delete can leave an entry pointing at a deleted item; `warnings`/`orphanedEntries` will surface it). Invites with the deleted `teacherId` are left in place; a linked admin's `tid` claim is not cleared until their next claims change.

### publishYear
Uses `buildSnapshots(ctx, entries, year)` and the phase0 paths `publishedClasses` / `publishedTeachers`. Snapshot docs are written as returned (no `id` field; `classTeacher` omitted when unset). Published docs not in the new set (deleted classes/teachers) are deleted. A partial failure leaves the year in its old status; re-running is safe. Publishing does not refuse a timetable with clashes or warnings.

### Indexes (R11)
`firestore.indexes.json`: composite indexes on `entries` (collection scope) `day ASC + teacherIds CONTAINS` and `day ASC + classIds CONTAINS`. The `invites.email` override is kept.

### Tests
`functions/test/seed.ts` replaces a registered school's setup with the Siripura fixtures (same ids, registered default template removed) and adds draft year `y2027`. `entries.test.ts` (saveEntry/deleteEntry), `setup.test.ts` (deleteSetupItem/publishYear).

## School city, address, phone (user requirement)

- `registerSchool` requires `school.city` (trimmed, non-empty, ≤ 80) and accepts optional `school.address` (≤ 200) and `school.phone` (≤ 30), all trimmed; non-strings → `invalid-argument`/`invalid`. Stored on `schools/{sid}`; `city` is also written to `schoolDirectory/{sid}` (address/phone are not).
- `@sathiya/core` types don't have these fields yet (added on another branch, merged in Phase 6). Functions read them through the local `RegisterSchoolInput` type in `functions/src/registerSchool.ts`; drop it once `RegisterSchoolReq['school']` / `School` / the directory doc type gain `city`, `address?`, `phone?`.
- Phase 3 register form must send `city` (required) or registration fails.
