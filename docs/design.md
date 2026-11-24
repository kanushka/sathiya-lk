# Sathiya design

What Sathiya is for, and the decisions that shape the code. Feature specs live in GitHub issues labelled [`spec`](https://github.com/kanushka/sathiya-lk/issues?q=label%3Aspec); the original v1 spec is #47. Larger technical decisions go in [`adr/`](adr/).

## Intent

A free web app for Sri Lankan schools to build their yearly timetables. A school admin registers the school, sets up teachers, subjects, grades and bell schedules, then fills a weekly grid per class or per teacher. Teachers see their own timetable on their phone, with the current period highlighted.

### Goals
- Any school can self-register and start immediately.
- An admin can build a full year's timetable by hand, from the class view or the teacher view, with every change visible in both.
- The app prevents mistakes: clash detection, daily-limit warnings, per-subject period targets ("Maths 4/6").
- It handles how Sri Lankan schools work: primary class teachers, religion/aesthetic groups running in parallel, combined classes, A/L streams.
- Sinhala and English everywhere, for UI and data.
- Admin screens work on a phone as well as a desktop (#59).

### Non-goals
- Automatic timetable generation.
- Planned substitutions (relief is same-day only), rooms, students.

### Anti-goals
- Storing sensitive teacher ID data (NIC is never collected).
- An editor so clever it's hard to understand.

## Roles

| Role | Scope | Can |
|---|---|---|
| Super admin | Platform | List/disable schools, default subject list, terms versions, announcements, usage. |
| School admin | Per school | Setup, timetables, members, branding, publish, invite links, approve teachers. An admin can also be linked to a teacher record and get "My timetable". |
| Teacher | Per school | View published timetables. One account can belong to up to 15 schools, with a role in each. |

## Architecture

- Monorepo: `apps/web` (Astro static site), `apps/app` (React + Vite SPA), `functions` (Cloud Functions), shared domain logic in `packages`.
- Firebase only: Auth, Firestore, Hosting (two sites), Storage, Functions. Chosen over Next.js on App Hosting (server runtime and cost for no SSR benefit) and a single SPA (weak SEO for the public site).
- Privileged operations (creating teachers, saving entries, publishing) go through callable functions with App Check. Roles come from custom claims `{ schools: { [sid]: { r, t? } }, super? }`, rebuilt from `members` docs by `syncClaims` and used by security rules ([ADR 0001](adr/0001-self-signup-and-school-claims.md)).

## Key decisions

- **Accounts** are self-made: Google (recommended) or a verified email and password. Adding a teacher creates only the record. A teacher links their account through the school invite link (auto-link on a single email match, otherwise staff ID plus admin approval) or a 7-day one-use personal link. Admins can unlink.
- **Slot entry model**: `{ day, period, classIds[], lessons[{ subjectId, teacherId }], groupKey? }`. One shape covers normal lessons, parallel groups (one lesson per option) and combined classes.
- **Clash = clock-time overlap** on the same day, regardless of period number, for teachers and classes. Hard clashes are re-checked in a transaction inside `saveEntry`; soft issues (daily limit, over target, missing option teacher) are warnings on the dashboard.
- **Subject plans** belong to a grade; a class may have its own `planOverride` (A/L streams).
- **Years**: teachers, subjects, classes and templates belong to the school, not the year. Each year is draft → published. Publishing writes denormalized snapshots per class and per teacher, so old years stay correct after setup changes and the teacher view reads one doc.
- **Deletes** of anything the draft uses are blocked ("used in N slots"). Shrinking a template leaves orphaned entries listed under Needs attention.
- **Names**: schools, subjects, groups and teachers have an English name, a Sinhala name, or both. Display picks the app language and falls back to the other.
- **Branding**: each school's logo and colours drive its screens and printouts, with text colour chosen for contrast. The public site, login and super admin use Sathiya's own palette.
- **Relief days**: one dated doc per day (leaves and reliefs) overlays the published snapshots; the timetable itself never changes. Only the `saveReliefDay` callable writes it, re-checking availability against the published snapshots. Emails to relief teachers are debounced through a task queue ([ADR 0002](adr/0002-relief-days.md)).

## Constraints
- Keep Firestore reads low: load per school and year, no per-cell listeners.
- Accessibility: real buttons and inputs, 4.5:1 contrast, keyboard-usable grid.
