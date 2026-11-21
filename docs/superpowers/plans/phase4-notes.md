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
- Delete key on a group/combined cell removes the whole entry (all classes) with no confirm.
- Super-admin mirror: `useAdminBase()` (paths.ts) returns `/s/:sid` or `/admin`; used for class nav and print URL.
- Refactored BlockEditor's reason text into shared `teacherReason` (labels.ts); no behaviour change.
- Known gap: `BlockEditor` calls its own `useTimetable()`, so its optimistic overlay is dropped when it closes; a saved block shows only once the Firestore snapshot lands. Follow-up: share one timetable state via context inside features/timetable.

### 4.4 Block editor
- `BlockEditor` props: `{ open, onClose, baseClassId, day, period, mode: {kind:'group', item} | {kind:'combined', subjectId}, entry? }`; closes itself on successful save/remove.
- Combined mode requires 2+ classes to enable Save; group mode allows base class alone.
- Chips are filtered by `effectivePlan` (group key / subject item); classes already on an edited entry stay visible so they can be unchecked.
- `findClass`/`gradeOf`/`templateOf` are not exported from `@sathiya/core` index, so resolved from `ctx` inline.
- Busy and not-qualified teachers are disabled `<option>`s; a previously chosen teacher who becomes busy stays selected, flagged, and Save is disabled.

## Requests for shell/core
