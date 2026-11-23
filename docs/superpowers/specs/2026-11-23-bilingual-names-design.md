# Names in English, Sinhala or both — design

Approved by the owner on 2026-11-23 (canvas "Sathiya Screens": Teachers, Subjects, Register, Import boards).

## Why
Admins type a teacher's name in English only today. Switch the app to Sinhala and those names stay English, which looks wrong. Some schools work only in Sinhala and would rather type Sinhala names. Subjects and schools already have two name fields, but English is required.

## Rules
- School, subject, grade group and teacher: English name, Sinhala name, or both. At least one is required. Forms encourage both.
- Display: the name in the app's language; if empty, the other one. Everywhere: lists, timetables, print, login slips, emails, directory search.
- A teacher's title is stored separately and is formatted in the language of the name that is shown ("Mrs. N. Perera" / "එන්. පෙරේරා මහත්මිය"; a Sinhala-only name stays Sinhala on English screens, with a Sinhala title).
- Admin lists show a small tag when the current language's name is missing.
- Uniqueness checks (subjects) compare both names.

## Data (no migration)
- `Teacher.name` stays the English name (may be `''`); new optional `Teacher.nameSi`.
- `nameEn` on schools, subjects and groups may be `''` when `nameSi` is set.
- Old records are all valid as they are.

## Import
- Teachers sheet: "Full name" becomes "Name (English)" + "Name (Sinhala)"; one required. The old "Full name" header is still read as the English name.
- Subjects sheet: one of the two names required.
- Template's Subjects sheet is pre-filled with the standard subjects the school doesn't have yet (same list as "Load standard Sri Lankan list"). Rows left in the file are added.

## Approaches
1. **Chosen:** keep field names, allow empty English, add `Teacher.nameSi`. No migration, all display already goes through `pickName` / `teacherDisplayName`, so the fallback lives in two helpers.
2. Rename teacher `name` to `nameEn`/`nameSi` (`Bilingual`). Cleaner type, but needs a prod migration and touches every reader for no user-visible gain.

## Out of scope
Super admin's platform default subject list keeps English required.
