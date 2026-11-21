# Phase 0 review

Independent review of `docs/design-spec..p0-foundation-771e0b` (14 commits) against the design spec (§6a wins), the v1 plan (Phase 0, Global Constraints, Review Focus) and `phase0-notes.md`.

Branch `p0-review-082e2f`, cut from `75d4b94`. Fix commits keep every exported name, signature and path.

## Checks

| Check | Result |
|---|---|
| `pnpm install --frozen-lockfile` (pnpm 11.21, Node 26) | pass |
| `npx pnpm@9` (9.15.9) `install --frozen-lockfile` in a clean `git archive` copy, then `test` + `typecheck` | pass (Node 26; Node 20 not tried locally) |
| `pnpm typecheck` | pass |
| `pnpm test` | 196 pass (core 114, i18n 5, app 77); was 192 |
| `pnpm --filter app build` | pass |

## Fixed

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| F1 | High | `packages/core/src/publish.ts` (teacher cells, `bestOverlapPeriod` → `null` → `continue`) | A class template with a period outside every default period (e.g. a 13:40–14:20 period when the default ends at 13:30, or a short period inside the default interval) was silently dropped from the teacher snapshot. The teacher's mobile view then missed a real lesson. Now the cell maps to the nearest default period and keeps its real times. | fixed in 1133b98 |
| F2 | Medium | `packages/core/src/now.ts:17-20` | Teacher free in a default row (09:10–09:50) with a Primary cell starting at 09:40. At 09:15, `next` was searched from the row end (09:50), so it skipped the 09:40 lesson. The free window also claimed 09:10–09:50. Now the free window ends at the next cell's start and `next` is searched from now. (Listed as "left open" in the notes.) | fixed in 5119fab |
| F3 | Medium | `packages/core/src/publish.ts` `classCell` | A combined main-subject entry (2+ classes, 1 lesson, no `groupKey`) gave class cells with no sign of the other classes. The spec requires combined cells to be marked (⧉ 6A+6B). Combined class cells now carry `otherClasses` (an existing optional field). `isGroup` stays false. | fixed in 1133b98 |
| F4 | Medium | `apps/app/src/app/router.tsx:93` | A feature route declared as `admin/subjects` (no leading slash) failed every `under()` prefix test and landed in `pub`. It then rendered with no `RequireRole`. Paths are now normalised before they are grouped. | fixed in 016f525 |
| F5 | Low | `apps/app/tailwind.config.ts` | `brand: 'var(--brand)'` has no `<alpha-value>`, so Tailwind never generated `focus:ring-brand/30` (used 4×). Inputs got the default blue ring, not the brand one, and Phases 3–5 would copy the dead class. The colour is now defined with `color-mix`. Verified in the built CSS. | fixed in e23afa4 |
| F6 | Low | `.github/workflows/ci.yml` | CI ran no build, so a break in `import.meta.glob` feature routes, Tailwind or Vite config would pass CI. Added `pnpm --filter app build`. | fixed in 6b6ffd7 |

## Open findings (ranked)

| # | Sev | Where | Failure scenario | Status |
|---|---|---|---|---|
| O1 | High (security) | Plan Global Constraints; `staff.ts` `syntheticEmail` | Teacher passwords are 6 digits (10^6), and staff IDs are sequential and predictable (`SCC001…`). The school id is public in `schoolDirectory`. A distributed online guess against `signInWithEmailAndPassword` is feasible, and Auth's per-IP throttling does not stop it. | open — needs Phase 1 + user: App Check on Auth/Functions, longer generated passwords or forced change on first login |
| O2 | Medium (security) | `api.ts:16` `RegisterSchoolReq.school` | The client sends `logoUrl`, `termsVersion` (as well as `acceptedTermsVersion`). If `registerSchool` copies `school` through, a client sets an arbitrary `logoUrl` (rendered as `<img src>` in `Sidebar.tsx:62`) and its own `termsVersion`. | open — Phase 1 `registerSchool` must whitelist fields, ignore `logoUrl`/`termsVersion` and set them server-side |
| O3 | Medium (security) | `/s/:sid` mirror (`router.tsx:140`), `useReadOnly()` | Read-only exists only in the UI. Each feature must check `useReadOnly()`, and nothing enforces this. | open — Phase 1 rules must give super **read only** on `schools/**`, and callables must require admin-of-sid (not `super`); Phases 3–4 must honour `useReadOnly()` |
| O4 | Medium | `usage.ts:17` `usageCount` (contract semantics) | `subject` counts only entries. A subject used in a grade plan, a `planOverride` or a group's `optionSubjectIds` can be deleted, which leaves dangling plan items. `teacher` ignores `classTeacherId`. `template` allows deleting the `isDefault` template, after which `classOptionsForTeacherSlot` returns `[]` and teacher snapshots have no rows or cells. | open — Phase 1 `deleteSetupItem` must also refuse: subject in any plan, teacher as class teacher, default template |
| O5 | Medium (a11y) | `Sidebar.tsx:101` `text-brand` on near-white; `focus-visible:outline-brand` | School brand colours are arbitrary. A light primary (e.g. `#F2C94C`) gives about 1.6:1 for the active nav label, and Global Constraints require 4.5:1. `--on-brand` covers text **on** brand, not brand-coloured text. | open — needs a darkened `--brand-ink` var in `applyBrand` (additive) used for brand text; Phase 3 profile could warn on light primaries |
| O6 | Medium (security) | `firebase.json` hosting `app` | No security headers (`X-Frame-Options`/CSP `frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`). The admin app can be framed (clickjacking on Publish/Delete). | open — Phase 1/6: add headers; check Google sign-in still works if `authDomain` moves to the app host |
| O7 | Low | `clash.ts:6` `entryWindow` (by design) | The window comes from `classIds[0]`'s template. A group draft mixing templates is checked only on the first class's times. | open — Phase 1 `saveEntry` must reject mixed-template/mixed-grade blocks (already in notes) |
| O8 | Low | `clash.ts:25`, `availability.ts`, `blocks.ts` | A non-existent (day, period), e.g. 6C Fri P8 on Short Friday, yields no window, so every teacher and class shows as free and available. | open — Phase 1 `saveEntry` must reject an invalid period; Phase 4 must not render or select such slots |
| O9 | Low | `availability.ts:16` `teacherDayLoad` | Orphaned entries (beyond a shrunk template) still count towards daily load and `over-limit` warnings. | open — acceptable until orphans are cleaned; Phase 3 templates screen should push to fix orphans |
| O10 | Low | `now.ts` | The free window still starts at the row start even if a cell from another template ended inside the row (e.g. "Free 09:50–10:30" though class ran to 10:20). `minutesLeft` is correct. Left as is so an existing tested behaviour is not changed. | open — Phase 5 may prefer `max(row.start, prev.end)` |
| O11 | Low | `now.ts:10-13` | Uses the device's local timezone. A teacher's phone set to another timezone gives the wrong now-card. | open — Phase 5 could compute in `Asia/Colombo` |
| O12 | Low | `firestore.ts:56-62` | A `QueryConstraint` holding a `DocumentReference` cannot be serialised. The key falls back to the constraint count, so changing the referenced doc keeps the old listener (stale data). | open — Phases 3–5: don't filter by `DocumentReference`; use id strings |
| O13 | Low | `router.tsx:28` `under()` | `/me` matches only `/me` and `/me/…`, and `/admin` the same. A route like `/admin-x` or `/mine` is public. Duplicate mirrored `/s/:sid/*` paths aren't detected (already in notes). | open — Phase 6 integration check |
| O14 | Low | `router.tsx:36` `HomeRedirect` | A user who is both admin and super always lands on `/admin`. `/super` is reachable only by URL, and the super school view has no link back. | open — Phase 5 super nav |
| O15 | Low | `pnpm-workspace.yaml` `allowBuilds` | This is a pnpm 11 key. pnpm 9 builds everything (fine). pnpm 10 would block esbuild/protobufjs/re2 postinstalls because it needs `onlyBuiltDependencies`. Root `lint` is a no-op: no package defines `lint`. | open — pin `packageManager` or add `onlyBuiltDependencies`; add lint later |
| O16 | Low | `Combobox.tsx:101` | ArrowDown with zero matches sets `active` to −1. Harmless (Enter is a no-op) but `aria-activedescendant` goes stale. | open — trivial UI fix |
| O17 | Low (a11y) | `Sidebar.tsx:138-155` | In the collapsed 72px rail, the year select is hidden. The year can't be changed without expanding the sidebar. | open — matches canvas; Phase 3 dashboard has its own year selector |
| O18 | Info | Spec §3.3 vs plan | The synthetic email domain follows the plan (`…@{sid}.teachers.sathiya.lk`), not the spec. Already in notes. | open — user decision |

## Area notes

- **Clash engine.** Clock-time overlap across templates is correct and well tested (Review Focus 1, 3). Self-exclusion works by `draft.id`, and teachers come from `lessons`. Touching windows don't clash.
- **Availability, blocks, fill, plans, progress.** These match the plan and the notes. `editingEntryId` is honoured in `teacherOptionsForSlot`, `classOptionsForTeacherSlot` and `joinableClasses`. Short Friday is handled: 6C is excluded from joins, and default P8 on Friday is not offered for 6C.
- **Empty Sinhala names.** `pickName` and the snapshots trim whitespace-only Sinhala names and fall back to English. i18n uses `returnEmptyString: false` with English fallback. The en/si parity test passes, and every `t()` key used in the shell exists.
- **Router contract.** Guards, role redirects, the `/admin/print` split, `/me` school scope and the `/s/:sid` mirror behave as documented in the notes.
- **Test gaps** (some closed by F1–F4):
  - No core test for a template whose periods fall outside the default rows (F1).
  - No test for a combined cell (F3).
  - No test for an Escape press inside a Combobox nested in a Modal (by reading the code, the Combobox calls `stopPropagation`, so the Modal stays open).
  - No test for `useCollection` with an unserialisable constraint.
