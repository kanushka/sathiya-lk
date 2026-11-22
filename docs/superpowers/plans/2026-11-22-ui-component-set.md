# UI component set — implementation plan

Spec: the approved "Components · unified set" and "Components · before → after" boards on the Sathiya Screens canvas, plus `docs/ui/component-audit.md` (read it: every file:line to migrate is listed there). Branch `feat/ui-component-set`. App: `apps/app` (React 18, Vite, Tailwind 3, i18next, vitest + Testing Library + user-event).

## Global Constraints

- Every new source file starts with the two-line AGPL header used everywhere (`// SPDX-License-Identifier: AGPL-3.0-or-later` / `// Copyright (C) 2026 Kanushka Gayan`). `pnpm check:license` must pass.
- No code comments except a non-obvious why. No docstrings.
- Commits: one line, `type(scope): description`. No Co-Authored-By, no AI attribution, no trailers. Commit with normal gpg signing; never `--no-gpg-sign`.
- Design tokens (exact):
  - Control heights: sm 32px (`h-8`), md 40px (`h-10`, default), lg 44px (`h-11`).
  - Radius: controls 8px (`rounded-lg`), menus/popovers/cards 12px (`rounded-xl`), modal 18px (unchanged).
  - Control border: 1px `border-line-strong`; hover `border-line-hover` (`#9AA1B2`).
  - Field focus (inputs, Select/MultiSelect/Combobox triggers, textarea): `border-brand` + 3px ring brand at 28–30% (`ring-[3px] ring-brand/30`), no outline.
  - Button/chip/toggle/tab focus: `focus-visible:ring-2 ring-brand ring-offset-2` (white gap), no outline.
  - Error: `border-danger`; on focus ring `ring-danger/20`. Inline field error text: `text-xs font-medium text-danger` (Field). Form-level error: `FormError` (`text-sm font-medium text-danger`, `role="alert"`).
  - Disabled fields: `bg-surface-2` (`#F4F5F7`), `border-line`, `text-ink-muted`, `cursor-not-allowed`. Disabled buttons: `opacity-45`, `cursor-not-allowed`.
  - Placeholder colour: `text-ink-muted` (`#5A6378`), replacing `#7A8194`.
  - Menu panel: `rounded-xl border border-line-strong bg-white p-1.5 shadow-[0_14px_30px_-18px_rgba(20,33,61,.45)]`. Option row: `rounded-lg px-2.5 py-2 text-sm`; active row `bg-brand/10`; selected row `font-semibold` + brand check icon on the right (single) or a checked box on the left (multi); disabled row `text-ink-muted cursor-not-allowed`. Group heading: `text-[11px] font-bold uppercase tracking-[.06em] text-ink-muted`.
- New Tailwind colour tokens in `apps/app/tailwind.config.ts` (keep existing ones): `success` `#1F6B34`, `success-soft` `#E4F2E7`, `success-line` `#CFE6D4`; `warning` `#7A5410`, `warning-soft` `#FBF1DC`, `warning-line` `#F0DDB0`; `danger` becomes alpha-capable (`color-mix(in srgb, var(--danger) calc(<alpha-value> * 100%), transparent)`), plus `danger-soft` `#FBEFEF`, `danger-line` `#E8C3C3`; `surface` `#FAFAFB`, `surface-2` `#F4F5F7`, `surface-3` `#F1F2F5`; `line.hover` `#9AA1B2`.
- `Combobox` and `Modal` public APIs stay backward compatible (new props optional only). Other ui components may change API if every caller is migrated in the same task.
- Inside `apps/app/src/features/timetable/` only swap components and classes for shared ones; no behaviour or layout changes (another branch is building Pin mode there).
- Mobile teacher views (`features/teacher/*`): swap components only; layout unchanged.
- Native `type="time"` inputs stay native (only their classes unify to `inputClass`).
- Register and auth screens keep fixed Sathiya `teal` (no school brand yet). Everywhere else use `brand`.
- All user-visible strings via i18next, en and si (`packages/i18n/src/{en,si}/*.json`). New generic strings go in `shell.json`.
- Tests prefer role-based queries. Run `pnpm --filter app test` and `pnpm --filter app typecheck` before each commit.
- Behaviour of every feature stays the same.

## Decisions on design open questions

1. Short fixed sets that are one-click toggles today (grades 1–13 in TeacherModal, classes in BlockEditor) use a shared `ToggleChip`; long or add-to-list picks use `MultiSelect`.
2. Toast drops the coloured left stripe for a small round status icon (success check on `success-soft`, info "i" on `surface-3`/navy, error "!" on `danger-soft`).
3. `danger` button stays outlined; new `dangerSolid` only for a final destructive confirm.

---

### Task 1: Tokens, field styles, Button, IconButton, FormError, Alert, Toast

Files: `apps/app/tailwind.config.ts`, `apps/app/src/ui/Field.tsx`, `ui/Button.tsx`, new `ui/IconButton.tsx`, new `ui/FormError.tsx`, new `ui/Alert.tsx`, `ui/Toast.tsx`, `ui/Modal.tsx` (close button only), tests next to each.

- Add the colour tokens from Global Constraints.
- `Field.tsx`: update `inputClass` to the field tokens (h-10, rounded-lg, border-line-strong, hover:border-line-hover, placeholder:text-ink-muted, focus ring 3px brand/30 + border-brand + outline-none, `aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/20`, disabled tokens). Export `textareaClass` (inputClass minus fixed height: `h-auto min-h-[88px] py-2.5 leading-relaxed resize-y`). Export `fieldFocusClass` and `fieldBaseClass` pieces so Select/MultiSelect/Combobox triggers share them. Field API unchanged.
- `Button.tsx`: variants `primary | secondary | ghost | danger | dangerSolid | onBrand | link`. `danger` uses `border-danger-line text-danger hover:bg-danger-soft`. `dangerSolid` `bg-danger text-white hover:bg-danger/90`. `link`: no height/padding/border, `text-brand font-semibold hover:underline`, size ignored, `rounded` focus ring. lg = `h-11 px-5 text-[15px] rounded-lg`. Focus: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2`. Disabled `disabled:opacity-45 disabled:cursor-not-allowed`. Keep `forwardRef`, default `secondary`/`md`.
- `IconButton.tsx`: `{ icon: IconName; label: string; variant?: 'ghost'|'secondary'|'onBrand'|'danger'; size?: 'sm'|'md'; pressed?: boolean } & ButtonHTMLAttributes` → square Button (`w-8`/`w-10`, `px-0`), `aria-label={label}`, `title={label}`, `aria-pressed` when `pressed` is defined. Icon size 16 (sm) / 18 (md). forwardRef.
- `FormError.tsx`: `<FormError>{children}</FormError>` → `<p role="alert" className="text-sm font-medium text-danger">`; renders nothing when children empty; accepts `className`.
- `Alert.tsx`: `{ tone: 'danger'|'warning'|'success'|'info'; children; role? }` → `rounded-lg border px-4 py-3 text-sm font-semibold` with tone tokens (danger: `border-danger-line bg-danger-soft text-danger`; warning: `border-warning-line bg-warning-soft text-warning`; success: `border-success-line bg-success-soft text-success`; info: `border-line bg-surface text-ink`). Default role `alert` for danger, `status` otherwise.
- `Toast.tsx`: same API; restyle per decision 2; close button becomes `IconButton size="sm" variant="ghost"`; border `border-line`, `rounded-xl`.
- `Modal.tsx`: close button becomes `IconButton` (`variant="ghost"`, md, `bg-surface-3 hover:bg-line` via className). Footer `bg-surface`. No other change.
- Tests: Button variants/link/disabled; IconButton aria-label + aria-pressed; FormError renders nothing when empty; Alert roles; existing Modal/Toast tests still pass.

### Task 2: Shared listbox internals and the new `Select`

Files: new `ui/listbox/usePopover.ts`, `ui/listbox/useTypeahead.ts`, `ui/listbox/MenuPanel.tsx` (panel + option row + group heading + empty text), new `ui/Select.tsx` (replaces the native one), move the old native wrapper to `ui/NativeSelect.tsx` and point every existing import at it (mechanical rename only; Task 5 deletes it), i18n keys, tests `ui/Select.test.tsx`.

- `usePopover(triggerRef, popRef, open, deps)`: the positioning logic now in `Combobox.tsx` (portal, `position: fixed`, `placePopover`, reposition on scroll/resize except scroll inside the popover, list max height 288px), plus outside-mousedown close callback. Returns `{ pos, listMax }`.
- `useTypeahead(labels, onMatch)`: buffer printable keys, reset after 500ms, match by case-insensitive `startsWith` starting after the current index, wrap around; skip disabled.
- Select API:
  ```ts
  export interface SelectOption<V extends string = string> { value: V; label: string; disabled?: boolean; group?: string; hint?: string }
  export interface SelectProps<V extends string = string> {
    options: SelectOption<V>[]; value: V | '' | undefined; onChange: (value: V) => void;
    placeholder?: string; searchable?: boolean; searchPlaceholder?: string;
    id?: string; name?: string; disabled?: boolean; required?: boolean;
    'aria-invalid'?: boolean; 'aria-describedby'?: string; 'aria-label'?: string; 'aria-labelledby'?: string;
    size?: 'sm' | 'md'; className?: string;
    renderOption?: (o: SelectOption<V>, state: { active: boolean; selected: boolean }) => ReactNode;
  }
  ```
- Trigger: `<button type="button" role="combobox" aria-haspopup="listbox" aria-expanded aria-controls={open ? listId : undefined} aria-activedescendant={open && !searchable ? activeId : undefined}>`; shows selected label or placeholder (default `t('select.placeholder')` = "Choose…" / "තෝරන්න…"); chevron icon; field tokens; `aria-invalid` → danger border. Works inside `Field` (Field clones `id`, `aria-describedby`, `aria-invalid` onto it, and `<label htmlFor>` names the combobox). When `name` is set, render `<input type="hidden" name value>`.
- `searchable` defaults to `options.length > 8`. Searchable: panel shows a search input (focused on open, `role="combobox"` with `aria-activedescendant`, `aria-label` = searchPlaceholder, default `t('search')`), filters by label substring; "No matches" (`t('noMatches')`) when empty.
- Groups: options with `group` render under group headings in first-appearance order (`role="group"` + `aria-label`).
- Keyboard. Closed trigger: ArrowDown/ArrowUp/Enter/Space open with the selected option active (or first enabled); printable key opens (non-searchable) and typeahead-jumps. Open: ArrowUp/Down move (skip disabled, no wrap), Home/End, typeahead (non-searchable only), Enter picks, Space picks (non-searchable only), Escape closes and refocuses trigger and `stopPropagation` so an enclosing Modal stays open, Tab closes. IME composition guard on Enter (`ui/composing.ts`). Picking calls `onChange` only if value differs, closes, refocuses trigger. Clicking a disabled option does nothing.
- Listbox `role="listbox"` `aria-labelledby` the trigger's label (or `aria-label`); options `role="option"` `aria-selected` `aria-disabled`, ids `${baseId}-opt-${value}`; active option scrolled into view.
- Disabled: trigger `disabled`, never opens.
- i18n `shell.json` en/si: `select.placeholder`.
- Tests (role-based): opens on click and on ArrowDown; arrows/Home/End/typeahead; Enter and Space pick; disabled option skipped and unclickable; Escape inside a `Modal` closes only the menu; search appears above 8 options and filters, "No matches"; `Field` label names the combobox and error sets `aria-invalid`; hidden input when `name`; groups rendered.

### Task 3: `MultiSelect` and `Combobox` on the shared internals

Files: new `ui/MultiSelect.tsx` + test, `ui/Combobox.tsx` (refactor + restyle), `ui/Combobox.test.tsx` (keep all existing tests passing; add new ones), i18n.

- MultiSelect API: `{ options: SelectOption<V>[]; value: V[]; onChange(next: V[]): void; placeholder?; searchable? (default > 8); searchPlaceholder?; maxChips? (default 3); selectAll? (default true); id; name; disabled; required; 'aria-invalid'; 'aria-describedby'; 'aria-label'; 'aria-labelledby'; className }`.
- Trigger: a field-styled wrapper `div` (min-h-10, `py-1 pl-1.5 pr-2.5`, flex, no wrap) containing chips for the first `maxChips` selected (in options order), a `+N` chip for the rest, and a `role="combobox"` button (flex-1, placeholder text when empty, `aria-haspopup="listbox"`, `aria-expanded`, `aria-controls`). Clicking anywhere on the wrapper toggles the menu. Each chip has a remove button (`tabIndex={-1}`, `aria-label` = `t('multi.remove', { label })`) that removes the value without opening the menu. Backspace on the closed combobox removes the last selected value. Wrapper focus-within shows the field focus ring.
- Menu: optional search (same rules as Select), header row with `t('multi.count', { count, total })` and `Select all` / `Clear` link buttons (Select all adds every enabled, filtered option; Clear removes all), listbox `aria-multiselectable="true"`, options with an 18px checkbox visual on the left (on = `bg-brand border-brand text-on-brand` check icon), `aria-selected`. Menu stays open while toggling.
- Keyboard: same navigation as Select; Space and Enter toggle the active option (Enter does not close); Escape closes (stopPropagation); Tab closes; Ctrl/Cmd+A selects all.
- When `name` is set, render one hidden input per value.
- Combobox: keep its exact props and behaviour; add optional `disabled`, `'aria-invalid'`, `'aria-describedby'`, `'aria-labelledby'`, `className`. Rebuild on `usePopover` and `MenuPanel`. Trigger restyled to the shared field trigger (h-10, rounded-lg, 1px border, field focus ring, `aria-invalid` danger border). Keep trigger as `button` with `aria-haspopup="listbox"` (existing tests query `getByRole('button', ...)`). Search input h-9 rounded-lg.
- i18n `shell.json` en/si: `multi.count` ("{{count}} of {{total}} selected" / "{{total}} න් {{count}} ක් තෝරා ඇත"), `multi.selectAll` ("Select all" / "සියල්ල තෝරන්න"), `multi.clear` ("Clear" / "ඉවත් කරන්න"), `multi.remove` ("Remove {{label}}" / "{{label}} ඉවත් කරන්න"), `multi.more` ("+{{count}}").
- Tests: chips + overflow; remove chip; toggle with Space/Enter keeps menu open; select all / clear; search; Escape in Modal; `aria-multiselectable`; Combobox new props.

### Task 4: Checkbox, RadioGroup, Switch, Badge, Chip, ToggleChip, Tabs, SegmentedControl

Files: new `ui/Checkbox.tsx`, `ui/RadioGroup.tsx`, `ui/Switch.tsx`, `ui/Badge.tsx`, `ui/Chip.tsx` (Chip + ToggleChip), `ui/Tabs.tsx`, `ui/SegmentedControl.tsx`, tests for each.

- `Checkbox`: `{ checked; onChange(checked: boolean); label: ReactNode; hint?; indeterminate?; disabled?; id?; name?; 'aria-invalid'?; className? }`. Native `<input type="checkbox">` visually hidden (`peer sr-only`) inside a `<label>` with an 18px box (`rounded-[5px] border-[1.5px] border-[#9AA1B2]`; checked/indeterminate `bg-brand border-brand text-on-brand` with check / minus icon; `peer-focus-visible` brand 3px ring; disabled `bg-surface-2 border-line`, label `text-ink-muted`; invalid `border-danger`). Label text `text-sm text-ink`, gap 10px. `getByRole('checkbox', { name })` and `.check()` keep working.
- `RadioGroup<V>`: `{ name; label?: ReactNode (renders fieldset legend); options: { value: V; label: ReactNode; disabled? }[]; value; onChange(v: V); 'aria-invalid'?; className? }`. Native radios visually hidden; 18px circle, checked = 5.5px brand border; same focus/disabled treatment.
- `Switch`: `{ checked; onChange(checked); label: ReactNode; disabled?; id? }` → `<button type="button" role="switch" aria-checked>` with a 36×20 track (off `bg-[#C9CDD6]`, on `bg-brand`) and 16px white thumb, label text beside it in the same button.
- `Badge`: `{ tone?: 'neutral'|'brand'|'success'|'warning'|'danger'; dot?: boolean; children; className? }` → `inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold`; tones: neutral `bg-surface-3 text-ink-soft`, brand `bg-brand/10 text-brand`, success `bg-success-soft text-success`, warning `bg-warning-soft text-warning`, danger `bg-danger-soft text-danger`; `dot` adds a 6px currentColor dot.
- `Chip`: `{ children; onRemove?; removeLabel?; color?: string (background override, e.g. subject colour); className? }` → `inline-flex h-[26px] items-center gap-0.5 rounded-md bg-brand/10 pl-2 pr-0.5 text-[13px] font-semibold text-ink` (no remove: `pr-2`); remove is a 20px ghost icon button with `aria-label={removeLabel}`.
- `ToggleChip`: `{ pressed; onToggle(); children; disabled?; className? }` → `<button aria-pressed>` `h-8 rounded-lg border px-3 text-[13px] font-semibold`; on `border-brand bg-brand/10 text-brand`; off `border-line-strong bg-white text-ink-soft hover:bg-surface`; button focus ring; disabled tokens.
- `Tabs<V>`: `{ items: { value: V; label: ReactNode }[]; value; onChange(v); 'aria-label' }` → `role="tablist"` with `role="tab"` buttons (`aria-selected`, roving `tabIndex`, ArrowLeft/Right/Home/End move and select), underline style (`h-10 px-3 text-sm font-semibold text-ink-muted`, selected `text-ink` with 2px brand bar).
- `SegmentedControl<V>`: `{ options: { value: V; label: ReactNode }[]; value; onChange(v); 'aria-label'; size?: 'sm'|'md'; tone?: 'default'|'onBrand'; className? }` → `role="radiogroup"` track `rounded-[10px] bg-surface-3 p-[3px]`, buttons `role="radio" aria-checked` (`h-8` md / `h-7` sm, `rounded-[7px] px-3.5 text-[13px] font-semibold text-ink-soft`; checked `bg-white text-ink shadow-[0_1px_3px_rgba(20,33,61,.18)]`), roving tabIndex + arrow keys. `tone="onBrand"`: track `bg-black/15`, unchecked `text-on-brand`, checked white/ink.
- Tests: role, name, keyboard, disabled for each.

### Task 5: Replace every select (and the native wrapper)

Files: every caller of `ui/NativeSelect`, raw `<select>` in `ui/Sidebar.tsx:188` and `features/register/StepSchool.tsx:50,130,147`, their unit tests, e2e specs, `e2e/helpers.ts`. Delete `ui/NativeSelect.tsx`.

- Single-value pickers → `Select` with `options`. Keep the same visible labels, option order, empty/"none" option (as an option with value `''`… use a real sentinel option such as `{ value: '', label: t('…none') }` only where the feature had a "none" option; Select's `value` accepts `''`).
- Option-subject pickers that today are "select to add" + a list of removable chips (`grades/GroupModal.tsx:87-102` and `grades/PlanEditor.tsx:109-124`) → one `MultiSelect` whose value is the current option-subject list (adding and removing through it does exactly what the select + chip × did; keep any ordering rule the feature applies; keep the visible label). Remove the hand-rolled chip list they replace.
- `grades/PlanEditor.tsx:169` (add a subject row to the plan; rows carry period counts) stays a single `Select` add-picker that resets after each pick (behaviour unchanged).
- `timetable/BlockEditor.tsx:224`: `<optgroup>` becomes `group` on options; same option labels. Only swap the component.
- `timetable/ClassViewPage.tsx:285`: drop the `[&_select]` override; pass `size`/className only.
- `ui/Sidebar.tsx` year switcher → `Select` (sm or md as fits the sidebar; same labels, aria name "Timetable year").
- `register/StepSchool.tsx`: three raw selects → `Select` inside their existing `Field`s.
- Unit tests: replace `user.selectOptions(...)` with a shared helper `apps/app/src/test/pickOption.ts`: `pickOption(user, combobox: HTMLElement, label: string | RegExp)` (click trigger, click `role="option"` by name). Replace `toHaveValue` on selects with `toHaveTextContent` on the combobox.
- e2e: add `pick(scope: Page | Locator, name: string | RegExp, option: string | RegExp)` to `e2e/helpers.ts` (click `getByRole('combobox', { name })`, then `page.getByRole('option', { name: option, exact? })` — options render in a portal under `body`, so look them up on the page). Update `02-teacher-slip`, `03-setup`, `04-class-view`, `05-teacher-view-block`, `06-publish`, `10-pin-mode`, `01-register` (`toHaveValue('government')` → text check). Do not run e2e here (controller runs it); make the edits carefully.

### Task 6: Replace checkbox/radio/toggles/chips/tabs/segmented, buttons and errors

Files (from the audit, sections 3 and 4): `superadmin/AnnouncementsPage.tsx:68` (Switch), `teachers/TeacherModal.tsx:137-140,199-201,218,238` (Checkbox for primary; subjects → `MultiSelect`; grades → `ToggleChip`), `register/StepSchool.tsx:78` and `register/StepAccount.tsx:75` (Checkbox; keep teal: pass `className` if needed — Checkbox uses `brand`, and the register screens set `--brand` to teal already? check `RegisterPage`; if not, leave brand), `auth/ReportSchoolModal.tsx:96` (RadioGroup), `timetable/BlockEditor.tsx:176-195` (ToggleChip, swap only), `auth/AuthChrome.tsx:20-30` + `teacher/TeacherFrame.tsx:57-65` (SegmentedControl; TeacherFrame tabs are router Links — keep Links, only align classes if SegmentedControl cannot host links), `templates/TemplateEditor.tsx:41-54` (SegmentedControl) and `:62-77` (Tabs), `teacher/TodayPage.tsx:40-54` (weekday picker: keep layout, use SegmentedControl only if layout is identical; otherwise align focus ring + tokens only), link buttons (`GradesPage.tsx:58`, `PlanEditor.tsx:58`, `LoginPage.tsx:33`, `AdminLoginForm.tsx:121`, `StepSchool.tsx:33` → `Button variant="link"`), `SchoolsPage.tsx:41` linkBtn → Button secondary sm classes (it's a router Link: export `buttonClass(variant, size)` from Button.tsx and use it), `ClassViewPage.tsx:276` + `TeacherViewPage.tsx:220` navBtn → `IconButton variant="secondary"`, `AnnouncementBanner.tsx:26` → IconButton, `TeacherFrame.tsx:89,120` → Button onBrand sm / buttonClass ghost sm, `TemplateEditor.tsx:108` × button → `IconButton` sm ghost, all form-level `<p role="alert" className="… text-danger">` copies (audit 4 › Alerts) → `FormError`, red banners `ProfilePage.tsx:131` and `TemplatesPage.tsx:45` → `Alert`, textareas → `textareaClass`, `TemplateEditor.tsx` time inputs → `inputClass`, `PlanEditor.tsx:34` number input → `inputClass` sizing (`h-9 w-14 text-center`), `TemplatesPage.tsx:155` inline input → `inputClass`.
- Update unit tests and e2e selectors that break (prefer role-based). `aria-pressed` buttons that become radios (SegmentedControl) change role: update tests to `getByRole('radio', …)`.

### Task 7: Badges and colour tokens sweep

- Every inline badge in audit 3b → `Badge` with the matching tone (green → success, amber → warning, reds → danger, `#F1F2F5` → neutral, brand tint → brand). `TeachersPage.tsx:108,113` move to the pill radius.
- Replace hard-coded hex with tokens across `apps/app/src` (not `print/*`, not `printSlips.ts`, not `subjects/palette.ts`, not `register/ColorSwatches.tsx` palette data, not `lib/theme.ts` defaults): reds → `danger`/`danger-soft`/`danger-line`; greens → `success*`; ambers/browns → `warning*`; `#FAFAFB` → `surface`; `#F6F7F9`/`#F4F5F7` → `surface-2`; `#F1F2F5`/`#EEF0F3` → `surface-3`; `#F0F1F4` → `line-soft`; `#8A91A3`/`#6B7385`/`#7A8194` text → `ink-muted`; `#C9CDD6`/`#D3D6DD`/`#D9DCE3` borders → `line-strong`; `slate-50` → `surface`, `slate-100` → `surface-3`. Where a hex encodes timetable cell state (amber "already that day", green "free", hatched busy) keep the visual meaning but use the tokens. `SchoolsPage.tsx:76` focus ring teal → brand.
- Hand-rolled option-row buttons that stay (SlotPicker, TeacherSlotPicker, TeacherViewPage list, AssignPicker trigger/rows, TimetableGrid cell, TemplatesPage cards, ColorSwatches, GradesPage rail): add the button focus ring and `rounded-lg`/`rounded-xl` per tokens; replace `rounded-[10px]`. `AssignPicker.tsx:62` local `inputClass` → shared `inputClass`. In `features/timetable` only class swaps.
- ui leftovers: `Table.tsx` hex → tokens, `AdminLayout.tsx:24` `#F6F6F4` stays (page ground) or → `ground`? Use existing `ground`/`canvas` only if visually identical; otherwise leave.
- Snapshot/visual changes are expected; behaviour is not.
