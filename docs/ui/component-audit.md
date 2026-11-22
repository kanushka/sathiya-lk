# UI component audit (apps/app)

Date: 2026-11-22. Scope: `apps/app/src`. Paths are relative to `apps/app/src`.

Design for the unified set: "Sathiya Screens" canvas, boards **Components · unified set** and **Components · before → after**.

## 1. What `ui/` has today

| Component | Notes |
|---|---|
| `Button` | primary, secondary, danger, ghost, onBrand; sm h-8, md h-10, lg h-11 `rounded-[10px]`. Focus `outline-2 offset-2`. Danger uses hex `#E8C3C3`/`#FBEFEF` (`ui/Button.tsx:18`). |
| `Select` | Thin wrapper over native `<select>` (`ui/Select.tsx:14`). Browser menu. No `aria-invalid` style. |
| `Combobox` | Custom searchable listbox in a portal (`ui/Combobox.tsx`). Trigger h-11, `rounded-[10px]`, `border-[1.5px]` (`:179`) — differs from Select. Search input h-[38px] (`:224`). No disabled, error, required or label wiring. |
| `Field` + `inputClass` | Label, hint, error, `aria-describedby`, `aria-invalid`. Placeholder `#7A8194` (`ui/Field.tsx:18`, below 4.5:1 on white). |
| `Modal` | Portal, focus trap, Esc, stack. Close button its own icon-button copy (`ui/Modal.tsx:118`). Footer `#FAFAFB`. |
| `Toast` | Left-border stripe by kind. Close button another icon-button copy (`ui/Toast.tsx:85`). |
| `EmptyState`, `LoadingState`, `Table`, `Sidebar`, `AdminLayout`, `Icon` | Used consistently. `Sidebar.tsx:188` has its own native year `<select>` at h-[38px]. |

Missing: Checkbox, Radio, Switch, MultiSelect, Badge, Chip/Tag, Tabs, SegmentedControl, IconButton, Textarea, inline Alert. No `success`/`warning`/`surface` colour tokens; `danger` has no alpha support.

## 2. Native `<select>`

All single value. None multi.

| Where | Picks | Options | In modal |
|---|---|---|---|
| `ui/Sidebar.tsx:188` (raw) | Academic year | dynamic | no |
| `features/register/StepSchool.tsx:50` (raw, OS arrow) | School type | static | no |
| `features/register/StepSchool.tsx:130` (raw) | Grade from | 1–13 | no |
| `features/register/StepSchool.tsx:147` (raw) | Grade to | 1–13 | no |
| `features/grades/GroupModal.tsx:102` | Add subject option (add-to-list) | dynamic | yes |
| `features/grades/ClassCard.tsx:36` | Class teacher | dynamic | no |
| `features/grades/ClassCard.tsx:52` | Class template | dynamic | no |
| `features/grades/AddGradeModal.tsx:46` | Grade number | dynamic | yes |
| `features/grades/PlanEditor.tsx:124` | Add option subject (add-to-list) | dynamic | sometimes (`ClassPlanModal`) |
| `features/grades/PlanEditor.tsx:169` | Add subject to plan (add-to-list) | dynamic | sometimes |
| `features/superadmin/SchoolsPage.tsx:78` | Status filter | 3 | no |
| `features/superadmin/SchoolsPage.tsx:83` | District filter | 25 | no |
| `features/teachers/TeacherModal.tsx:186` | Title | static | yes |
| `features/dashboard/DashboardPage.tsx:75` | Academic year | dynamic | no |
| `features/members/InviteModal.tsx:65` | Teacher to link | dynamic | yes |
| `features/timetable/ClassViewPage.tsx:285` | Class jump (overrides text size via `[&_select]`) | dynamic | no |
| `features/timetable/BlockEditor.tsx:224` | Teacher per subject, `<optgroup>` | dynamic | yes |

Plan: all become `Select` (search appears when > 8 options). Add-to-list pickers (`GroupModal:102`, `PlanEditor:124,169`) become `MultiSelect`.

## 3. Checkbox / radio / hand-rolled pickers

Native inputs:

- `features/superadmin/AnnouncementsPage.tsx:68` — "Active", unstyled → Switch.
- `features/teachers/TeacherModal.tsx:201` — "Primary teacher", 16px `accent-[var(--brand)]` → Checkbox.
- `features/register/StepSchool.tsx:78` — "No census number", 16px, no accent → Checkbox.
- `features/register/StepAccount.tsx:75` — terms consent, 18px, no accent → Checkbox.
- `features/auth/ReportSchoolModal.tsx:96` — reason radios, unstyled → RadioGroup.

`aria-pressed` button pickers:

- `features/teachers/TeacherModal.tsx:137-140,218,238` — subjects and grades multi-pick chips (`rounded-md`, solid brand when on) → MultiSelect (subjects); grades see open question 1.
- `features/timetable/BlockEditor.tsx:176-195` — class toggle chips (`rounded-full`, tint when on) → ToggleChip (see open question 1).
- `features/register/ColorSwatches.tsx:46` — swatches (keep, unify ring).
- `features/timetable/SubjectProgress.tsx:65` — pin toggle icon button → IconButton `pressed`.

## 4. One-off copies of shared components

### Buttons

- Link-style: `features/grades/GradesPage.tsx:58`, `features/grades/PlanEditor.tsx:58`, `features/auth/LoginPage.tsx:33`, `features/auth/AdminLoginForm.tsx:121`, `features/register/StepSchool.tsx:33` → `Button variant="link"`.
- Copy of secondary sm: `features/superadmin/SchoolsPage.tsx:41`.
- Icon buttons: `features/timetable/ClassViewPage.tsx:276`, `features/timetable/TeacherViewPage.tsx:220` (`navBtn`, identical), `features/superadmin/AnnouncementBanner.tsx:26`, `ui/Modal.tsx:118`, `ui/Toast.tsx:85` → `IconButton`.
- Copies of onBrand / ghost sm: `features/teacher/TeacherFrame.tsx:89,120`.
- "×" remove buttons: `features/templates/TemplateEditor.tsx:108`, `features/grades/GroupModal.tsx:89`, `features/grades/PlanEditor.tsx:112` → Chip remove / IconButton.
- Dashed add button: `features/templates/TemplatesPage.tsx:67`.
- Option-row buttons in pickers (keep as feature UI, align radius/focus): `features/timetable/SlotPicker.tsx:142,235`, `TeacherSlotPicker.tsx:148`, `TeacherViewPage.tsx:347`, `AssignPicker.tsx:367`, `TimetableGrid.tsx:149`.

### Badges and chips

No Badge component; about 25 inline copies.

- Success `#E4F2E7/#1F6B34`: `TermsPage.tsx:116`, `StatusControl.tsx:19`, `TemplatesPage.tsx:160`, `SlotPicker.tsx:98`, `DashboardPage.tsx:20`.
- Warning `#FBF1DC/#7A5410`: `ClassCard.tsx:67`, `PlanEditor.tsx:104`, `BrandPreview.tsx:35`, `TodayPage.tsx:178`, `DashboardPage.tsx:21`, `TeachersPage.tsx:108` (`rounded-md`).
- Danger: `StatusControl.tsx:20` (`#F6E3E3`), `PinBar.tsx:46` (`#FDECEA/#9A3412`).
- Neutral `#F1F2F5`: `TeachersPage.tsx:64,113`, `DashboardPage.tsx:22`.
- Brand tint: `SlotPicker.tsx:152,253`, `TeacherSlotPicker.tsx:160`, `AssignPicker.tsx:277`.
- Amber variant `#FBEAC9/#7A5A12`: `BlockEditor.tsx:211`.
- Removable chips: `GroupModal.tsx:87`, `PlanEditor.tsx:109`.

### Tabs / segmented

- `features/auth/AuthChrome.tsx:20-30` language toggle, active navy, border `#D9DCE3`.
- `features/templates/TemplateEditor.tsx:41-54` same/per-day, active ink.
- `features/templates/TemplateEditor.tsx:62-77` day tabs, active brand tint.
- `features/teacher/TodayPage.tsx:40-54` weekday picker, active solid brand, h-11.
- `features/teacher/TeacherFrame.tsx:57-65` tab bar of links on brand.
- `features/grades/GradesPage.tsx:65-78` vertical rail.

→ `Tabs` and `SegmentedControl`. Mobile teacher views (`TodayPage`, `TeacherFrame`) only swap components; layout stays.

### Alerts / errors

- About 14 hand-rolled `<p role="alert" class="text-danger">`: `ActionShell.tsx:30`, `ReportSchoolModal.tsx:109`, `TeacherModal.tsx:158,229,249`, `NewTemplateModal.tsx:43`, `SubjectModal.tsx:55`, `ChangePasswordModal.tsx:77`, `StepAccount.tsx:92`, `DeleteSetupModal.tsx:51,58`, `GroupModal.tsx:117`, `LogoUpload.tsx:85`, `LoginSlip.tsx:93`, `ColorSwatches.tsx:78`, `TemplatesPage.tsx:182`. Split between `text-sm` and `text-xs`.
- Red banners: `ProfilePage.tsx:131`, `TemplatesPage.tsx:45`.
→ `Alert` (banner) and `FormError` (inline).

### Custom listboxes outside `ui/`

- `features/auth/SchoolSearch.tsx:84-135` — async combobox, own popover (`rounded-[10px]`, absolute, not portal).
- `features/timetable/AssignPicker.tsx:322-345,379-396` — inline searchable lists, own `inputClass` at `:62` (h-[42px], `rounded-[10px]`).
- `features/timetable/SlotPicker.tsx:215-225` — search input h-10 `rounded-[10px]`.

These are in-modal list pickers rather than dropdowns; they keep their layout and adopt the shared input and option row styles. `SchoolSearch` adopts the shared menu styling.

### Fine as is

- Tables: every `<table>` uses `ui/Table`.
- Modals: every dialog uses `ui/Modal`.
- Empty states: `EmptyState` is used for full-page empties. Small inline "nothing here" hints (`GradesPage.tsx:101`, `PlanEditor.tsx:90`, `DashboardPage.tsx:116,137`, `MembersPage.tsx:83`) stay as text.

## 5. Colours

- About 100 lines outside `ui/` use arbitrary hex classes.
- Seven reds, none equal to `--danger #A3262A`: `#B4441C` (`DashboardPage.tsx:56,144`, `TeachersPage.tsx:122`, `TeacherViewPage.tsx:199`), `#B3261E` (`SubjectProgress.tsx:57`), `#9A3412`/`#C2410C`/`#FDECEA` (`ClassViewPage.tsx:85,351`, `PinBar.tsx:46`), `#E8C3C3`/`#FBEFEF` (`ProfilePage.tsx:131`, `TemplatesPage.tsx:45`, `ui/Button.tsx:18`), `#F6E3E3` (`StatusControl.tsx:20`).
- Three browns: `#7A5410`, `#7A5A12` (`BlockEditor.tsx:211`), `#6B4A0E`.
- Success greens hard-coded in about 20 places (`#1F6B34`, `#E4F2E7`, `#2E8B4A`, `#F5FBF6`, `#CFE6D4`, `#EAF6ED`).
- Six neutral surfaces: `#FAFAFB`, `#F1F2F5`, `#F6F7F9`, `#F6F6F4`, `#EEF0F3`, `#F0F1F4`.
- Grey text/borders: `#8A91A3`, `#6B7385`, `#7A8194`, `#C9CDD6`, `#D3D6DD`, `#D9DCE3`.
- `text-teal`/`bg-teal` ignore the school brand: `ActionShell.tsx:17`, `ReportsPage.tsx:73,86`, `SchoolDetail.tsx:49`, `SchoolsPage.tsx:76` (`focus:ring-teal`), register flow. Register and auth are pre-brand, so teal stays there; `SchoolsPage`'s ring becomes brand.
- Only raw Tailwind palette: `slate-50` (19×) and `slate-100` (3×).

Plan: add tokens `success`, `warning`, `danger` (each with `soft` bg and `line` border, alpha-capable), `surface` (`#FAFAFB`) and `surface-2` (`#F1F2F5`), and use them instead of the hex. Print code (`print/*`, `printSlips.ts`) keeps inline hex. Subject palette (`subjects/palette.ts`) is data and stays.

## 6. Design differences

| | Today | Unified |
|---|---|---|
| Control height | h-8, h-9, h-10, h-[38px], h-[42px], h-11 | sm 32, md 40 (default), lg 44 |
| Control radius | `rounded-lg`, `rounded-[10px]` (27×), `rounded-md`, `rounded-xl` | controls 8px, menus/cards 12px, modal 18px |
| Border | 1px, 1.5px (Combobox, LogoUpload, TemplatesPage, ClassViewPage, AssignPicker, TimetableGrid), 2px | 1px `line-strong` for controls |
| Focus | field ring `ring-2 brand/30`; button outline offset 2 / 1 / 0; teal ring; none on most hand-rolled buttons, checkboxes, chips | fields: brand border + 3px brand/28 ring; buttons/chips/toggles: 2px brand ring with 2px white gap |
| Disabled | opacity 40 / 50 / 60; `bg-slate-50`; some none | buttons 45% opacity + not-allowed; fields `#F4F5F7` bg, muted text |
| Error | border only on inputs; none on Select; ring-2 on template rows; text sm vs xs | red border (+ red ring on focus) on every field kind; one `FormError` style (12px, medium) |
| Section label | 6 variants of uppercase 11px label | one `.cap` style: 11px bold, `.06em` |
| Placeholder | `#7A8194` | `#5A6378` (ink-muted, passes 4.5:1) |
| Toast | coloured left stripe | status icon tile |

## 7. Native date/time

`features/templates/TemplateEditor.tsx:90,99` (`type="time"`, h-[38px], 15px). Keep native; give them `inputClass` (h-10, 14px). No date inputs exist.

## 8. Open questions

1. Grades (1–13) in `TeacherModal` and classes in `BlockEditor` are quick toggle chips today. Proposed: keep them as a shared `ToggleChip` group (fast one-click, all visible) and use `MultiSelect` for long lists (subjects, add-to-list pickers). Or move everything to `MultiSelect`?
2. Toast drops the left stripe for an icon. OK?
3. Danger button stays outlined; solid red only for the final confirm in a delete modal. OK?
