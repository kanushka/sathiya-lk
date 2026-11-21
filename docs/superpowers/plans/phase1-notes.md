# Phase 1 notes — Backend

Hand-over for Phases 3–6. Read with phase0-notes.md. Where this file and the plan disagree, this file wins. Sections are by topic, not by task; "(1.x)" marks the task that introduced something.

## 1. How to run

```bash
pnpm install
pnpm --filter functions build    # esbuild bundle -> functions/lib/index.js (CJS, node20)
pnpm typecheck                   # includes functions (src + test) and tests/rules
pnpm test:emulators              # builds functions, then auth/firestore/storage/functions emulators: functions tests, then rules tests
pnpm test                        # root unit tests (functions and rules tests are not part of it)
```

- `functions/` is the workspace package `functions`. Tests in `functions/test/*.test.ts` (Vitest) call the real callables through the functions emulator with the client SDK (or plain HTTP via `rawCall` when a test needs an `X-Forwarded-For` header) and check data with the Admin SDK. A few tests call handlers in-process (`fn.run(req)`).
- `tests/rules` is the workspace package `rules` (Vitest + `@firebase/rules-unit-testing` 3.x, project id `demo-sathiya-rules`).
- `@sathiya/core` is **not** listed in `functions/package.json` (npm rejects `workspace:` even in devDependencies, which breaks Cloud Build). It is resolved by alias to `packages/core/src` in `build.mjs`, `tsconfig.json` (`paths`) and `vitest.config.ts`, and bundled. Runtime deps: `firebase-admin`, `firebase-functions`.
- **Deploy:** `firebase.json` has no functions predeploy hook. Run `pnpm --filter functions build` before `firebase deploy --only functions`. **Phase 6:** add `"predeploy": ["pnpm --filter functions build"]` to the functions entry in `firebase.json`.
- `pnpm-workspace.yaml`: `'@firebase/util': false` in `allowBuilds` (pnpm 11 refused to install without a decision).
- Local dev ran on Node 26 (the functions emulator warns: requested node 20, using host 26).
- Test harness details: `functions/test/helpers.ts` `beforeEach` deletes `rateLimits` (every SDK call comes from the same emulator IP); `signUp()` marks the email verified (use `unverifiedSignUp()` for the unverified case); `schoolReq()` registers a `private` school without census number. `functions/test/seed.ts` replaces a registered school's setup with the Siripura fixtures (same ids, registered default template removed) and adds draft year `y2027`.

## 2. Contract

### Local mirror of core additions
Core types are being extended on another branch (merged in Phase 6): school `city`, `address?`, `phone?`, `type`, `censusNo?`; callable `reportSchool`; `ApiErrorCode`s `census-taken`, `email-unverified`, `already-has-school`, `rate-limited`. Until then functions mirror them in `functions/src/lib/contract.ts` (`RegisterSchoolInput`, `SCHOOL_TYPES`, `CENSUS_NO_RE`, `ApiErrorCodeExt`, `REPORT_REASONS`, `ReportSchoolReq/Res`). Delete it after the merge. **Phase 3 must cast** (or wait for the merge) when sending these fields or reading them from `School` / the directory doc / `CallableTypes`.

### Errors
`HttpsError(code, message, { code: ApiErrorCode, ...extra })`:
- signed out → `unauthenticated` / `not-allowed`; wrong role, other school, disabled school → `permission-denied` / `not-allowed`;
- bad input → `invalid-argument` / `invalid` (unknown referenced item → `not-found` / `invalid` where noted);
- every client-supplied document id (schoolId, yearId, entryId, entry id, classIds, subjectIds, teacherIds, setup item id) is checked by `docId()` in guards: non-empty string, no surrounding whitespace, no `/`, not `.` / `..`, not `__x__`, ≤ 1500 bytes → else `invalid-argument` / `invalid`;
- clash → `failed-precondition` `{ code: 'clash', conflicts }`;
- registration (1.4): `permission-denied`/`email-unverified`, `failed-precondition`/`already-has-school`, `already-exists`/`census-taken`, `resource-exhausted`/`rate-limited`;
- `deleteSetupItem` in use is **not** an error: `{ deleted: false, usedIn: n }`.
- Calls without a valid App Check token (when enforced) are rejected by the SDK wrapper with `unauthenticated` and no `details.code`; the app maps that to `not-allowed`.

### Claims and roles
Custom claims `{ sid, role: 'admin'|'teacher', tid?, super? }`; one school per account. Admin of sid = `sid == sid && role == 'admin'` (an admin with `tid` is still an admin). `super: true` is set out of band (console / Admin SDK). `setSchoolClaims` (`lib/claims.ts`) always keeps an existing `super`. After any callable that changes claims the client must `getIdToken(true)`.
Super is **read-only** on school data (O3): callables that write school data require admin of that sid; `setSchoolStatus` is the only super callable.

## 3. Callables

All use `callOpts` (`lib/callOptions.ts`: `region: 'us-central1'`, `enforceAppCheck`). School-scoped admin callables use `requireSchoolAdmin` (admin of sid, school exists and not disabled).

| Callable | Who | Writes | Other errors |
|---|---|---|---|
| `registerSchool` | signed in, verified email or Google, no school (§4) | `schools/{autoId}` (whitelisted: nameEn, nameSi, district, city, address?, phone?, type, censusNo?, grades, staffPrefix, colors; `status:'active'`, `termsVersion = acceptedTermsVersion`, `acceptedTerms {version, at, uid}`, `createdAt`), `schoolDirectory/{sid}` `{nameEn, nameSi, district, city, type, status}`, `members/{uid}` `{uid, role:'admin', email, name}`, default `periodTemplates/{autoId}` (8 periods + interval, `isDefault`, `mode:'same'`, "School default"), `censusIndex/{censusNo}`, `users/{uid}.schoolId`; claims `{sid, role:'admin'}` | see §4 |
| `createTeacher` | admin | Auth user (synthetic email, 8-char password), `teachers/{autoId}` with `uid`, `members/{uid}` `{uid, role:'teacher', teacherId}`; claims `{sid, role:'teacher', tid}`; returns the password once | bad staffId → `invalid-argument`/`invalid`; duplicate staffId → `already-exists`/`invalid` (`details.field: 'staffId'`) |
| `resetTeacherPassword` | admin | new password + `revokeRefreshTokens` | unknown teacher → `not-found`/`invalid`; no `uid` → `failed-precondition`/`invalid` |
| `inviteAdmin` | admin | `invites/{lowercased email}` `{email, teacherId?, invitedBy, createdAt}` (overwrites) | unknown `teacherId` → `invalid-argument`/`invalid` |
| `claimInvites` | signed in, verified email or Google | per invite: `members/{uid}` merged `{uid, role:'admin', email, teacherId?}` (other fields such as `name` kept), deletes the invite; claims `{sid, role:'admin', tid?}`; returns `{ schoolIds }` | not verified → `permission-denied`/`not-allowed` |
| `setSchoolStatus` | super | `schools/{sid}.status`, `schoolDirectory/{sid}.status` | unknown school → `not-found`/`invalid` |
| `saveEntry` `{schoolId, yearId, entry}` → `{entryId}` | admin | `years/{yid}/entries/{id}` (`teacherIds` via `withTeacherIds`), slot locks | day not 0–4, period not in the class template for that day (O8), unknown class/subject/teacher, block classes of different grade or template (O7), the same teacher on two lessons of one entry, unknown year → `invalid-argument`/`invalid`; `entry.id` missing → `not-found`/`invalid`; clash → `failed-precondition` `clash` |
| `deleteEntry` `{schoolId, yearId, entryId}` → `{ok}` | admin | deletes the entry | unknown → `not-found`/`invalid` |
| `deleteSetupItem` `{schoolId, kind, id}` → `{deleted, usedIn}` | admin | deletes the item; a teacher also deletes its Auth user (not-found ignored), `members/{uid}`, and unsets `teacherId` on admin members linked to it | unknown kind → `invalid-argument`; unknown item → `not-found` |
| `publishYear` `{schoolId, yearId}` → `{classes, teachers}` | admin | `publishedClasses/{cid}`, `publishedTeachers/{tid}` (batches ≤ 450 ops), deletes stale published docs, year `{status:'published', publishedAt: ms}`, school `activeYearId` | unknown year → `invalid-argument`/`invalid` |
| `reportSchool` `{schoolId, reason, details?, email?}` → `{ok}` | anyone (signed out too), per-IP limit | `reports/{autoId}` `{schoolId, reason, details?, email?, uid?, status:'open', createdAt}` | §4 |

### Details
- **claimInvites:** claims hold one school, so it claims invites only for the caller's current `sid` (if any) or the first invite of an active school; others stay pending. Invites of disabled schools are skipped. An invite without `teacherId` keeps the existing `tid` / member `teacherId`. Claims are set before the invite is consumed, so a failed call can be retried.
- **createTeacher / registerSchool** set claims before writing docs and roll back on failure, so no orphan school, member or teacher doc is left. `createTeacher` does not check that `subjectIds` exist.
- **Teacher passwords** (user decision, overrides the plan's 6 digits): 8 chars via `crypto.randomInt` from `abcdefghjkmnpqrstuvwxyz23456789` (no 0, o, 1, l, i). Login slips must show 8 chars.
- **saveEntry concurrency (R6):** inside the transaction, after reading the year (and the old entry when editing), it `getAll`s lock docs `schools/{sid}/years/{yid}/slotLocks/{day}_t_{teacherId}` and `{day}_c_{classId}` for the draft and the old version (sorted), then queries same-day entries (`teacherIds` / `classIds` `array-contains-any`, chunks of 30), runs `findConflicts`, then writes the locks (`updatedAt`, `entryId`) and the entry. Competing saves conflict on a lock doc, so one retries and sees the other. `slotLocks` is functions-only and not in core `paths` (`lib/slotLocks.ts`). Setup data (`loadContext`) is read outside the transaction; a template/class edit racing a save is not serialised.
- **Transactions** (`saveEntry`, `registerSchool`, rate limits) go through `runTx` (`lib/tx.ts`): besides the SDK's own ABORTED retries it retries only (5 attempts, backoff) the emulator's `INVALID_ARGUMENT "Transaction is invalid or closed"`, which the emulator returns when it kills a transaction waiting on a lock. This caused an occasional `internal` in the concurrency tests.
- **deleteSetupItem usage:** `usedIn` = core `usageCount` over the entries of the school's **latest year only** (highest `label`, numeric compare — the draft being edited; older years are frozen in their published snapshots). Consequence: re-publishing an older year after newer ones exist can show missing names for items deleted since, because usage was only checked against the latest year + setup references: subject → each grade plan item and class `planOverride` item that is the subject or lists it in `optionSubjectIds`; teacher → classes with it as `classTeacherId`; template → classes using it, and the default template adds 1 (never deleted); class → entries only. Not transactional with `saveEntry`. Invites with a deleted `teacherId` stay; a linked admin's `tid` claim stays until their next claims change. **A deleted subject stays in teachers' `subjectIds`** (and in entries of older years).
- **publishYear:** `buildSnapshots(ctx, entries, year)`; snapshot docs as returned (no `id`, `classTeacher` omitted when unset). Partial failure leaves the old year status; re-running is safe. Publishing does not refuse clashes or warnings.
- **registerSchool** ignores client `logoUrl`, `termsVersion`, `status`, `activeYearId`, `createdAt` (O2); stores `name` on the member doc and `uid` in `acceptedTerms` (additive vs core types). `acceptedTermsVersion` is not checked against `platform/terms/versions/{v}`. `city` required (trimmed, ≤ 80), `address` ≤ 200, `phone` ≤ 30.

## 4. Registration abuse controls (1.4)

### registerSchool order of checks
1. signed in;
2. verified: `email_verified === true` or `sign_in_provider == 'google.com'` (`isVerified` in guards, shared with `claimInvites`) → else `permission-denied`/`email-unverified`;
3. rate limits, own transaction, before anything else so failed attempts count: `REGISTER_PER_UID_PER_DAY = 3`, `REGISTER_PER_IP_PER_DAY = 10` → `resource-exhausted`/`rate-limited`;
4. `sid` claim (token or stored) → `failed-precondition`/`already-has-school` (failed-precondition: the caller is allowed, the account state is wrong);
5. input: `type` in `government|private|international` (required); `censusNo` optional, trimmed, `^\d{4,6}$` (`CENSUS_NO_RE`), required for `government`; `''`/null = absent;
6. claims set, then one transaction: `users/{uid}.schoolId` present → `already-has-school`; `censusIndex/{censusNo}` exists → `already-exists`/`census-taken` (a commit `ALREADY_EXISTS` from a lost census race is mapped the same way); creates the docs in §3. After commit the claims are set again.

**Same-user double submit:** the claims handover below only happens if the user is that school's admin member (member doc `role: 'admin'`). A failed attempt restores the previous claims only if they still hold its own sid, then reads `users/{uid}.schoolId`; if another attempt won it sets that school's admin claims. With the winner re-asserting its claims after commit, the user always ends with the winning school's claims. (The concurrent test passes with and without the fix; the emulator rarely hits the interleaving.)

`censusIndex` entries are never freed (no school delete exists); a disabled school keeps its census number. **Open item:** a super callable to release a census number (fake school squatting a real one).

### Rate limits (`lib/rateLimit.ts`)
- Docs `rateLimits/{scope}_{yyyy-mm-dd UTC}_{id}` `{scope, day, count, expiresAt}`; scopes `register-uid` (uid), `register-ip`, `report-ip` (sha256 hex of the IP). `consumeRateLimits` checks and increments all counters of a call in one transaction; nothing is counted when a limit is already reached.
- **Client IP = rightmost `X-Forwarded-For` hop** (the one Google's front end appends; hops to its left are client-supplied and ignored), else `rawRequest.ip`, else `'unknown'` (one shared bucket). **Call the functions directly (cloudfunctions.net / `run.app` URLs, as the SDK does), not through a Hosting rewrite or a load balancer:** those append their own hop, so the rightmost hop would be a proxy IP and all users would share one bucket. **Verify on the first deploy:** log `x-forwarded-for` and `rawRequest.ip` for one call and confirm the rightmost hop is your real address (not a Google proxy IP); if not, adjust `clientIp`.
- Cleanup: `expiresAt` = day start + 2 days; `firestore.indexes.json` declares a TTL field override on `rateLimits.expiresAt` (deployed with `firebase deploy --only firestore:indexes`; deletion within ~24 h of expiry; the emulator ignores TTL). Confirm the TTL policy is active in the console after the first deploy.

### reportSchool
Signed-out allowed; App Check via `callOpts`; per-IP `REPORT_PER_IP_PER_DAY = 10` first (invalid attempts count). `schoolId` must be a valid id of an existing school (`not-found`/`invalid`), `reason` in `fake|duplicate|abuse|other`, `details` trimmed ≤ 1000, `email` optional, lowercased, format-checked.

## 5. Security rules (1.3, 1.4)

Files: `firestore.rules`, `storage.rules`; tests in `tests/rules`. Roles: admin of sid, teacher of sid (`role == 'teacher'`), super (`super == true`, read only on school data). Claims read with `token.get(k, null)`.

### Firestore
| Path | Read | Client write |
|---|---|---|
| `schoolDirectory/{sid}` | anyone (signed out too) | none |
| `schools/{sid}` | admin, teacher of sid, super | admin **update** only; changed keys within `nameEn, nameSi, district, grades, staffPrefix, logoUrl, colors, city, address, phone`; `city` (if changed) non-blank string ≤ 80, can't be removed; `address` ≤ 200 / `phone` ≤ 30 strings. `type`, `censusNo`, `status`, `activeYearId`, `termsVersion`, `acceptedTerms`, `createdAt` and any other key are functions-only. No create/delete. |
| `teachers/{tid}` | admin, super; teacher only own `tid` | admin update, `uid` and `staffId` unchanged; no create/delete |
| `subjects`, `classes` | admin, super | admin create/update; delete via `deleteSetupItem` |
| `periodTemplates` | admin, super | admin create/update; the default template's `isDefault` can't go from true to false or be removed; delete via `deleteSetupItem` |
| `grades` | admin, super | admin create/update/delete |
| `members/{uid}` | admin, super; teacher only own uid | none |
| `invites` | admin, super | none |
| `years/{yid}` | admin, teacher, super | admin create with non-blank string `label`, `status:'draft'`, no `publishedAt`; update may not touch `status`/`publishedAt` and keeps `label` a non-blank string; no delete |
| `years/{yid}/entries` | admin, super | none |
| `years/{yid}/publishedClasses` | admin, teacher, super | none |
| `years/{yid}/publishedTeachers/{tid}` | admin, super; teacher only own `tid` | none |
| `years/{yid}/slotLocks` | nobody | none |
| `users/{uid}` | owner | create: only `lang` (`en`/`si`); update: only `lang` may change (works with `schoolId` present; `schoolId` can't be set, changed or cleared — it is functions-only); no delete |
| `reports/{id}` | super | super update of `status` (`open`/`resolved`/`dismissed`) and optional `note` (string ≤ 1000) only; no client create/delete |
| `censusIndex`, `rateLimits` | nobody | none |
| `platform/**` | any signed-in user | super |
| anything else | nobody | none |

Every admin write also requires `schools/{sid}.status != 'disabled'` (one `get()` per write). Reads stay open on disabled schools. Rules don't check `request.app` (App Check for Firestore is enforced in the console).

### Storage
`schools/{sid}/logo.<ext>` (single segment): public read; admin of sid create/update ≤ 1 MB with contentType exactly `image/png` or `image/svg+xml`; admin delete. Everything else denied. The disabled-school check is **not** applied in storage rules (would need cross-service `firestore.get()` plus an IAM grant).

### Indexes (`firestore.indexes.json`)
Composite `entries` (collection) `day ASC + teacherIds CONTAINS` and `day ASC + classIds CONTAINS`; field override `invites.email` (collection + collection group, for `claimInvites`); TTL override `rateLimits.expiresAt`.

## 6. App Check (O1)
- `enforceAppCheck` is ON by default in production; off when `FUNCTIONS_EMULATOR=true` or `ENFORCE_APP_CHECK=false` (e.g. `functions/.env.sathiya-lk` to deploy with it off temporarily).
- Console steps (user): (1) Google Cloud → Security → reCAPTCHA Enterprise: create a **website** key for `app.sathiya.lk` (plus `sathiya-lk-app.web.app`, `localhost` if wanted). (2) Firebase console → App Check → Apps: register the webapp (`1:591171596099:web:6d617b8424ab69cd0489f6`) with the reCAPTCHA Enterprise provider and that key. (3) Deploy the app with App Check (Phase 6) **before** deploying functions with enforcement ON, or every callable fails. (4) Later, after checking metrics: App Check → APIs → enforce for Authentication, Cloud Firestore and Cloud Storage. (5) Debug tokens: App Check → Apps → webapp → Manage debug tokens.
- Phase 6 client: `initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_APPCHECK_SITE_KEY), isTokenAutoRefreshEnabled: true })` in `apps/app/src/lib/firebase.ts` before any Firestore/Functions call; skip it when `VITE_USE_EMULATORS=true` or the key is unset. Local dev against real services: `self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN` (never commit it).

## 7. Hosting (O6)
`app` target sends `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` on every path. No full CSP (script/connect sources) yet.

## 8. For later phases

### Phase 3 (register, login, setup, members)
- Register form sends `school.city` (required), `address?`, `phone?`, `type` (required) and `censusNo` (required for government, 4–6 digits). Cast until the core types merge (§2).
- Email/password admins must verify before registering: `sendEmailVerification`, user clicks, then `user.reload()` + `getIdToken(true)` so the token carries `email_verified: true`. Google sign-in needs nothing extra. Error mapping: `email-unverified` → "verify your email"; `census-taken` → "this school is already registered" + link to report it; `already-has-school`; `rate-limited` → "try again tomorrow".
- After `registerSchool`, refresh the token. Call `claimInvites` after every admin sign-in and refresh the token if `schoolIds` is non-empty.
- **Founding admin as a teacher:** the only way an admin gets linked to a teacher record (`tid`) is `inviteAdmin(own email, teacherId)` then `claimInvites` (needs a verified email — always true for a registered admin since 1.4). The member doc keeps `name`.
- **No callable removes or demotes an admin or member** (other than deleting a teacher). Members/admin management UI can't revoke access yet — open item.
- Setup screens write subjects/templates/classes/grades and teacher profile fields with the client SDK; create/delete teachers and delete subjects/templates/classes via callables. Don't let the UI clear `isDefault` on the default template (rules refuse it). New years: write `years/{yid}` with a non-blank `label` and `status:'draft'`.
- The school-profile screen writes `schools/{sid}` directly — only the whitelisted keys; any new school field needs a rules change. Logo: upload `schools/{sid}/logo.png|svg` with the right `contentType`, then write the download URL to `logoUrl`.
- **Directory sync (open item):** `schoolDirectory/{sid}` is functions-only; a name/district/city change on the school doc does not update it. Add a callable or Firestore trigger later.
- Show `createTeacher`/`resetTeacherPassword` passwords once (never stored).
- A "report this school" form calls `reportSchool` (works signed out).

### Phase 5 (teacher views)
- A teacher can list `publishedClasses` and read only `publishedTeachers/{own tid}` (get by id; a list query on `publishedTeachers` is denied). Spec §2 says teachers may view any teacher's published timetable; the plan / R12 chose the narrower rule. **If Phase 5 wants other teachers' timetables, change the `publishedTeachers` read rule** (and its tests).
- Teachers can't list `teachers`, `members`, `entries` or read setup collections.
- `teachers.lastLoginAt` has no client writer; set it from a callable if needed.

### Phase 5/6 (super)
- Super reads everything under `schools/**` but every client write is denied; status changes go through `setSchoolStatus` (disable a fake school).
- Reports: list `reports`, update `status` (`open` → `resolved`/`dismissed`) and `note` with the client SDK. No census release yet (open item, §4).

### Phase 6
- Add the functions predeploy build (§1), App Check client init (§6), merge the core types and delete `functions/src/lib/contract.ts` (§2).

## 9. Open items and concerns
- SVG logos are publicly served from the Storage domain and can contain script; render with `<img>` only, consider sanitising or PNG-only later.
- `grades` delete has no usage check (no callable); a deleted grade can orphan classes.
- A non-default template can be set `isDefault: true` by the client, giving two defaults (only true→false is blocked).
- Rate-limit IP extraction must be verified on the first deploy (§4).
- Teacher delete leaves `invites` with its `teacherId` and a linked admin's `tid` claim until their next claims change.
