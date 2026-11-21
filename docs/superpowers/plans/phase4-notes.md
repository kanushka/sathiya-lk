# Phase 4 notes — Timetable editor + print

## Deviations

### 4.1 Shared grid
- `save`/`remove` resolve to `Promise<boolean>` (ok) instead of `Promise<void>`; errors are toasted inside the hook, never thrown.
- `cellsFor` returns `CellView | CellView[] | null`; arrays render stacked in one slot (teacher grid two-class default row).
- Added `onActivate`, `onClear`, `readOnly` props. Read-only still allows selection, blocks Enter/click-to-activate/Delete.
- perDay templates: row structure is taken from the day with the most rows; each day column maps by period number to its own window, and days lacking that period render a blank spacer. Arrow keys skip non-existent slots.
- `useTimetable` API is injectable via `TimetableApiContext` (`saveEntry`/`deleteEntry`); default calls the callables.
- Optimistic overlay entries stay until the next Firestore `entries` snapshot after the call succeeds, then are dropped.

### 4.2 Class view + slot picker
- `SlotPicker` is a centred Modal opened on slot activation (not a right-column panel); right column holds only `SubjectProgress`. No selected-slot summary card.
- `SlotPicker` takes `entries`, `onSave`, `onClear` from the page's `useTimetable` instance so optimistic overlay shows in the page grid; it does not call `useTimetable` itself.
- Not-available list hides teachers who never teach the chosen subject (incl. primary teachers); not-qualified shown only for subject teachers outside the grade ("Doesn't teach Grade 6"). Limit-reached teachers are listed but not clickable (BlockEditor still allows them).
- "needs N" counts exclude the entry being edited. Subjects order: still-needed (plan order), then complete.
- Progress list uses full bilingual subject names (`pickName`), grid cells use `Subject.short` in en / `pickName` in si. Total = filled slots of the class inside its template / `weekCapacity`.
- Group cell sub: "⧉ 6A+6B" (all classes, sorted) when joined, else "Group · N teachers"; combined single-lesson cells: "⧉ 6A+6B · teacher".
- Fill: drafts snapshotted when the confirm modal opens; saved one by one, stops on first failed save; button hidden when no class teacher, disabled when 0 drafts.
- Delete key on a multi-class (group/combined) cell opens the BlockEditor (with Remove block) instead of deleting; single-class cells (incl. single-class groups) are removed directly. (Changed in 4.3.)
- Super-admin mirror: `useAdminBase()` (paths.ts) returns `/s/:sid` or `/admin`; used for class nav and print URL.
- Refactored BlockEditor's reason text into shared `teacherReason` (labels.ts); no behaviour change.
- ~~Known gap: `BlockEditor` calls its own `useTimetable()`~~ — fixed in 4.3: BlockEditor receives `entries`/`onSave`/`onRemove` from the page's `useTimetable`.

### 4.3 Teacher view
- Routes `/admin/timetable/teacher` (redirects to first teacher by `name.localeCompare`) and `/admin/timetable/teacher/:teacherId`. Teacher picker is the searchable `Combobox` (label "Name · staffID", search matches name or staff ID) between prev/next buttons, not a native select.
- Rows = default template (`isDefault`); no default template → empty state. Each entry with a lesson for the teacher goes to `bestOverlapPeriod(default, day, entryWindow(entry))`; several in one row render stacked (sorted by start). Entries with no overlap are listed under the grid as "Outside school hours" (text list, not editable from there).
- Cell: title = class names joined "+" (prefixed "⧉ " when group or multi-class, incl. single-class groups), sub = full subject name the teacher teaches (`pickName`), colour = that subject's colour. When the class period's clock time differs from the default row (e.g. Primary), sub becomes "Sinhala · 10:40–11:05" so stacked cells are distinguishable.
- Load bar per day header: `role="meter"` with `aria-valuetext` "5/6" and `data-over`; fill `--brand`, red `#B4441C` when load > maxPerDay (artboard's green/amber-at-limit not used, per controller ruling). Counts entries (`teacherDayLoad`), so two stacked Primary lessons count 2.
- `TeacherSlotPicker` (Modal): subject Combobox (teacher.subjectIds; primary → every subject/group option in plans of their grades incl. class plan overrides), then classes from `classOptionsForTeacherSlot` split into "Free classes" (clickable) and "Not free" (disabled buttons, reason "Busy"). Class period time shown as "P6 11:05–11:30" only when its clock time differs from the default row. Group-option classes are tagged "Religion block" and open BlockEditor (group mode, `preset` teacher) at the matched class period instead of saving.
- Filled single-class non-group entry → TeacherSlotPicker in edit mode ("Now: 6B · Mathematics", Clear slot, reassign keeps the entry id). Group/combined → BlockEditor with base class = `entry.classIds[0]`. Converting an edited lesson into a group passes the entry to BlockEditor only when the class and period are unchanged; otherwise a new block is created and the old lesson stays.
- Row with 2+ entries: activation or Delete opens a "Choose a lesson" modal listing them; Delete never removes several entries at once.
- Print button opens `${base}/print/teacher/:id?year=…&auto=1` (route arrives in 4.5).
- `blockState.ts` holds the shared `BlockState`/`blockKey`/`blockStateFor`/`isBlock` used by both views (class view keeps the current class as block base).

### 4.4 Block editor
- `BlockEditor` props: `{ open, onClose, baseClassId, day, period, mode: {kind:'group', item} | {kind:'combined', subjectId}, entry?, entries, onSave, onRemove, preset? }`; closes itself on successful save/remove. Since 4.3 it no longer calls `useTimetable()` itself: the page passes its `entries`/`save`/`remove` so the optimistic overlay survives the modal closing. `preset {subjectId, teacherId}` preselects a teacher for one option (teacher view).
- Combined mode requires 2+ classes to enable Save; group mode allows base class alone.
- Chips are filtered by `effectivePlan` (group key / subject item); classes already on an edited entry stay visible so they can be unchecked.
- `findClass`/`gradeOf`/`templateOf` are not exported from `@sathiya/core` index, so resolved from `ctx` inline.
- Busy and not-qualified teachers are disabled `<option>`s; a previously chosen teacher who becomes busy stays selected, flagged, and Save is disabled.

### 4.5 Print
- Routes `/admin/print/class/:id` and `/admin/print/teacher/:id` (`year`, `published`, `auto`); router mirrors them to `/s/:sid/print*`. `usePrintSnapshot` builds the draft with `buildSnapshots` (unknown `?year=` ignored; a known different year calls `setYearId` and shows loading until entries of that year arrive). `?published=1` reads `publishedClass`/`publishedTeacher` via `useDoc` (string paths); `PublishedDocContext` is the test seam. Missing doc: "Not published yet".
- `PrintSheet` is a pure render of a Class/TeacherSnapshot (`logoUrl` passed in from `useSchool()`, not in the snapshot; shield fallback). A4 sheet is 1123x794px on screen, `@page` A4 landscape margin 10mm and full-width in print; toolbar hidden in print.
- Cell colours are not printed (artboard is monochrome). Group cell sub is built from `otherClasses`, never the English `sub`. Group note lists the distinct group cell titles ("Religion & Aesthetic run as groups ..."); no note when no group cells.
- Gap: `buildSnapshots` only sets `otherClasses` on group cells, so combined single-lesson (non-group) class cells print the snapshot teacher name without the "⧉ 6A+6B" label. `PrintSheet` already renders it when `otherClasses` is present. Request below.
- Teacher snapshot cells: title "6A+6B" is prefixed "⧉" when group or multi-class; sub = `subSi` in Sinhala. Several cells in one row are stacked (dashed divider, smaller text).
- Per-day rows: rows are aligned by index; a full-width interval band is drawn when every day has an interval at that index, otherwise per-cell. Row label time is the first day's; cells show their own time only when days differ. Slots beyond a day's rows are not rendered (O8).
- Close button: `window.close()`, falling back to `navigate(-1)`.
- The TeacherViewPage Print button already existed (4.3); 4.5 only added tests for it.

## Requests for shell/core
- `buildSnapshots` (core/publish.ts): set `otherClasses` on combined non-group class cells too (classes other than `cls`), so print and published views can show "⧉ 6A+6B".
