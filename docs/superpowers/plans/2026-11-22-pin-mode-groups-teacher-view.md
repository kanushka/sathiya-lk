# Pin mode for groups and teacher view — implementation plan

**Goal:** extend the merged class-view Pin mode to (1) group plan items (e.g. Religion: one teacher per option subject, optional joined classes) and (2) the teacher view (pin a class's lessons on the teacher's grid, matched by clock time across templates).

**Approved design:** "Sathiya Screens" canvas, artboards `GroupPin.dc.html` ("Timetable · Group pin mode") and `TeacherPin.dc.html` ("Timetable · Teacher view pin mode"), next to `ClassPaint.dc.html`. Summary of the approved behaviour is in this file; it is the binding spec.

**Approved answers to open questions:**
1. A placed group cell outside Pin mode still opens the existing `BlockEditor`. Only `+` (AssignPicker) and the lesson-list Pin button start group Pin mode.
2. Lesson-list Pin on a group row starts Pin mode straight away with the teachers and classes of the class's latest entry of that group (latest = highest `day*100+period`). With no entry yet, it opens AssignPicker directly at the group step (whole week).
3. Teacher view: when several class periods map to one teacher row, the row uses the first free one (else the first one).

## Global constraints

- Every source file starts with the two-line header: `// SPDX-License-Identifier: AGPL-3.0-or-later` / `// Copyright (C) 2026 Kanushka Gayan`. `pnpm check:license` must pass.
- No code comments unless explaining a non-obvious why. No docstrings.
- Reuse, don't fork: the class-view Pin mode pieces (`usePinMode`, `PinBar`, overlay cell rendering, legend, Esc handling, focus restore) are generalised and shared. Do not copy them into the teacher view.
- New overlay / availability logic lives in `packages/core` with vitest tests. App code only renders.
- Entries are written only via `save` / `remove` from `useTimetable` (which call the `saveEntry` / `deleteEntry` callables). Clash rejections are handled exactly as the existing Pin mode does (save returns false; the hook shows nothing extra; `useTimetable` already surfaces the error).
- Every user-visible string goes through i18next in `packages/i18n/src/en/timetable.json` AND `packages/i18n/src/si/timetable.json` (Sinhala translation, not English copy). The i18n test fails on any en key missing in si. Use i18next plurals (`_one` / `_other`) for counts.
- Keyboard + screen reader parity with existing Pin mode: grid cells are buttons with full `aria-label`s, the `role="status"` message announces start/pin/unpin/stop, Esc exits (not while a dialog is open or focus is in an input), Done exits, focus is restored after exit, listboxes use `role="combobox"`/`listbox`/`option` + `aria-activedescendant` + arrow keys + Enter (ignore IME composing via `isComposing`), as in `AssignPicker`.
- Disabled in the read-only view (`useReadOnly()`): no pickers, no Pin mode, no pin buttons.
- Design rules: popups (the shared `Modal`), not side panels; search on lists; the preferred teacher (or class) starred `★` first; the `pin` Icon; a bar labelled "Pin mode" in the school brand colour (`bg-brand text-on-brand`); no "Change teacher" option in the bar; the "+N over" chip; Esc / Done exit.
- Admin screens are desktop-only.
- Tests: vitest + Testing Library, same style as neighbouring `*.test.tsx`. Run `pnpm --filter @sathiya/core test`, `pnpm --filter app test`, `pnpm typecheck` before reporting.
- Commits: one line, `type(scope): description`, e.g. `feat(core): ...`, `feat(app): ...`, `test(e2e): ...`. No Co-Authored-By, no AI attribution, no trailers.
- Fixtures: `packages/core/src/fixtures.ts` (`ctx`, `entries`, `entry()`, ids `C`, `S`, `T`, `TPL`). Do not change existing fixture data (e2e seed uses it); add new fixtures only inside test files.

## Domain recap

- Entry: `{day, period, classIds[], lessons[{subjectId, teacherId}], teacherIds[], groupKey?}`. `period` is the period number in the template of `classIds[0]` (all classes in a block share a template).
- Group plan item: `{kind:'group', key, nameEn, nameSi?, optionSubjectIds[], perWeek}`. A group entry has one lesson per option subject and `groupKey = item.key`.
- Clash = same day + clock-time overlap (`findConflicts` in `clash.ts`).
- Teacher grid rows are the default template's periods. An entry sits on the teacher row it overlaps most: `bestOverlapPeriod(defaultTemplate, day, entryWindow(e))` (see `TeacherViewPage`).

---

## Task 1: core — generalised pin overlay, teacher-row overlay, helpers

**Files:** `packages/core/src/pin.ts`, `packages/core/src/pin.test.ts`, `packages/core/src/blocks.ts` (+ test), `packages/core/src/availability.ts` (+ test). Update the existing app callers just enough to compile (`apps/app/src/features/timetable/usePinMode.ts`, `AssignPicker.tsx`): keep their behaviour identical by passing a single-lesson spec.

### API (exact)

```ts
export interface PinSpec { classIds: string[]; lessons: Array<{ subjectId: string; teacherId: string }>; groupKey?: string }
export interface PinArgs { ctx: SchoolContext; entries: Entry[]; spec: PinSpec }
export type PinCell =
  | { kind: 'pinned'; entry: Entry }
  | { kind: 'taken'; entry: Entry }
  | { kind: 'busy'; busy: BusyDetail; blockers: BusyDetail[] }
  | { kind: 'free'; load: number; max: number; limit: boolean; teacherId: string; subjectThatDay: boolean };
export interface PinSlot { day: DayIndex; period: number; cell: PinCell }
export interface PinProgress { placed: number; needed: number; left: number; over: number }

export function singleSpec(classId: string, subjectId: string, teacherId: string): PinSpec;
export function matchesSpec(e: Entry, spec: PinSpec): boolean;
export function pinSlots(args: PinArgs): PinSlot[];
export function suggestPins(args: PinArgs & { count: number }): Array<{ day: DayIndex; period: number }>;
export function pinProgress(args: PinArgs): PinProgress;

export type TeacherPinCell = PinCell | { kind: 'none' };
export interface TeacherPinSlot { day: DayIndex; row: number; period: number | null; cell: TeacherPinCell }
export function teacherPinSlots(args: PinArgs & { teacherId: string }): TeacherPinSlot[];

export function latestGroupSpec(args: { ctx: SchoolContext; entries: Entry[]; classId: string; groupKey: string }): PinSpec | null;
```
`isPinnedLesson` and the old `PinTarget` interface in core are removed (replaced by `matchesSpec` / `PinArgs`).

### Semantics

- **Base class** = `spec.classIds[0]`; slots cover every period of its template (`periodsFor`), days 0–4.
- `matchesSpec(e, spec)`: `e.groupKey === spec.groupKey` (both undefined counts as equal), same set of classIds (order-insensitive, same length), and same multiset of `{subjectId, teacherId}` lessons (order-insensitive). For a single spec this equals the old `isPinnedLesson`.
- **Own slot:** if an entry on that day+period includes the base class: `pinned` if `matchesSpec`, else `taken`.
- **Busy:** run `findConflicts({day, period, classIds: spec.classIds, lessons: spec.lessons, ...(groupKey)}, entries, ctx)`. Walk conflicts in order, dedupe by `entryId`, map each hit entry to a `BusyDetail`: if the hit has a lesson taught by any spec teacher → `busyDetail(hit, 'teacher', thatTeacherId)` (first spec teacher, in spec lesson order, that the hit contains); else `busyDetail(hit, 'class', spec.lessons[0].teacherId)`. `blockers` = all of them, `busy` = `blockers[0]`.
- **Free:** for each spec teacher compute `teacherDayLoad(teacherId, day, entries)` and its `maxPerDay`. Report the tightest teacher: the one with the largest `load - max` (ties: earliest in spec lesson order). `limit = load >= max` for that teacher. `subjectThatDay`: some entry that day includes the base class and — group spec: `e.groupKey === spec.groupKey`; single spec: `e.lessons.some(l => l.subjectId === spec.lessons[0].subjectId)`.
- Unknown base class / template or unknown teacher in spec → `[]`.
- `suggestPins`: same algorithm as today (spread across days by fewest same-subject-that-day count, then earliest day/period; skip a day once any spec teacher reaches `maxPerDay`, counting picks), generalised to all spec teachers; same-subject count uses the `subjectThatDay` rule above.
- `pinProgress`: from `classProgress(baseClass, entries, effectivePlan)` pick the row with `item.kind === 'group' && item.key === spec.groupKey` when `groupKey` is set, else `item.kind === 'subject' && item.subjectId === spec.lessons[0].subjectId`. Missing row → `needed 0`.
- `teacherPinSlots`: rows = `periodsFor(defaultTemplate, day)` (template with `isDefault`; none → `[]`). For each day and row:
  1. Teacher entries placed on this row = entries with a lesson by `teacherId` whose `bestOverlapPeriod(default, day, entryWindow(e))` equals the row. If any `matchesSpec` → `{period: e.period, cell: {kind:'pinned', entry}}`; else if any → `{period: null, cell: {kind:'taken', entry: first}}`.
  2. Else the base class's periods whose `bestOverlapPeriod(default, day, windowOf(baseTemplate, day, p))` equals the row. None → `{period: null, cell: {kind:'none'}}`. Else take their `pinSlots` cells and choose the first `free`, otherwise the first one; `period` = that period.
- `latestGroupSpec`: the base class's entry with `groupKey` = given key having the highest `day*100+period`; return `{classIds: e.classIds with classId first, lessons: e.lessons filtered to non-null teacherId, groupKey}`; `null` if none or if any lesson has no teacher.

### blocks.ts

```ts
export function blockMates(args: { ctx: SchoolContext; baseClassId: string; item: { groupKey: string } | { subjectId: string } }): SchoolClass[];
```
Other classes with the same `gradeId` and `templateId` as the base whose effective plan contains the item (group: `kind==='group' && key===groupKey`; subject: `kind==='subject' && subjectId===subjectId`), sorted by name (numeric).

### availability.ts

```ts
export interface TeacherClassOption { cls: SchoolClass; item: PlanItem; subjectId: string; preferred: boolean; template: PeriodTemplate }
export function teacherClassOptions(args: { ctx: SchoolContext; entries: Entry[]; teacherId: string; subjectId: string }): TeacherClassOption[];
```
Classes whose grade the teacher `teachesSubject(teacher, subjectId, grade.number)` and whose effective plan has the subject either as a subject item or as an option of a group item (`item` is that plan item; prefer the subject item if both). `preferred` = `preferredTeacherFor({entries, classId, subjectId}) === teacherId`. Sort: preferred first, then grade number, then class name (numeric).

### Tests (pin.test.ts etc.) — must include

- Existing pinSlots/suggestPins/pinProgress tests rewritten to the spec API with unchanged expectations except busy cells now also carry `blockers`.
- Group spec over 6A+6B (`religion`, Ananda/M. Silva/Rizan): a slot where only Rizan teaches elsewhere is `busy` with one teacher blocker naming Rizan; a slot where Rizan and 6B are both busy lists both blockers (teacher first, deduped); a fully free slot is `free`; an existing matching religion entry is `pinned`, a religion entry with a different teacher is `taken`.
- Free cell reports the tightest teacher at limit.
- `pinProgress` for the group counts the group row (e.g. 6B religion seeded entries).
- `teacherPinSlots` across templates: Mrs. Wickramasinghe (`T.wickramasinghe`) with class 1A on the Primary template: row 1 → period 1 (taken by fixture `e-1a-0-1` on Monday), row 5 on Tuesday → period 5 (10:40–11:05; first of the two primary periods 5 and 6 mapped there), rows 6–8 → `none`; after adding a 1A entry at period 5, row 5 uses period 6 if free… (assert the first-free rule); a matching entry shows `pinned` on its row.
- A clash only visible by clock time: a teacher entry on a default-template row overlapping a 1A period that maps to a different row makes that row `busy`.
- `blockMates`, `teacherClassOptions`, `latestGroupSpec` basic cases.

---

## Task 2: app — generalise Pin mode pieces (no behaviour change for single subjects)

**Files:** `usePinMode.ts`, `PinBar.tsx`, new `pinOverlay.tsx`, `ClassViewPage.tsx`, `AssignPicker.tsx` (type only), their tests.

- `usePinMode` takes `{ ctx, entries, save, remove, view }` where `view` is `{ kind: 'class' }` or `{ kind: 'teacher'; teacherId: string }`, and its target is a core `PinSpec`. It exposes the same members as today plus:
  - `cellAt(day, n)` returns the cell for class period `n` (class view) or teacher row `n` (teacher view, `TeacherPinCell`), and `periodAt(day, n)` the class period to write (`n` in class view; the slot's `period` in teacher view).
  - `toggle(day, n)` saves `{ day, period: periodAt(day, n), classIds, lessons, ...(groupKey) }` or removes the pinned entry.
  - `isSuggested(day, n)` maps suggestions (class periods) to rows in teacher view.
  - `progress` from core `pinProgress`.
  - Messages use a target name: single → `subject` + `teacher` (existing keys, unchanged text); group → group name (`pickName` of the plan item) + classes (`classNames`). Add keys `pin.startedGroup`, `pin.pinnedGroup` etc. only where needed; keep existing keys and texts for single specs.
- `PinBar`: replace `subject`/`teacher` props with `title: string` and optional `detail?: string` (rendered under the title, smaller, `text-on-brand/80`). Class view passes `title = t('pin.target', {subject, teacher})` for single specs → visible text unchanged ("History · Mr. R. Silva").
- Extract the overlay cell renderer and legend from `ClassViewPage` into `pinOverlay.tsx`: `pinOverlayCell(args): GridOverlay | null` and `<PinLegend …/>`. Inputs: the cell, the day/row label parts (`day`, `n`, `time`), names for the aria label, progress, suggestion flag, and (teacher view) the class-period note. Cell classes/colours stay exactly as now. Busy cells: visible text = first blocker reason, plus `+N more` (`pin.moreBlockers`) when `blockers.length > 1`; `title` and `aria-label` include every blocker reason joined by `; `. A `none` cell (teacher view only): grey (`bg-[#F6F7F9] border-line text-ink-muted`), disabled, text `pin.noPeriod` ("No {{class}} period"), aria `pin.cellNone`.
- `ClassViewPage` uses the generalised hook/bar/renderer. Existing tests (`ClassViewPage.test.tsx`, `PinBar.test.tsx`, `usePinMode.test.tsx`, `AssignPicker.test.tsx`) stay green with at most mechanical prop/API updates; add tests for multi-blocker labels and the `detail` line.

## Task 3: app — group Pin mode in the class view

**Files:** new `GroupTeachersStep.tsx` (+ test), `AssignPicker.tsx` (+ test), `SubjectProgress.tsx` (+ test), `ClassViewPage.tsx` (+ test), i18n en/si.

- Subject step lists group items in both slot and whole-week mode (today whole-week hides them). Group rows show the group tag (`assign.groupTag`) and option count. Choosing one goes to the **group step** (title `assign.groupTitle` "Set teachers for {{group}}"), no longer to `BlockEditor` (remove `onGroup` from `AssignPicker`; `SlotPicker` keeps its own `onGroup` for editing existing entries).
- `GroupTeachersStep` (reused by Task 4): props `{ classId, item: GroupItem, slot | null, entries, lockedSubjectId?, lockedTeacherId?, initialClassIds?, onBack?, onConfirm(spec: PinSpec, placeNow: boolean) }`. Layout per the artboard:
  - back button (`‹ Back to subjects`) showing the group name, "group · N options", and need count;
  - caption "Teacher for each option" + hint; one row per option subject: a disclosure button (`aria-expanded`) showing the subject, the chosen teacher (or "Choose a teacher"), ★ chip when it is the preferred teacher (`preferredTeacherFor` for that option subject and class), and a status (slot: ✓ free / ⚠ busy; week: ✓). Opening a row shows a search combobox + listbox of teachers qualified for that option subject and grade (`teachesSubject`), preferred first, then free ones; each option note: slot → `{{staffId}} · free {{day}} P{{n}} · load/max` or the busy reason; week → free periods count for the chosen classes this week (from `pinSlots` with that teacher alone + chosen classes). Picking closes the row. Defaults: each option preselects its preferred teacher. A locked option shows the locked teacher with a "This teacher" chip and no disclosure.
  - "Classes together" chips when `blockMates` (group) is non-empty: base class chip fixed; mates toggle (`aria-pressed`). Initial: `initialClassIds` or, if none given, the classes of `latestGroupSpec` for that group (else just the base class). In slot mode, a mate busy at that slot shows "· busy {{day}} P{{n}}".
  - Footer note + primary button: missing teacher → disabled with note; same teacher twice → disabled with note; slot mode and the slot is free/warn for the whole spec (`pinSlots` cell) → **Assign** (save the entry at the slot, then start Pin mode); slot busy → note naming blockers + **Pin other slots** (start Pin mode without saving); week mode → **Start pinning**.
- Class view Pin bar for a group spec: `title = t('pin.groupTarget', {group, classes})` e.g. "Religion · 6A + 6B", `detail` = "Buddhism – Ven. Ananda Thero · Catholicism – Rev. Fr. M. Silva · …". Legend free label for group: `pin.legendFreeGroup` ("Free for all {{count}} teachers and {{classes}}"). Cell pin label: `pin.cellPinGroup` "{{day}}, period {{n}}, {{time}}: pin {{group}} for {{classes}}"; pinned: `pin.cellPinnedGroup` "…: {{group}} {{classes}}, pinned, click to unpin".
- `SubjectProgress`: group rows get the Pin button too (`data-pin-subject` becomes `data-pin-key` = plan key; keep focus restore working). Active state for the group row when the pin target's `groupKey` matches. Clicking Pin on a group: `latestGroupSpec` → start Pin mode directly; none → open AssignPicker at the group step, whole week.
- Placed group cells outside Pin mode still open `BlockEditor` (unchanged).

## Task 4: app — teacher view Pin mode

**Files:** new `TeacherAssignPicker.tsx` (+ test), `TeacherViewPage.tsx` (+ test), i18n en/si. Reuse `usePinMode` (`view: {kind:'teacher', teacherId}`), `PinBar`, `pinOverlayCell`, `PinLegend`, `GroupTeachersStep`.

- Empty teacher-grid cell (+) opens `TeacherAssignPicker`; editing an existing entry still opens `TeacherSlotPicker` (its empty-slot path becomes unused; leave it or trim it, but keep its tests green).
- Step 1 subject: search combobox + listbox of `teacherSubjects(teacher, ctx)`; each row shows how many periods are still needed across his classes.
- Step 2 class (title "Choose a class"): back button, search combobox + listbox from `teacherClassOptions`. Row: class label, ★ chip when `preferred` ("He teaches {{class}} {{subject}}" → use neutral `assign.teachesClass` "Teaches {{class}} {{subject}}"), template chip when the class template is not the default ("{{template}} template"), need count, and a note: for the clicked slot — free as "{{class}} P{{n}} · {{time}}", busy reason, or "No {{class}} period here" — plus free count this week (`teacherPinSlots` free cells). For a group item the row reads "{{class}} · {{group}} ({{subject}})".
  - Selecting a subject-item class shows "Teach together" chips from `blockMates({subjectId})` (optional combined entry; classIds = base + chosen mates).
  - Selecting a group-item class moves to `GroupTeachersStep` with `lockedSubjectId = subjectId`, `lockedTeacherId = teacher.id`, the clicked slot.
  - Footer like the group step: free → **Assign** (save at `periodAt` of that row, then Pin mode); busy/none → note + **Pin other slots**.
- Pin mode on the teacher grid: same bar (title `t('pin.target', {subject, teacher: className list})` → use `pin.teacherTarget` "{{subject}} · {{classes}}"; group → `pin.groupTarget`), `detail` for a class on another template: `pin.otherTemplate` "{{class}} runs on the {{template}} template: cells show its own period and time where they differ". Cells: from `teacherPinSlots`; a free cell whose class-period time differs from the row shows `{{class}} P{{n}} · {{time}}` as an extra line and in the aria label. Existing teacher lessons are dimmed `taken` cells; matching ones are `pinned` (click to unpin). Day load meters stay in the header.
- Esc / Done / focus restore / `role="status"` message exactly like the class view. Teacher change (navigation) ends Pin mode (component is keyed by teacher).
- Disabled in read-only view.

## Task 5: e2e

**Files:** `e2e/specs/11-group-pin.spec.ts`, `e2e/specs/12-teacher-pin.spec.ts`; update `05-teacher-view-block.spec.ts` if Task 4 changed its flow (keep its intent: a group built from the teacher view lands in the class view). Use helpers in `e2e/helpers.ts` (`loginAdmin`, `callAs`, `idToken`, `shot`), seed exports (`ADMIN`, `SID`, `YEAR_ID`, `admin()`).

- **Group pin flow:** give class 6C (Short Friday template, no same-template mates) a `planOverride` = Grade 6 plan with Religion options reduced to Buddhism + Catholicism (perWeek 3), written with the admin SDK before the test. Make Ven. Ananda Thero busy at one slot (create an entry for another class via `callAs(…,'saveEntry',…)`). In 6C: + → Religion → both teachers preselected (or pick them) → Start/Assign → Pin mode bar shows "Religion · 6C"; the blocked cell's label names Ananda; pin 3 free slots; progress reaches "3 of 3 placed · complete"; Esc exits; the 3 entries show as Religion in 6C. Screenshot `group-pin-mode`.
- **Teacher-view flow with a different template:** Mrs. S. Wickramasinghe (primary, grade 1); class 1A runs on the Primary template. + on a free row → subject → 1A → Assign; Pin mode; assert a cell whose label includes the 1A period time (e.g. "1A P5 · 10:40–11:05"), rows 6–8 show "No 1A period" (disabled); pin one more; Done; the class view of 1A shows the lessons at the expected 1A periods. Screenshot `teacher-pin-mode`.
- Restore any data you changed that other specs depend on (specs run in order, single worker), or choose slots that do not collide with later specs.
