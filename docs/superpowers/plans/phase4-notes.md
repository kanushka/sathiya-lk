# Phase 4 notes — Timetable editor + print

## Deviations

### 4.1 Shared grid
- `save`/`remove` resolve to `Promise<boolean>` (ok) instead of `Promise<void>`; errors are toasted inside the hook, never thrown.
- `cellsFor` returns `CellView | CellView[] | null`; arrays render stacked in one slot (teacher grid two-class default row).
- Added `onActivate`, `onClear`, `readOnly` props. Read-only still allows selection, blocks Enter/click-to-activate/Delete.
- perDay templates: row structure is taken from the day with the most rows; each day column maps by period number to its own window, and days lacking that period render a blank spacer. Arrow keys skip non-existent slots.
- `useTimetable` API is injectable via `TimetableApiContext` (`saveEntry`/`deleteEntry`); default calls the callables.
- Optimistic overlay entries stay until the next Firestore `entries` snapshot after the call succeeds, then are dropped.

### 4.4 Block editor
- `BlockEditor` props: `{ open, onClose, baseClassId, day, period, mode: {kind:'group', item} | {kind:'combined', subjectId}, entry? }`; closes itself on successful save/remove.
- Combined mode requires 2+ classes to enable Save; group mode allows base class alone.
- Chips are filtered by `effectivePlan` (group key / subject item); classes already on an edited entry stay visible so they can be unchecked.
- `findClass`/`gradeOf`/`templateOf` are not exported from `@sathiya/core` index, so resolved from `ctx` inline.
- Busy and not-qualified teachers are disabled `<option>`s; a previously chosen teacher who becomes busy stays selected, flagged, and Save is disabled.

## Requests for shell/core
