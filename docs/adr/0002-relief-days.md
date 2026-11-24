# 0002. Relief days as a dated overlay

Status: accepted
Date: 2026-11-24

## Context
Admins need to cover absent teachers each morning, suggest fair relief teachers and tell them. Options:
- A. One doc per date holding the day's leaves and reliefs, written by a `saveReliefDay` callable.
- B. Admin writes the doc through rules and a Firestore trigger emails. Rules cannot check "teacher is free", so errors show up after saving.
- C. Relief as dated timetable entries plus republish. Mixes dated changes into the weekly model and publish rebuilds every snapshot.

## Decision
- A. `reliefDays/{date}` overlays the published snapshots; the weekly timetable is untouched. The callable validates in a transaction against the published snapshots (not draft entries), so a relief teacher is free exactly when teachers see them free. Saves are rejected with `republish` when the active year's snapshots predate relief (cells lack `entryId`) and with `stale` when another admin saved first. `reliefMeta/stats` holds the year's relief counts used for fair suggestions.
- Emails are debounced through a task queue. Each save stores `reliefNotified.pending[teacherId] = savedAt`; the task sends only if its teacher's token still matches, so a later save that changes other teachers does not cancel this teacher's mail. Relief address is the teacher's email, else the linked member's email.
- Teachers cannot read setup data (classes, subjects), so display labels (`labels[entryId]`: class, subject, Sinhala subject) are denormalised into the day doc when saved.
- Same-day only; no planned substitutions.

## Consequences
- Checks stay server-side, same pattern as `saveEntry`; teacher app reads one live doc and overlays it.
- Old day docs without labels show blank titles; the label shape is now part of the schema.
- Leave and relief records are kept for the life of the school account.
