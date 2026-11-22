# Bulk import of teachers and subjects — design

Approved by the owner on 2026-11-22.

## Why
Adding teachers one by one is the only way today; a new school with 40–100 staff gives up. Admins already keep staff lists in Excel / Google Sheets.

## Goals
- Download a template → fill in Excel/Google Sheets → upload → see every problem before anything is saved → import only new items.
- After importing teachers, print login slips for all of them (each gets an account + 8-char password, like `createTeacher`).

## Non-goals / anti-goals
- No export of existing data, no "edit by re-upload", no updates or deletes via import. Import only adds.
- No partial imports: if any row has an error, nothing is written.
- No direct Google Sheets API link; Sheets users use File → Download → Excel (.xlsx) or CSV.

## Template
One `.xlsx` (download from the app) with three sheets. Headers bilingual ("Full name / සම්පූර්ණ නම"); parse by header text, not position.

**Subjects**: Name (English)* · Name (Sinhala) · Short name (blank → auto via existing `subjectShort` logic, unique). Colour auto-assigned like manual add.

**Teachers**: Staff ID (blank → next number with school prefix, `nextStaffNumber`) · Title (one of `TEACHER_TITLES`) · Full name* · Phone · Email · Subjects (comma-separated; match English name, Sinhala name or short name, case-insensitive) · Grades ("6-9, 11"; must be in `school.grades`) · Max periods/day (blank → same default as TeacherModal) · Primary teacher? (Yes/No, ඔව්/නැත; blank → No).

**How to fill**: instructions in Sinhala and English, list of valid titles and the school's grades.

CSV upload also accepted: one CSV per kind (Teachers CSV or Subjects CSV, detected by headers). Offer CSV template downloads too.

## Validation (all before writing, shown as a table: sheet · row · column · message, bilingual i18n)
- Staff ID: wrong format for `school.staffPrefix`; already used by an existing teacher; duplicated in file.
- Subject: English or Sinhala name, or short name, already exists (case-insensitive, trimmed) or duplicated in file.
- Teacher subject references must resolve to an existing subject or one in the file's Subjects sheet.
- Title in list; grades in school grades; phone/email valid (reuse existing validators); required fields present.
- Max 200 rows per sheet. Unknown/missing headers → clear error.
- Server re-validates everything (never trust client); client validation is for the preview.

## Flow / UI
- "Import" button beside the "+" on Teachers and Subjects pages → modal: Download template · Upload file · Preview (counts: "12 subjects, 45 teachers to add") or error table · Import button disabled while errors exist.
- On success: summary + "Print login slips" for the new teachers (reuse existing slip print).
- Desktop-first like the other admin screens; match existing button/toast/spinner patterns and custom menus.

## Server
New callable (e.g. `importSetup`), `requireSchoolAdmin`, App Check like the others. Creates subjects first, then teachers (Auth user + claims + teacher doc + member doc, same order/rollback rules as `createTeacher`; extract shared helper rather than duplicating). Returns `{ subjectIds, teachers: [{teacherId, staffId, password}] }`. If a teacher create fails mid-way, roll back that teacher and report which were created (best-effort; document it).

## Left to the builder
Parsing library (must handle .xlsx in browser; prefer a maintained lib, avoid the stale npm `xlsx` 0.18), template generation (static asset vs generated), exact error copy, tests (core validation unit tests, functions emulator tests, one e2e).
