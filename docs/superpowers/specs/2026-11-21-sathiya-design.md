# Sathiya (සතිය) — Design

Date: 2026-11-21
Screens: https://claude.ai/artifact/Hba3wEy5peivzGi4rAxD96 (canvas of every view; source of truth for layout)

## 1. Intent

A free web app for Sri Lankan schools to build their yearly timetables. A school admin registers the school, sets up teachers, subjects, grades and bell schedules, then fills a weekly grid per class or per teacher. Teachers log in on their phone to see their own timetable and what they teach now.

Offered free as a contribution to the Sri Lankan school community. Charging may come later if load requires it.

### Goals
- Any school can self-register and start immediately.
- Admin can build a full year timetable by hand quickly, from either the class view or the teacher view, with every change visible in both.
- The app prevents mistakes: clash detection, daily-limit warnings, per-subject period targets ("Maths 4/6").
- Handles how SL schools really work: primary class teachers, religion/aesthetic groups running in parallel, combined classes.
- Sinhala and English everywhere.
- Teachers see their timetable on mobile with the current period highlighted.

### Non-goals (v1)
- Automatic timetable generation.
- Copying last year's timetable.
- Whole-school print view (only per class and per teacher).
- Email/SMS delivery of credentials, self-service teacher password reset.
- Substitutions / daily relief management, rooms, students.
- Mobile layout for admin screens (desktop only).

### Anti-goals
- Storing sensitive teacher ID data (NIC is never collected).
- An editor so clever it's hard to understand. Screens must stay simple.

## 2. Users and roles

| Role | Scope | Can |
|---|---|---|
| Super admin | Whole platform | List/disable schools, manage default subject list, T&C/Privacy versions, announcements, usage/limits, other super admins. |
| School admin | One school | Everything inside their school: setup, timetables, members, branding, publish. |
| Teacher (viewer) | One school | View own timetable (and, read-only, any class/teacher timetable of their school once published). Change own password. |

A person can be admin of one school in v1 (multi-school admins: builder may allow, not required).

## 3. Product decisions

### 3.1 School
- Fields: name (EN, SI), district, grades offered (e.g. 1–13), staff ID prefix (e.g. `SCC`), logo (PNG/SVG square ≤1 MB), primary colour, second colour.
- Branding drives all school-side screens (sidebar accent, buttons, teacher mobile header, printouts). Text colour on brand colours is chosen automatically for contrast.
- Public website, login and super admin use Sathiya's own palette (teal `#0E6B6A`, navy `#14213D`, saffron `#F2A541`).

### 3.2 Teachers
- Staff ID: school prefix + number, e.g. `SCC024`. Unique within the school.
- Name, subjects (list) **or** "Primary teacher" flag (can teach all subjects in their grades), grades (explicit list, e.g. 6, 7, 8, 10 — not a range), max periods per day, optional phone, optional email.
- Not stored: NIC.

### 3.3 Teacher login
- Login screen: school (searchable, remembered on device) → staff ID → password.
- On teacher creation the system generates a random 6-digit password, shown once on a **login slip** (school, staff ID, password, QR code to the login URL) that can be printed or shared via WhatsApp (share link/text). "Print all login slips" for bulk.
- Admin can reset → new random password + new slip.
- Teacher may change password after login.
- Implementation: Firebase Auth email/password with a synthetic email, e.g. `scc024@<schoolId>.sathiya.lk` (never shown). Creation and reset via Cloud Functions (Admin SDK).
- Later (not v1): Firebase email reset for teachers with email; optional SMS gateway for onboarding/reset only.

### 3.4 Admin login and registration
- Admin login: email/password or Google.
- Register school: 3 steps — (1) school details, (2) logo & colours with live preview, (3) admin account + accept Terms & Conditions and Privacy Policy (stored with accepted version + timestamp).
- Admins can invite more admins and add teachers (Members screen).

### 3.5 Subjects
- One school-wide list. Fields: English name, Sinhala name (optional, falls back to English), short name (fits in a grid cell), colour.
- "Load standard Sri Lankan list" seeds from the super-admin default list.
- Add/edit via popup modal.

### 3.6 Grades and classes
- Grades are configurable; each grade has classes (6A, 6B, …) that can be added/removed any time.
- Each class has: class teacher, period template.
- Each grade has a **subject plan**: list of entries with periods/week. An entry is either
  - a **normal subject** (e.g. Maths 6/week), or
  - a **group** (e.g. Religion 3/week) with options drawn from the school subject list (Buddhism, Catholicism, Islam). Options run at the same time.
- The same subject can be a group option in one grade and a normal subject in another (Buddhism: option in Gr 6–11, main in Gr 12–13).
- Grade screen shows total planned periods vs periods available in the week (e.g. 40/40).

### 3.7 Period templates
- School has a default template; others can be created (e.g. Short Friday, Primary).
- A template is an ordered list of rows: Period (start, end) or Interval (start, end).
- Mode: same every day, or different per day (Mon–Fri).
- Each class uses one template.

### 3.8 Timetable
- One timetable per academic year (e.g. 2027). States: **draft** → **published**. Teachers see only the published version. Admin keeps editing the draft and re-publishes.
- Teachers, subjects, grades, classes and templates belong to the school, not the year. Starting a new year = empty grid on current settings.
- Week = Mon–Fri.

#### Slot entry model
Every filled slot is an **entry**:
```
{ day, period, classIds[], lessons[{ subjectId, teacherId }], groupId? }
```
- Normal: 1 class, 1 lesson.
- Group: 1+ classes, one lesson per option (each with its own teacher). Counts as 1 period of that group for each class.
- Combined main subject (low staff): 2+ classes, 1 lesson.

#### Class view (by class)
- Grid Mon–Fri × periods of the class's template; interval row shown.
- Right column: slot picker (when a slot is selected) + subject progress list (placed/needed per subject, total placed/available).
- Slot picker: **Subject** = searchable dropdown; "Still needed for 6B" first with "needs N", then "Already complete". Then **Teacher** = search box (name or staff ID) + "Available" list (shows staff ID, load that day e.g. 4/7) + "Not available" list with reason (busy elsewhere with class/subject; daily limit reached; doesn't teach this grade/subject). Clicking Assign fills the slot.
- Picking a group subject opens the block editor (choose classes to join, teacher per option).
- "Fill empty with class teacher" (mainly grades 1–5): fills every empty slot with the class teacher; subject left as "class teacher period" for admin to refine, or assigned per remaining needs — builder's call, see §7.
- Print button.

#### Teacher view (by teacher)
- Grid for one teacher; per-day load bar (e.g. 5/6) under each day header.
- Slot click: **subject → class**. Classes listed only if in the teacher's grades, the subject is in that grade's plan, and the class is free in that slot.
- Group/combined cells marked (⧉ 6A+6B).
- Block editor: classes in the block (only same-grade classes free in that period can join), teacher per option with status (✓ free / ⚠ busy …), Remove block, Save.

#### Rules / validation (soft unless stated)
- **Hard**: a teacher cannot be in two entries in the same day+period. A class cannot be in two entries in the same day+period.
- **Soft warnings** (allowed but flagged on dashboard): teacher over max periods/day, subject over its weekly target, group option without teacher, teacher assigned outside their subjects/grades (only possible via override if builder adds one; default lists don't offer it).

#### Dashboard
- Year selector (draft/published), "Continue editing", "Publish to teachers".
- Stats: classes complete, empty slots, clashes, teachers over daily limit.
- Classes by grade with placed/needed chips (green complete / amber partial / grey empty).
- "Needs attention" list linking to the relevant view.

### 3.9 Print
- A4 landscape, one class or one teacher per page. School logo/name (EN + SI), class/teacher, year, class teacher. Grid with subject + teacher (class) or class + subject (teacher). Note line for groups. Printed date + "made with Sathiya".
- Implementation via browser print (print CSS); PDF export optional.

### 3.10 Teacher mobile
- Header in school colour with logo, teacher name + staff ID, language toggle.
- "Now" card: current period, time left, progress; "Next" line.
- Day tabs Mon–Fri; list of periods with interval; free periods shown dashed; past periods dimmed.
- Only this view (and teacher login) needs to be mobile-responsive.

### 3.11 Admin UI conventions
- Desktop-only for admin screens.
- Left sidebar with school logo + name, year selector, grouped nav (Dashboard · Timetable: By class, By teacher · Setup: Teachers, Subjects, Grades & classes, Period templates · School: Members, School profile & colours). **Collapsible** to a 72px icon rail; state remembered per user.
- Add/edit forms open as **centred popup modals**, not side panels.

### 3.12 Languages
- UI strings in translation files (en, si); per-user language preference; default from browser.
- Data with two names (school, subjects) shows the user's language with fallback.
- Font: Inter + Noto Sans Sinhala.

### 3.13 Public website
- Pages: Home (hero, features, how it works, free-for-SL message, CTA), Terms & Conditions, Privacy Policy, Contact. Sinhala and English.
- Links to app: Register school, Log in, Teacher login.

### 3.14 Super admin
- Schools list with search/filters (status, district), per-school counts and current-year progress, disable/enable.
- Default subject list (EN/SI/short/colour) used by "Load standard list".
- T&C and Privacy versions; schools must re-accept on a new version.
- Announcements (banner to school admins).
- Usage & limits (reads/writes per school; place for future plan limits).

## 4. Approaches considered

| Approach | Trade-off | Chosen? |
|---|---|---|
| **A. React + Vite SPA (app) + Astro static site (website), Firebase Hosting (2 sites), Firestore client SDK + Cloud Functions for privileged ops** | Two small apps; each simple. Website fast & SEO-friendly. | **Yes** |
| B. One Next.js app on Firebase App Hosting | One codebase but server runtime, cold starts, cost; app gains nothing from SSR. | No |
| C. One React SPA including the home page | Simplest, but weak SEO/first load for the marketing page. | No |

## 5. Technical decisions (made with the user)

- **Monorepo** (this repo `sathiya-lk`), apps: `apps/web` (Astro website), `apps/app` (React + Vite admin/teacher app), `functions` (Cloud Functions). Shared code (types, i18n strings, domain logic like clash checks) in packages.
- **Firebase project**: `sathiya-lk`. Auth, Firestore, Hosting (two sites), Storage (logos), Cloud Functions. **Blaze plan** accepted.
- Two Firebase web apps already registered:
  - website: appId `1:591171596099:web:f4363f68c921388b0489f6`, measurementId `G-Z7BE11T4C9`
  - webapp: appId `1:591171596099:web:6d617b8424ab69cd0489f6`, measurementId `G-DZ47PXT701`
  - shared: apiKey `AIzaSyAAV1VrII8O9l5UKfpybQijC5CRTss_rUE`, authDomain `sathiya-lk.firebaseapp.com`, projectId `sathiya-lk`, storageBucket `sathiya-lk.firebasestorage.app`, messagingSenderId `591171596099`.
  - These web configs are public identifiers, not secrets; security comes from Firestore/Storage rules and App Check.
- Domains: website `sathiya.lk`, app `app.sathiya.lk` (assumed; domain purchase/DNS is the user's).

### Data layout (Firestore)
```
schools/{schoolId}
  { nameEn, nameSi, district, grades, staffPrefix, logoUrl, colors{primary, second}, status, termsVersion, createdAt }
  members/{uid}          { role: 'admin'|'teacher', teacherId? }
  teachers/{teacherId}   { staffId, name, isPrimary, subjectIds[], grades[], maxPerDay, phone?, email?, uid, lastLoginAt }
  subjects/{subjectId}   { nameEn, nameSi, short, color }
  periodTemplates/{id}   { name, isDefault, mode: 'same'|'perDay', rows[{type:'period'|'interval', start, end}] | days{mon:[...],...} }
  grades/{gradeId}       { number, plan[{ subjectId | group{name, optionSubjectIds[]}, perWeek }] }
  classes/{classId}      { gradeId, name, classTeacherId, templateId }
  years/{yearId}         { label: '2027', status: 'draft'|'published', publishedAt }
    entries/{entryId}    { day, period, classIds[], lessons[{subjectId, teacherId}], teacherIds[], groupKey? }
    published/…          snapshot of entries at publish time (or a version field) — builder's call
platform/config, platform/defaultSubjects, platform/terms/{version}
```
- Whole year's entries (~1–2k docs) are loaded into memory in the editor; clash checks, filtering and counters run client-side. Writes are per entry (transaction/batch).
- Hard clash rules are also enforced server-side (Cloud Function on write or a transaction that checks a slot-lock doc) so two admins editing at once can't create a clash — builder's call on mechanism.
- Super admin via Firebase custom claim.
- Teachers' synthetic-email accounts created/reset only by Cloud Functions callable by school admins of that school.

## 6. Constraints
- Firebase only (Auth, Firestore, Hosting, Storage, Functions).
- Keep read costs low: load per school/year, avoid per-cell listeners across schools.
- Accessibility: real buttons/inputs, 4.5:1 contrast, keyboard usable grid.

## 6a. Decisions after builder review

User decisions:
- **Clash = clock-time overlap.** Two entries clash for a teacher or class when they're on the same day and their time windows overlap, regardless of period number. Teacher grid rows use the school default template; a class period is matched to the teacher row whose window it overlaps. A group/combined block may only join classes that use the same period template.
- **A/L streams = per-class plan override.** A class uses its grade's subject plan unless it has its own `planOverride` (same shape). Progress counters, "still needed" and teacher-view class filtering all use the effective plan.
- **Admin who teaches = one account.** An admin's membership can link to a teacher record (`teacherId`); they then also get "My timetable" (teacher mobile view) without a second login.

Builder calls (marked as such):
- **History:** publishing writes a denormalized snapshot per class and per teacher (`years/{y}/published/classes/{classId}`, `…/teachers/{teacherId}`) with names, short names, colours and clock times baked in. Old published years stay correct after setup changes. Teacher mobile reads one doc.
- **Deletes:** deleting a teacher, subject, class or template that the draft uses is blocked with a "used in N slots" message. Shrinking a template leaves entries beyond the last period as "orphaned", listed under Needs attention.
- **Admin invites:** admin adds an email on Members → stored as an invite; when that person signs in (Google or email) a function claims it and grants admin. Members screen shows a copyable app link to send by any channel.
- **Usage page:** v1 shows counts (teachers, classes, entries, last activity) per school, not Firestore read/write figures.
- **Active year:** the school has `activeYearId`, set on publish. Teachers see that year's published snapshot.
- **Auth claims:** Cloud Functions set custom claims `{ sid, role: 'admin'|'teacher', tid?, super? }`; security rules use them.
- **Teacher login school search:** public read-only `schoolDirectory/{schoolId}` with name EN/SI, district, status.
- **Hard clash enforcement:** entries are written only through callable `saveEntry` / `deleteEntry`, which re-check clashes inside a transaction.

## 7. Left to the builder
- Component library / styling approach, state management, routing, i18n library.
- Exact clash-enforcement mechanism server-side.
- How "published" is stored (snapshot vs version flag).
- "Fill empty with class teacher" exact behaviour for subjects (simplest: assign class teacher with the subject that still needs the most periods, repeat).
- Monorepo tooling (pnpm workspaces suggested), testing setup, CI, emulator setup.
- QR generation, print CSS details, WhatsApp share mechanism (wa.me link with prefilled text).
- Analytics usage (measurement IDs exist).
