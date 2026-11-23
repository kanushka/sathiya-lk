# Bilingual names Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Every school, subject, group and teacher name can be English, Sinhala or both, and shows with fallback.

**Architecture:** Fallback lives in `pickName` and `teacherDisplayName` (`packages/core/src/names.ts`); callers that read `nameEn` directly switch to those helpers. Validation "at least one name" in core, functions and forms.

**Tech Stack:** TypeScript, React, Firebase Functions v2, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-23-bilingual-names-design.md`

## Global Constraints
- No data migration; existing docs stay valid.
- `Teacher.name` = English name, may be `''`; `Teacher.nameSi?: string`.
- Error copy: "Enter the name in English or Sinhala (or both)." / "ඉංග්‍රීසි හෝ සිංහල නම (හෝ දෙකම) ඇතුළත් කරන්න."

## Review Focus
- Sinhala-only teacher on an English screen: shows Sinhala name with Sinhala title, never blank.
- Sorting/search with empty `nameEn` (no crash on `localeCompare`, search matches Sinhala).
- Old import files with a "Full name" header still import.
- Subject short-name suggestion for a Sinhala-only subject is non-empty.
- Emails/print with Sinhala-only school name: subject line and header not blank.

---

### Task 1: Core name helpers
**Files:** `packages/core/src/names.ts`, `types.ts`, `names.test.ts`
- `pickName(x, lang)`: wanted language, else the other, else `''`.
- `hasName(x: Bilingual): boolean`; `nameKey(x)` for sorting = `pickName(x,'en')`.
- `Teacher.nameSi?: string`; `teacherDisplayName({name,nameSi,title}, lang)` chooses name by lang with fallback, formats title in the language used.
- `teacherHasName(t)`, `teacherMissing(t, lang)`.
- Tests: si-only on en, en-only on si, both, title placement.

### Task 2: Core consumers
**Files:** `publish.ts`, `usage.ts`, `directoryDoc.ts`, `subjectShort.ts`, `availability.ts`, `importSheet.ts`, `importValidate.ts`, `importFingerprint.ts` + tests
- Snapshots: subject/group/school names via `pickName`; teacher names via `teacherDisplayName`.
- Directory `nameLower` from first non-empty name.
- `suggestSubjectShort` fallback for non-Latin: first 4 chars of the name.
- Import: teacher columns `nameEn`, `nameSi` (alias "Full name" → `nameEn`); subjects either name; error key `nameMissing`.

### Task 3: Functions
**Files:** `createTeacher.ts`, `importSetup.ts`, `registerSchool.ts`, email templates, `lib/teacherAccount.ts` + tests
- Accept `nameSi`; require at least one name.
- Emails: school name via `pickName(school,'en')` for English text.

### Task 4: App
**Files:** teachers (modal, page, slips), subjects (page, modal, standard), register, profile, grades GroupModal/PlanEditor, superadmin lists, print, i18n, import template
- Two name fields, "at least one" error, "No Sinhala/English name" tag in Teachers list.
- Sorting via `pickName(…, lang)`.
- Template Subjects sheet pre-filled with `missingDefaults(subjects, standardList(platform))`.

### Task 5: Verify and PR
- `CI=true pnpm -r typecheck && pnpm -r test`, lint; PR.
