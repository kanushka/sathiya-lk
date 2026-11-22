# QA major + minor fixes (browser test 2026-11-22)

Source: QA report `docs/qa/2026-11-22-browser-test.md` on branch `origin/browser-test-run-3f81c3`
(read it with `git show origin/browser-test-run-3f81c3:docs/qa/2026-11-22-browser-test.md`;
screenshots via `git show origin/browser-test-run-3f81c3:docs/qa/screenshots/<name>.png > /tmp/x.png`).
Each issue has steps, expected, actual, and often the cause. Fix issues 1–23 only. Polish items 24–37 are out of scope.

Spec: `docs/superpowers/specs/2026-11-21-sathiya-design.md`.

## Global constraints

- pnpm monorepo: `apps/app` (React + Vite; shared ui in `src/ui`, features in `src/features/*`), `apps/web` (Astro), `functions/` (Functions v2, Node 22), `packages/core` (domain logic — put pure logic here with unit tests), `packages/i18n` (en + si strings), `e2e/` (Playwright), `tests/rules` (Firestore rules tests).
- Run pnpm as CI does: `npx -y pnpm@9 <cmd>`. Never let pnpm add a `packageManager` field to any package.json (revert it if it appears).
- TDD: write the failing test first, see it fail, then fix.
- Every user-visible string goes through i18n with both `en` and `si` translations (natural Sinhala, not transliteration).
- Use the shared ui components in `apps/app/src/ui` (Button, Dialog/confirm, Field, etc.); async buttons use `Button`'s loading state.
- Code comments: none by default; only for a non-obvious why. No docstrings. No references to issue numbers / QA report in code.
- Commits: one line `type(scope): description` (Conventional Commits). No body, no Co-Authored-By, no AI attribution, no session trailers.
- Per-task verification: `npx -y pnpm@9 typecheck` and `npx -y pnpm@9 test` (plus `npx -y pnpm@9 test:emulators` if rules or functions changed). Don't run `pnpm e2e` — the controller runs it once at the end; but do write/update e2e specs under `e2e/` where the task says so, matching existing spec style and seeded demo data.

## Task 1: Timetable grid single click opens the popup (#1)

Outside Pin mode, a single click on `+` or on a filled cell opens the popup (subject picker / slot editor) immediately, in both By class and By teacher grids. Cause per report: `TimetableGrid.onClick` selects first and activates only when already selected. Keep keyboard behaviour: arrows move selection, Enter/Space activates. Pin mode click behaviour unchanged. Add a component/unit test for single-click activation and keyboard activation, and an e2e spec: open Timetable → By class → 6A, click an empty `+` once, the "Choose a subject" dialog is visible. Update any existing e2e specs that double-click to work around this.

## Task 2: Consistent placed counts and visible, removable orphans (#9, #2)

#9: The class page header ("39 / 40 placed"), the class side panel per-subject counts and the dashboard Classes card ("36/40") must agree. Ruling: one shared pure function in `packages/core` computes per-class placed counts; a subject's placed periods count toward the total capped at its plan (over-plan periods don't inflate "placed"), and orphaned entries (outside the class's period template) are excluded from placed counts everywhere. Use it in both dashboard and class page. Unit tests in core.

#2: An orphaned entry (slot outside the class's current period template, e.g. Fri P7 after the template was shrunk) must be visible and removable. Ruling: the class timetable view shows a "Outside the period template" list (above or below the grid) whenever the class has orphan entries, each row showing day, period, subject, teacher(s), with a Delete action that opens a confirm dialog and calls the existing `deleteEntry` callable. Moving = delete + re-add, so Delete is sufficient; say so in the row help text is not required. The dashboard "Needs attention" orphan item links to that class view and the list is visible on arrival (scroll/anchor to it). Once deleted, the dashboard warning clears. Also check the By teacher view: if a teacher's orphan entries exist, show them the same way or at least not break. i18n en/si. Component test for the list + delete confirm; e2e spec: shrink a template (or seed/arrange an orphan via the UI as the existing e2e helpers allow), see it under Needs attention, follow the link, delete it with confirm, warning gone.

## Task 3: Group pin never silently goes over plan (#3)

In Pin mode for a group subject (Timetable by class → pin a group subject), "Classes together" must not offer — or must show disabled with a reason such as "6B already has 3/3" — any class whose target for that subject/group is already met. Pinning (manual, Suggest, "Pin N suggested") must never push any joined class over its plan: the remaining count shown in the pin bar is the minimum remaining across the base class and all joined classes, and suggestions/pins stop at that. If a joined class reaches its target, the bar says so. Apply the same rule to By teacher "Teach together (combined)": classes already at target for that subject are excluded or disabled with the reason. Pure logic (remaining-per-class, eligibility) lives in `packages/core` with unit tests; UI tests for the disabled chip and capped pin count. If server-side `saveEntry` can cheaply reject a save that would put a joined class over plan, add that with a functions test; if over-plan is an intentionally allowed manual action elsewhere (single slot editor), keep that path unchanged and only guard the pin/combined flows.

## Task 4: Suspended schools are enforced everywhere (#4, #18)

Server:
- Firestore rules: writes by an admin of a disabled school are already denied via `adminWrite`; verify every write path for admin AND teacher uses it (or an equivalent). Reads: admin and teacher of a disabled school may read only the school doc itself (so the app can show the suspended screen) — every other school-scoped read (teachers, subjects, classes, years, entries, members, etc.) is denied for them while `status == 'disabled'`. Super admins keep read-only access to everything. Add rules tests in `tests/rules` for: admin read denied on subcollections, teacher read denied, school doc read allowed, super read allowed, writes denied.
- Callables: every school-scoped callable (admin and teacher ones, including `recordSignIn` and anything a teacher calls) refuses for a disabled school with a specific error code/message the app can map (e.g. `failed-precondition` with reason `school-disabled`). Check `functions/src/lib/guards.ts` (`notAllowed('School is not active')`). Add functions tests for at least one admin callable and one teacher-facing callable.

App:
- After sign-in (admin or teacher, including an already signed-in session on reload), if the user's school is disabled and the user is not a super admin, show a full-page "This school is suspended" screen instead of the dashboard / `/me`: explains that a super admin has suspended the school, offers a contact link (use the project's existing support/contact email or website contact page — search the codebase for it) and a "Report a problem" link (the existing report popup, `?report=1` on login or wherever it lives), and a Sign out button. en/si.
- If a write still fails with the school-disabled error code, show that specific message instead of the generic "Could not add …" (map the error in the shared error helper if one exists).
- Super admins can still open the school's details read-only (existing super views); make sure the suspended screen never blocks a super admin.
- #18: Teacher login with `/login?as=teacher&school=<disabled id>`: show "This school is currently suspended. Contact your school admin." instead of an empty picker. The public `schoolDirectory` has `status`; use it (picker should not list disabled schools but the param case must explain).
- Tests: app component tests for the suspended screen gating (admin, teacher, super not blocked) and the #18 login message; e2e spec: super admin disables the seeded school (or a registered one), admin signs in → suspended screen; teacher reload of `/me` → suspended screen; re-enable restores (clean up so other specs aren't affected).

## Task 5: Setup validation and publish confirm (#5, #6, #7, #8)

- #5: Adding or editing a subject with an English name (case-insensitive, trimmed) equal to an existing subject's English name is rejected with a field error "Mathematics already exists" — same pattern as the short-name check (`shortTaken`). Also Sinhala name duplicates if non-empty. Pure check in core if subjects logic lives there.
- #6: New year label must be a 4-digit year (e.g. `^\d{4}$`, sensible range like 2000–2100) and must not duplicate an existing year label for the school; Create disabled / field error otherwise. Add the format check to Firestore rules `years` create too, with a rules test (duplicate check client-side is enough).
- #7: Register step 1 Next checks census number availability and shows the existing "This school is already registered" error on step 1. Find how census uniqueness is stored (see `registerSchool.ts`, `releaseCensusNo.ts`). Prefer reading an existing publicly readable source; if none, add a small rate-limited callable (e.g. `checkCensusNo`) returning only `{ available: boolean }`, with App Check like other callables, functions test, and wire it into the register step. The final server check stays.
- #8: The Publish confirm dialog lists a summary of the open problems the dashboard already computes (e.g. "3 problems need attention: …" with counts per kind — incomplete classes, teacher over daily limit, over-plan subjects, orphaned entries) and changes its confirm button to "Publish anyway" when problems exist. With no problems, current wording.
- i18n en/si; unit/component tests for each.

## Task 6: Teachers and members (#10, #11, #12, #13, #19)

- #10: In Teachers → Edit, Print slip and Share on WhatsApp are disabled (with a hint "Reset the password first to print a slip") until a fresh password is known in this session for that teacher.
- #11: "Print all login slips" opens a dialog first explaining passwords are only known right after a reset. Options: "Print N slips with new passwords" (only teachers whose fresh password is known; disabled when N = 0) and "Reset all passwords and print" (confirm wording: every teacher's current password stops working). Use existing reset callable(s) — batch sensibly.
- #12: "Reset password" opens a confirm dialog ("The current password stops working immediately…") before resetting.
- #13: The teacher Delete confirm already shows the usage: if the teacher is used in N slots, the first dialog says "Used in N slots. Remove them from the timetable first." with no destructive button (same pattern Subjects uses for "Used in"). Compute usage client-side from data already loaded, or the existing helper.
- #19: Members list: NAME shows the member's display name ("Principal Siripura"), EMAIL shows the email, for admins and teachers (teachers' email blank only if they truly have none — check what data exists; teacher logins are staff IDs, so show "—"). Fix the data mapping; if admin display name isn't stored on the member doc, find where it is.
- i18n en/si; component tests.

## Task 7: Login and report popup (#14, #15, #16, #17)

- #14: "Forgot password?" with empty email shows the error under the Email field (red border on Email, not Password); the error clears when the email changes and after a successful send.
- #15: Signed-out visit to `/me` (and `/me/*`) redirects to `/login?as=teacher` (Teacher tab). Admin routes keep the admin tab.
- #16: `/login?school=<id>` without `as` opens the Teacher tab with the school preselected. `?as=teacher&school=bogus` shows a message ("We couldn't find that school — choose it from the list"). (The disabled-school message is Task 4's; don't duplicate, but don't break it if it's already there.)
- #17: Report popup validates the reporter email client-side with a field error; if the callable rejects with `invalid-argument` for the email, map it to the field error too instead of the generic failure.
- i18n en/si; component tests.

## Task 8: Phone layout, modal a11y, Sinhala teacher view (#20, #21, #22)

- #20: Admin shell at phone widths (< 768px): after "Continue anyway", the sidebar starts collapsed (or becomes an off-canvas drawer) so the document has no horizontal scroll at 375px. Desktop unchanged.
- #21: When any modal (shared Dialog/Modal in `src/ui`) is open, the rest of the page (app root siblings) is `inert` (and/or `aria-hidden`), restored on close, nested modals handled. Keep existing focus trap/Esc/focus return. Component test.
- #22: Teacher `/me` date line uses the active locale (Sinhala date names/months via `Intl.DateTimeFormat('si-LK', …)` or the project's date helper). Week view cells on 390px don't truncate Sinhala subject names to "ගණි…": wrap to two lines or use the subject's short name in that locale; whichever looks clean. Component/unit test for the locale date.

## Task 9: Local dev URLs (#23)

When running `pnpm dev:local` (emulators), `sendAuthEmail` and other mail links use the local app URL (`http://localhost:5173`) and website (`http://localhost:4321`); production builds/deploys keep the production hosts. Find `mailConfig()` in `functions/src/email/params.ts` and how emulator mode is detected (e.g. `FUNCTIONS_EMULATOR === 'true'` or a `.env.local`/`.env.<project>` for the demo project). Register step 3 Terms & Conditions and Privacy links in the app use the website origin from a Vite env var (e.g. `VITE_WEB_URL`) set to localhost in the dev:local mode and the production URL by default. Also check other app → website links use the same var. Tests: functions unit test for mailConfig under emulator, app test for the link origin helper.
