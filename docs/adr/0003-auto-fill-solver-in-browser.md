# 0003. Auto-fill solver in the browser

Status: accepted
Date: 2026-11-25

## Context
Building a full timetable by hand takes days. Auto-fill (#61) must allocate teachers to class subjects and place every plan item (periods or exact minutes on uneven templates, parallel groups, class-teacher first periods, daily limits) while keeping hand-placed lessons. Options:
- A. Our own heuristic solver in `packages/core`: pattern-first greedy placement, repair, seeded restarts.
- B. ILP/MIP via WebAssembly (e.g. HiGHS): optimal when solvable, but a ~3 MB download, the model grows fast with minute combinations, big schools can take minutes, and failure is a bare "infeasible" with no reason.
- C. An LLM: slow, not repeatable, costs per run, and its output would still need A's checks.

## Decision
- A. The solver lives in `packages/core/src/autofill` with no new dependencies and runs in a Web Worker (`solver.worker.ts`) so the page stays responsive; the UI shows progress and Cancel terminates the worker.
- Each run is deterministic for the same input and seed; "Try again" picks a new seed. Restarts stop at an 8 s budget and keep the best score (unplaced first, then soft rules).
- Every unplaced item comes back with a concrete reason for the preview.
- Nothing is written until Save. The `applyAutoFill` callable validates every draft, rechecks clashes against current entries (minus the deletes), and writes in chunks while holding a lease on the year doc (`applyingUntil`); `saveEntry`/`deleteEntry` refuse with `busy` while it is held. A clash returns `clash` and the client offers a re-run on fresh entries.

## Consequences
- No server cost per run, works with the existing callable-only write model, and the same core code is unit-tested.
- Results are not provably optimal; very tight schools may get a few unplaced slots, which the admin finishes by hand.
- Slower devices get fewer restarts inside the 8 s budget, so results can differ by device even with the same seed once the budget, not the attempt count, ends the search.
- Solver rules must stay in step with the readiness check (`readiness.ts`) and with `findConflicts`; a change to clash or staffing rules touches all three.
- A partial write failure is reported with counts; re-running in fill-around mode recovers.
