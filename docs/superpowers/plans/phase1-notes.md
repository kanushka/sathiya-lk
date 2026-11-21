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

`claimInvites` details: claims hold one school, so it claims invites only for the caller's current `sid` (if any) or the first invite of an active school; other invites stay pending. Invites of disabled schools are skipped (left in place).

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
