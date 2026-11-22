# Bulk import of teachers and subjects — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins download a bilingual template, fill it, upload .xlsx/.csv, see every error per row, then import new subjects and teachers all-or-nothing and print login slips.

**Architecture:** One pure validator in `packages/core` turns raw sheet cells into validated subject/teacher inputs or a list of coded errors; the browser runs it for the preview and the new `importSetup` callable re-runs it against fresh Firestore data before writing. Teacher account creation is extracted from `createTeacher` into a shared functions helper. The app parses files with `read-excel-file` (xlsx) and a small core CSV parser, and generates templates with `write-excel-file`; both libs are dynamically imported so they stay out of the main bundle.

**Tech Stack:** TypeScript, React 18 + Vite + Tailwind, Firebase Functions v2 (Node 22), vitest, Playwright, `read-excel-file` ^9, `write-excel-file` ^4.

**Spec:** `docs/superpowers/specs/2026-11-22-bulk-import-design.md`

## Global Constraints

- Import only adds. No updates, deletes, or export. If any row has an error, nothing is written.
- Max 200 data rows per sheet.
- Headers are bilingual (`"Full name / සම්පූර්ණ නම"`), parsed by header text not position. A header matches if (case-insensitive, trimmed, trailing `*` removed) it equals the full bilingual text, the English part, or the Sinhala part.
- Subjects: Name (English)* · Name (Sinhala) · Short name (blank → `suggestSubjectShort`, unique, max 10 chars = `SHORT_MAX`). Colour auto-assigned by cycling `SUBJECT_SWATCHES`.
- Teachers: Staff ID (blank → `formatStaffId(prefix, nextStaffNumber(...))`, counting earlier rows) · Title (`TEACHER_TITLES`) · Full name* · Phone · Email · Subjects (comma-separated; match nameEn, nameSi or short, case-insensitive) · Grades (`"6-9, 11"`, must be in `school.grades`) · Max periods/day (blank → 7, range 1–10) · Primary teacher? (Yes/No, ඔව්/නැත; blank → No).
- Same rules as `TeacherModal`: non-primary teacher needs ≥1 subject; every teacher needs ≥1 grade.
- Every new user-visible string in both `packages/i18n/src/en/*.json` and `si/*.json`.
- Server: `requireSchoolAdmin`, `callOpts` (App Check), never trusts the client — re-validates from raw cells.
- Repo rules: SPDX header on new source files (copy from any existing file), commit messages one line `type(scope): description`, no AI attribution, comments only for non-obvious why, never commit `.env*` or a `packageManager` field in package.json.
- Install: `CI=true pnpm install --frozen-lockfile --config.confirmModulesPurge=false` when lockfile unchanged; when adding deps use `pnpm --filter app add <pkg>` and commit the lockfile.

## Review Focus

1. Excel cells that aren't strings (numbers like `6` for Grades, `24` for Max periods, dates, booleans, `null`) → stringified before validation, never crash. (Task 1/5 tests: `cellText`.)
2. Fully blank rows in the middle or after the data (Excel leaves formatted empties) → skipped, not "Full name required". (Task 2 test.)
3. Teacher referencing a subject defined in the same file by its auto-generated short name → resolves. (Task 2 test.)
4. Two rows with blank Staff ID plus one explicit later ID that collides with an auto-assigned one → auto-assignment skips IDs used anywhere in the file. (Task 2 test.)
5. Partial server failure mid-import → created teachers are returned with passwords so slips can still be printed; the rest listed as `notCreated`. (Task 4 test via an Auth-colliding staff ID.)

---

### Task 1: Core sheet schema, header matching and CSV parsing

**Files:**
- Create: `packages/core/src/importSheet.ts`, `packages/core/src/importSheet.test.ts`
- Modify: `packages/core/src/index.ts` (export)

**Interfaces:**
- Produces:
  - `type ImportKind = 'subjects' | 'teachers'`
  - `type SubjectColumn = 'nameEn' | 'nameSi' | 'short'`; `type TeacherColumn = 'staffId' | 'title' | 'name' | 'phone' | 'email' | 'subjects' | 'grades' | 'maxPerDay' | 'isPrimary'`; `type ImportColumn = SubjectColumn | TeacherColumn`
  - `const IMPORT_COLUMNS: { subjects: readonly { key: SubjectColumn; en: string; si: string; required: boolean }[]; teachers: readonly { key: TeacherColumn; en: string; si: string; required: boolean }[] }` — header text is `` `${en} / ${si}` `` (+ `" *"` when required, in templates only).
  - `interface RawSheet { name: string; rows: unknown[][] }` (row 0 = headers)
  - `interface ImportRow<C extends string> { row: number; cells: Partial<Record<C, string>> }` (`row` is 1-based spreadsheet row number, header = 1)
  - `interface ParsedSheets { subjects: ImportRow<SubjectColumn>[]; teachers: ImportRow<TeacherColumn>[]; errors: ImportError[] }`
  - `interface ImportError { sheet: ImportKind | 'file'; row: number | null; column: ImportColumn | null; code: ImportErrorCode; params?: Record<string, string | number> }`
  - `type ImportErrorCode` = `'noSheets' | 'unknownHeader' | 'missingHeader' | 'duplicateSheet' | 'tooManyRows' | 'required' | 'staffIdFormat' | 'staffIdTaken' | 'staffIdDuplicate' | 'nameTaken' | 'nameDuplicate' | 'shortTaken' | 'shortDuplicate' | 'shortTooLong' | 'unknownTitle' | 'unknownSubject' | 'gradeFormat' | 'gradeNotInSchool' | 'maxPerDay' | 'primaryValue' | 'phone' | 'email' | 'subjectsRequired' | 'gradesRequired' | 'tooLong'`
  - `const IMPORT_MAX_ROWS = 200`
  - `cellText(v: unknown): string` — `null/undefined → ''`, numbers via `String`, booleans → `'Yes'/'No'`, `Date` → ISO date, strings trimmed.
  - `parseCsv(text: string): string[][]` — RFC 4180 (quoted fields, `""` escapes, CRLF/LF, embedded newlines), strips a leading UTF-8 BOM.
  - `readSheets(sheets: RawSheet[]): ParsedSheets` — detects each sheet's kind by its headers (a sheet whose headers match ≥1 required column of a kind; sheets matching neither, e.g. "How to fill", are ignored), maps cells by header, skips rows whose cells are all blank, reports `unknownHeader` (params `{ header }`), `missingHeader` (params `{ header: en }`), `duplicateSheet`, `tooManyRows` (params `{ max }`), and `noSheets` if no sheet of either kind found.

- [ ] **Step 1: Write failing tests** in `importSheet.test.ts`:
  - `parseCsv('a,"b,""c"""\r\n1,"x\ny"\n')` → `[['a','b,"c"'],['1','x\ny']]`; BOM stripped; trailing newline gives no empty row.
  - `cellText(6) === '6'`, `cellText(null) === ''`, `cellText(true) === 'Yes'`, `cellText('  x ') === 'x'`.
  - `readSheets` with a Teachers sheet using headers `['Full name / සම්පූර්ණ නම *', 'grades', 'ශ්‍රේණි']`… → assert English-only and Sinhala-only headers both match; result `teachers[0]` is `{ row: 2, cells: { name: 'A', grades: '6' } }`.
  - An instructions sheet (`[['How to fill'], ['...']]`) plus a Subjects sheet → only subjects parsed, no errors.
  - Extra column `'Notes'` → error `{ sheet: 'teachers', row: 1, column: null, code: 'unknownHeader', params: { header: 'Notes' } }`.
  - Teachers sheet without a Full name header but with Staff ID header → `missingHeader`.
  - Blank rows (`['', null, '  ']`) skipped and following rows keep their real row numbers.
  - 201 data rows → one `tooManyRows` error with `params.max === 200`.
  - No recognisable sheet → `[{ sheet: 'file', row: null, column: null, code: 'noSheets' }]`.

- [ ] **Step 2: Run to verify fail:** `pnpm --filter @sathiya/core test -- importSheet` → FAIL (module not found).
- [ ] **Step 3: Implement** in `importSheet.ts`; export from `index.ts`. Header normalisation: lowercase, trim, drop trailing `*`, collapse spaces.
- [ ] **Step 4: Run to verify pass:** same command → PASS; `pnpm --filter @sathiya/core typecheck` clean.
- [ ] **Step 5: Commit:** `git commit -m "feat(core): parse import sheets and CSV"`

### Task 2: Core import validation

**Files:**
- Create: `packages/core/src/importValidate.ts`, `packages/core/src/importValidate.test.ts`
- Modify: `packages/core/src/index.ts`; move `SUBJECT_SWATCHES` and `SHORT_MAX` from `apps/app/src/features/subjects/palette.ts` into `packages/core/src/subjectShort.ts` (palette.ts re-exports them so app imports keep working).
- Modify: `packages/core/src/api.ts` — add `importSetup` to `callables`, `CallableMap`, and types below.

**Interfaces:**
- Consumes: Task 1 types, `isValidStaffId`, `formatStaffId`, `nextStaffNumber`, `suggestSubjectShort`, `nameTaken`, `shortTaken`, `EMAIL_RE`, `TEACHER_TITLES`.
- Produces:
  - `interface ImportContext { staffPrefix: string; schoolGrades: number[]; subjects: Pick<Subject, 'id' | 'nameEn' | 'nameSi' | 'short'>[]; staffIds: string[] }`
  - `interface ImportSubject { row: number; nameEn: string; nameSi?: string; short: string; color: string }`
  - `interface ImportTeacher { row: number; teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt' | 'subjectIds'>; subjectRefs: SubjectRef[] }` with `type SubjectRef = { existingId: string } | { newIndex: number }` (index into `subjects`).
  - `interface ImportPlan { subjects: ImportSubject[]; teachers: ImportTeacher[]; errors: ImportError[] }`
  - `validateImport(parsed: Pick<ParsedSheets, 'subjects' | 'teachers'>, ctx: ImportContext): ImportPlan` — when `errors.length > 0`, `subjects`/`teachers` may be partial and must not be written.
  - `PHONE_RE = /^\+?[\d\s()-]{7,20}$/` exported.
  - In `api.ts`: `interface ImportSetupReq { schoolId: string; subjects: ImportRow<SubjectColumn>[]; teachers: ImportRow<TeacherColumn>[] }`; `interface ImportSetupRes { subjectIds: string[]; teachers: { teacherId: string; staffId: string; name: string; title?: TeacherTitle; password: string }[]; notCreated: string[] }` (`notCreated` = staff IDs not created after a mid-way failure).

Rules (one error per cell; collect all):
- Subjects: `nameEn` required (`required`); nameEn/nameSi taken by existing (case/space-insensitive via `nameTaken`) → `nameTaken`, repeated within file → `nameDuplicate`; short given: >10 chars → `shortTooLong`, taken/duplicate → `shortTaken`/`shortDuplicate`; short blank → `suggestSubjectShort(nameEn, [...existing shorts, ...shorts so far]).slice(0, SHORT_MAX)`. Colour = `SUBJECT_SWATCHES[(ctx.subjects.length + i) % SUBJECT_SWATCHES.length]`. Params carry `{ value }` for the offending text.
- Teachers: staffId uppercased; given but `!isValidStaffId` → `staffIdFormat` (params `{ example: formatStaffId(prefix, 24) }`); in ctx → `staffIdTaken`; repeated in file → `staffIdDuplicate`. Blank → next number from `[...ctx.staffIds, ...all explicit IDs in file, ...already assigned]`. Title: match `TEACHER_TITLES` case-insensitively ignoring a trailing `.` (`"mrs."`→`Mrs`, `"ven"`→`Ven.`) else `unknownTitle`. Name required, ≤200 chars (`tooLong`). Phone optional, `PHONE_RE` → `phone`. Email optional, lowercased, `EMAIL_RE` → `email`. Subjects: split on `,`, each matched against existing then in-file subjects by nameEn/nameSi/short (case-insensitive, trimmed) → `unknownSubject` (params `{ value }`); dedupe refs. Grades: tokens split on `,`, each `n` or `a-b` (a≤b) integers else `gradeFormat`; any not in `schoolGrades` → `gradeNotInSchool` (params `{ value }`); none → `gradesRequired`. maxPerDay blank → 7, else integer 1–10 → `maxPerDay`. isPrimary: blank/`no`/`n`/`false`/`නැත` → false, `yes`/`y`/`true`/`ඔව්` → true, else `primaryValue`. Non-primary with no subjects → `subjectsRequired` (column `subjects`). Primary teachers get `subjectRefs: []`.

- [ ] **Step 1: Write failing tests** in `importValidate.test.ts` with `ctx = { staffPrefix: 'SCC', schoolGrades: [6,7,8,9,10,11], subjects: [{ id: 's1', nameEn: 'Mathematics', nameSi: 'ගණිතය', short: 'Math' }], staffIds: ['SCC001', 'SCC002'] }`. Cases:
  - Happy path: subject `{ nameEn: 'Drama' }` → short `'Dra'`, colour `SUBJECT_SWATCHES[1]`; teacher `{ name: 'K. Perera', title: 'mrs.', subjects: 'math, ගණිතය, drama', grades: '6-8, 11', maxPerDay: '' }` → `staffId 'SCC003'`, `title 'Mrs'`, grades `[6,7,8,11]`, maxPerDay 7, isPrimary false, `subjectRefs [{ existingId: 's1' }, { newIndex: 0 }]`. Separate case: `'maths'` → `unknownSubject` with `params.value 'maths'`.
  - Each error code above has one assertion of `{ sheet, row, column, code }`.
  - Review Focus 2: blank-cell rows are already removed by Task 1; here assert rows keep their `row` numbers in errors.
  - Review Focus 3: subject `{ nameEn: 'Western Music' }` with blank short, teacher subjects `'WM'` → resolves to `{ newIndex: 0 }`.
  - Review Focus 4: rows `[blank, blank, 'SCC004']` with ctx staffIds `['SCC001','SCC002']` → `SCC003`, `SCC005`, `SCC004`, no errors.
  - Primary teacher with blank subjects → no error, `subjectRefs: []`; non-primary blank subjects → `subjectsRequired`.
- [ ] **Step 2: Run:** `pnpm --filter @sathiya/core test -- importValidate` → FAIL.
- [ ] **Step 3: Implement** `validateImport`; move swatches/SHORT_MAX; add api types.
- [ ] **Step 4: Run:** `pnpm --filter @sathiya/core test && pnpm -r typecheck` → PASS (app still compiles via palette re-export).
- [ ] **Step 5: Commit:** `git commit -m "feat(core): validate bulk import rows"`

### Task 3: Extract shared teacher account helper

**Files:**
- Create: `functions/src/lib/teacherAccount.ts`
- Modify: `functions/src/createTeacher.ts` (use helper; behaviour unchanged)
- Test: existing `functions/test/teachers.test.ts` must stay green.

**Interfaces:**
- Produces: `createTeacherAccount(sid: string, teacher: Omit<Teacher, 'id' | 'uid' | 'lastLoginAt'>): Promise<{ teacherId: string; password: string }>` — moves the body of `createTeacher` after validation: duplicate staffId query → `already-exists` failure, `auth.createUser` (email-already-exists → same failure), claims, batch create teacher + member, delete Auth user on failure. Keep the two existing why-comments with it. Also export `duplicateStaffId(staffId)` if useful.

- [ ] **Step 1:** Move the code; `createTeacher` becomes validate → `createTeacherAccount`.
- [ ] **Step 2: Run:** `pnpm test:emulators` (or with emulators already running: `pnpm --filter functions build && pnpm --filter functions test -- teachers`) → PASS, all `createTeacher`/`resetTeacherPassword` tests green.
- [ ] **Step 3: Commit:** `git commit -m "refactor(functions): extract teacher account creation"`

### Task 4: `importSetup` callable

**Files:**
- Create: `functions/src/importSetup.ts`, `functions/test/importSetup.test.ts`
- Modify: `functions/src/index.ts` (export)

**Interfaces:**
- Consumes: `readSheets`-shaped rows (`ImportRow`), `validateImport`, `ImportContext`, `createTeacherAccount`, `ImportSetupReq/Res`.
- Produces: callable `importSetup` with `{ ...callOpts, timeoutSeconds: 300 }`.

Behaviour: `requireSchoolAdmin`; validate request shape (`subjects`/`teachers` arrays ≤ `IMPORT_MAX_ROWS`, each `{ row: int ≥2, cells: object of strings ≤ 500 chars }`; anything else → `invalid`). Load context fresh (`teachers` staffIds, `subjects` docs, `school.grades`, `school.staffPrefix`). `validateImport`; if errors → `fail('invalid-argument', 'invalid', 'Import has errors', { errors })`. Empty import (no rows) → `invalid`. Write all subjects in one batch with pre-allocated doc refs `{ nameEn, nameSi?, short, color }`. Then create teachers sequentially with concurrency 5 (map `subjectRefs` → ids). On first teacher failure stop starting new ones, wait for in-flight, return created plus `notCreated` staff IDs (subjects stay — document in a short comment that the import is all-or-nothing only up to the first account failure).

- [ ] **Step 1: Write failing emulator tests** (pattern: `teachers.test.ts`, helpers `adminWithSchool`, `expectFnError`, `signIn`):
  - imports 2 subjects + 2 teachers (one referencing a new subject by short, one primary); asserts subject docs, teacher docs with resolved `subjectIds`, member docs, claims, passwords match `/^[a-z2-9]{8}$/`-style alphabet regex used in teachers test, teacher can `signIn(syntheticEmail(staffId, sid), password)`.
  - auto staff IDs continue after existing teachers.
  - any error row → `invalid-argument` + `details.errors` contains the coded error, and no subjects/teachers written.
  - stale client: existing teacher `SCC040` created first, import with explicit `SCC040` → error `staffIdTaken`.
  - non-admin → `permission-denied`; 201 rows → `invalid-argument`.
  - Review Focus 5: pre-create an Auth user with `syntheticEmail('SCC045', sid)` via `adminAuth.createUser` (no teacher doc), import rows `SCC044`, `SCC045`, `SCC046` → result has teacher `SCC044` created, `notCreated` contains `SCC045` (and `SCC046` unless already in flight), no teacher doc for `SCC045`.
- [ ] **Step 2: Run:** `pnpm test:emulators` → new tests FAIL.
- [ ] **Step 3: Implement** `importSetup.ts`, register in `index.ts`.
- [ ] **Step 4: Run:** `pnpm test:emulators` → all PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(functions): add importSetup callable"`

### Task 5: App file reading and template generation

**Files:**
- Create: `apps/app/src/features/import/readFile.ts`, `readFile.test.ts`, `template.ts`, `template.test.ts`
- Modify: `apps/app/package.json` + `pnpm-lock.yaml` (add `read-excel-file`, `write-excel-file`)

**Interfaces:**
- Consumes: `RawSheet`, `parseCsv`, `IMPORT_COLUMNS`, `TEACHER_TITLES`.
- Produces:
  - `readImportFile(file: File): Promise<RawSheet[]>` — `.csv` (by extension or `text/csv`) → `[{ name: file.name, rows: parseCsv(await file.text()) }]`; `.xlsx` → every sheet via `read-excel-file`'s browser entry (dynamic `import()`); other extensions → throws `ImportFileError('unsupported')`; parse failure → `ImportFileError('unreadable')`. Read the installed package's README for the v9 API (sheet names + per-sheet read) rather than guessing.
  - `class ImportFileError extends Error { reason: 'unsupported' | 'unreadable' }`
  - `templateXlsx(opts: { staffPrefix: string; grades: number[]; instructions: { en: string[]; si: string[] } }): Promise<Blob>` — three sheets: "Subjects", "Teachers", "How to fill"; header row uses `` `${en} / ${si}` `` + `" *"` for required; How-to-fill lists the instructions (English then Sinhala), the valid titles, the school's grades, the staff ID example `formatStaffId(prefix, 1)`. Uses `write-excel-file` (dynamic import, browser entry).
  - `templateCsv(kind: ImportKind): string` — UTF-8 BOM + header row only (so Excel opens Sinhala correctly).
  - `downloadBlob(blob: Blob, filename: string): void` — object URL + temporary `<a download>`.
- [ ] **Step 1: Write failing tests:** `templateCsv('teachers')` starts with `﻿` and its header row parses (via `parseCsv` + `readSheets`) as a teachers sheet with zero errors; `readImportFile(new File(['Name (English) / ...\nDrama\n'], 'subjects.csv'))` returns one sheet with 2 rows; `.txt` rejects with `reason 'unsupported'`. Round trip: `readImportFile(new File([await templateXlsx(...)], 't.xlsx'))` → `readSheets` finds both kinds with no errors (if jsdom can't run the xlsx libs, run this test file with `// @vitest-environment node` and build the File from the Blob's ArrayBuffer).
- [ ] **Step 2: Run:** `pnpm --filter app test -- import/` → FAIL.
- [ ] **Step 3: Install deps** `pnpm --filter app add read-excel-file write-excel-file` and implement. Check `git diff package.json` has no `packageManager` field.
- [ ] **Step 4: Run:** `pnpm --filter app test -- import/ && pnpm --filter app typecheck && pnpm --filter app build` → PASS; build output shows the excel libs in separate chunks.
- [ ] **Step 5: Commit:** `git commit -m "feat(app): read import files and build templates"`

### Task 6: Import modal, page buttons, i18n, slips

**Files:**
- Create: `apps/app/src/features/import/ImportModal.tsx`, `ImportModal.test.tsx`, `apps/app/src/features/import/api.ts`
- Create: `packages/i18n/src/en/import.json`, `packages/i18n/src/si/import.json`
- Modify: `apps/app/src/features/teachers/TeachersPage.tsx`, `apps/app/src/features/subjects/SubjectsPage.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 5; `call('importSetup', …)`; `printSlips`, `usePrintLabels`, `teacherLoginUrl`, `useSessionPasswords().set`, `useSchool()`, `Modal`, `Button`, `Table`, `FormError`, `useToast`, `ApiError` from `lib/callable`.
- Produces: `ImportModal({ onClose }: { onClose: () => void })`; `importSetup(req: ImportSetupReq): Promise<ImportSetupRes>` in `import/api.ts`.

UI (desktop-first, match existing patterns):
- Header action "Import" (default variant, label `t('import:open')`) beside "+ Add" on both pages, header only, hidden when `readOnly`.
- Modal views: **start** — two download buttons ("Download Excel template", "CSV: Subjects", "CSV: Teachers") and a file input (`accept=".xlsx,.csv"`, labelled "Choose file"); short bilingual-friendly instructions. **preview** — after reading: `readSheets` + `validateImport` with context from `useSchool()`; if errors: table with columns Sheet · Row · Column · Problem (translated from `import:errors.<code>` with params; column name via `import:columns.<key>`), Import disabled; else summary `t('import:summary', { subjects, teachers })` ("12 subjects, 45 teachers to add") and a preview list of teacher staff IDs/names. Choosing another file replaces the preview. **importing** — `Button loading`. **done** — "Added N subjects and M teachers", `notCreated` warning if any (`FormError`), "Print login slips" (disabled when 0 teachers) and "Done". Stores every password with `setSessionPassword(teacherId, password)` so the existing Print-all flow knows them too.
- Server `invalid` with `details.errors` → show that table (server-found errors such as a staff ID taken meanwhile). Other failures → `FormError` with `import:failed`; school disabled → `shell:suspended.writeBlocked` like `TeacherModal`.
- i18n keys (en + si): `open, title, subtitle, downloadXlsx, downloadCsvSubjects, downloadCsvTeachers, chooseFile, reading, help, summary, nothing, errorsTitle, cols.{sheet,row,column,problem}, sheets.{subjects,teachers,file}, columns.<every ImportColumn>, errors.<every ImportErrorCode>, fileErrors.{unsupported,unreadable}, import, importing, doneTitle, doneBody, notCreated, printSlips, done, failed, instructions.{en,si}` (instructions arrays go into the template's How-to-fill sheet: both languages are written regardless of UI language).

- [ ] **Step 1: Write failing tests** in `ImportModal.test.tsx` (pattern: `TeachersPage.test.tsx` with `renderWithSchool`, mocking `../../lib/callable` `call` and `../teachers/printSlips`): upload a CSV `File` via `userEvent.upload` →
  - valid subjects CSV shows "1 subject, 0 teachers to add"-style summary and an enabled Import button; clicking calls `call('importSetup', { schoolId, subjects: [{ row: 2, cells: {...} }], teachers: [] })`.
  - teachers CSV with an unknown subject shows a row in the error table containing the row number and translated message; Import button disabled.
  - success with teachers → "Print login slips" calls `printSlips` with one slip per created teacher and their passwords.
  - server `ApiError` with `details.errors` renders the error table.
  - `TeachersPage`/`SubjectsPage`: "Import" button opens the dialog; hidden when read-only.
  - i18n: `packages/i18n/src/index.test.ts` already checks en/si key parity — confirm it covers the new namespace.
- [ ] **Step 2: Run:** `pnpm --filter app test -- import/ teachers/ subjects/` → FAIL.
- [ ] **Step 3: Implement** modal, api, buttons, both locale files (Sinhala copy natural, not transliterated).
- [ ] **Step 4: Run:** `pnpm test && pnpm -r typecheck` → PASS.
- [ ] **Step 5: Commit:** `git commit -m "feat(app): import teachers and subjects from a template"`

### Task 7: E2E spec

**Files:**
- Create: `e2e/specs/18-bulk-import.spec.ts`

**Interfaces:** Consumes the UI from Task 6 and seed data (`scripts/seed.ts`, school prefix `SCC`, `ADMIN`).

- [ ] **Step 1: Write the spec** (pattern `02-teacher-slip.spec.ts`): log in as admin → Teachers → "Import" → download the Excel template (`page.waitForEvent('download')`, assert filename ends `.xlsx`) → upload a teachers CSV with an error (unknown subject) via `setInputFiles({ name, mimeType: 'text/csv', buffer })` → error row visible, Import disabled → upload a corrected teachers CSV with 2 teachers (one blank staff ID) referencing seeded "Mathematics" → summary "2 teachers" → Import → done view → stub `window.open` print like spec 02 → "Print login slips" popup has 2 `article`s with 8-char passwords → Done → both rows visible in the Teachers table → log in as one imported teacher with the printed password lands on `/me`. Then Subjects page → Import a subjects CSV with one new subject → it appears in the table.
- [ ] **Step 2: Run:** `pnpm e2e -- 18-bulk-import` (or full `pnpm e2e`) → PASS; then run the full e2e suite to confirm later specs aren't affected by the extra teachers/subjects.
- [ ] **Step 3: Commit:** `git commit -m "test(e2e): bulk import flow"`
