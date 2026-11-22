# Browser test report: 2026-11-22

I ran a full QA pass of Sathiya in a real browser (agent-browser, Chromium) against `pnpm dev:local`, using only the emulators with the seeded Siripura Central College demo. I registered a second school (Lakeview Maha Vidyalaya) during the run. This report only finds and documents issues; nothing was fixed.

- Desktop viewport: 1440×900. Teacher viewport: 390×844. Admin phone check: 375×812.
- Tested in English throughout, then a key subset in Sinhala: the website, admin pages, the timetable grids, teacher login and the teacher's Today and Week views.
- Screenshots are in `docs/qa/screenshots/`.

## Summary

| # | Severity | Area | Issue |
|---|---|---|---|
| 1 | major | Timetable grid | A single click on `+` (or a filled cell) only selects it; the popup opens on the second click |
| 2 | major | Period templates / orphans | An orphaned entry after shrinking a template can't be seen or removed anywhere in the UI |
| 3 | major | Group pin | "Classes together" lets you join a class that already has the group complete, which silently puts it over plan (6B Aesthetic 6/3) |
| 4 | major | Super admin suspend | A disabled school's admin can still sign in and sees a normal dashboard; signed-in teachers keep access |
| 5 | minor | Subjects | Duplicate English subject names are allowed ("Mathematics" twice) |
| 6 | minor | Dashboard / years | A duplicate year label creates a second "2027 · draft"; any text is accepted as a year |
| 7 | minor | Register | The duplicate census number is only reported after step 3, email verification and Create |
| 8 | minor | Publish | The confirm dialog doesn't mention any open problems |
| 9 | minor | Counts | 6B is "39 / 40 placed" on its class page but "36/40" on the dashboard |
| 10 | minor | Teachers | Print slip / WhatsApp are enabled before a reset and give "Password: Reset needed" |
| 11 | minor | Teachers | "Print all login slips" prints 17/18 useless "Reset needed" slips without warning |
| 12 | minor | Teachers | "Reset password" acts immediately with no confirm |
| 13 | minor | Teachers | Deleting a teacher who is in use: the blocking message only appears after confirming |
| 14 | minor | Login | The forgot-password error sits under the Password field and stays after success |
| 15 | minor | Login | A signed-out visit to `/me` lands on the Admin tab |
| 16 | minor | Login | `/login?school=<id>` without `as=teacher` ignores the school |
| 17 | minor | Report popup | An invalid reporter email gives a generic "Could not send the report" |
| 18 | minor | Suspend | The slip link for a disabled school shows an empty picker and doesn't explain why |
| 19 | minor | Members | The admin row shows the email under NAME, and the EMAIL column is empty |
| 20 | minor | Admin at 375px | After "Continue anyway" the sidebar stays expanded and the page is 1024px wide |
| 21 | minor | Modals a11y | The page behind a modal isn't `inert`/`aria-hidden` |
| 22 | minor | Sinhala teacher | The date line stays English; Week cells truncate subjects to "ගණි…" |
| 23 | minor | Local dev | Emulator auth emails and the register T&C links point at production hosts |
| 24 | polish | Slot editor | The current teacher shows as "Free · 0/7"; the subject shows "needs 1" when it's already 6/6 |
| 25 | polish | Group block editor | The joined-class chip looks unselected; the block's own teachers show as "0/6 ✓ free" |
| 26 | polish | + popup | The teacher list flashes "busy" while Assign is saving |
| 27 | polish | Pin mode | The selected cell outline is clipped in the Fri column |
| 28 | polish | Dashboard | The year selector appears twice; "0 / 0 all subjects placed" shows with no classes |
| 29 | polish | Grades | Adding a second grade doesn't open it |
| 30 | polish | Report popup | `?report=1` stays in the URL after sending, so refresh reopens the popup |
| 31 | polish | Super admin | Suspend/Disable wording is mixed; Enable has no confirm; counts show "…" while disabled |
| 32 | polish | Super admin | School details show "Active year: None" and "Last activity: Never" for an active school |
| 33 | polish | Super admin | A school without a logo has no placeholder, so its name column is misaligned |
| 34 | polish | Profile | The contrast warning contradicts "Text colour is chosen automatically…" |
| 35 | polish | Profile / register | The brand preview hard-codes "Timetable 2026" |
| 36 | polish | Sinhala | The search placeholder is truncated; the login column and group cells wrap |
| 37 | polish | Website (dev only) | `/robots.txt` and `/sitemap.xml` return 404 in `astro dev` |

**Counts:** blocker 0 · major 4 · minor 19 · polish 14 (37 in total).

No console errors and no failed (4xx/5xx) network requests showed up on any page I visited. The only console output was React Router's v7 future-flag warning and Vite dev noise.

---

## Major

### 1. Timetable grid: a single click on `+` doesn't open the popup
- **Area / flow:** Timetable, both By class and By teacher. Adding or editing a lesson.
- **Steps:**
  1. Open Timetable → By class → 6A.
  2. Click an empty `+` cell once.
- **Expected:** The "Choose a subject" popup opens. The hint bar says "Click + to add a lesson."
- **Actual:**
  - The cell only gets a selection outline. A second click on the same cell opens the popup.
  - Filled cells behave the same way.
  - The cause is `TimetableGrid.onClick`: outside Pin mode it selects first and activates only when the cell is already selected.
  - Users will think the `+` is broken.
- **Screenshot:** `screenshots/tt-first-click-selects.png`

### 2. An orphaned entry after shrinking a template can't be removed
- **Area / flow:** Period templates → Timetable.
- **Steps:**
  1. Period templates → Short Friday (used by 6C, which has Science on Fri P7) → Different per day → Fri.
  2. Remove P7 and P6, then Save template.
  3. Choose "Save anyway". The warning said "1 timetable entry will be orphaned and listed under Needs attention".
  4. Dashboard → Needs attention → "6C Friday P7 is outside the period template — Move or remove this entry".
- **Expected:** The link lets you see the orphaned entry and move or delete it.
- **Actual:**
  - The link opens the 6C grid, where the Fri column stops at P5. The entry isn't shown anywhere and there's no control to remove it.
  - Counts disagree: the side panel says Science **1/5**, while the header says **0 / 37 placed**.
  - The dashboard warning can't be cleared without restoring the template.
- **Screenshots:** `screenshots/dashboard-orphan.png`, `screenshots/orphan-in-grid.png`, `screenshots/template-shrink.png`

### 3. A group pin's "Classes together" pushes the joined class over plan
- **Area / flow:** Timetable by class → Pin a group subject.
- **Steps:**
  1. 6A → side list → pin button on Aesthetic (a group with 3 options).
  2. Choose Music, Dancing and Art teachers.
  3. Under "Classes together" click **+ 6B**. 6B already has Aesthetic 3/3 from its own group slots.
  4. Start pinning → Suggest 3 slots → Pin 3 suggested → Done.
- **Expected:** 6B isn't offered once it has the subject complete, or the dialog or pin bar warns that 6B will go over plan.
- **Actual:**
  - The pin bar counts only 6A ("3 of 3 placed · complete").
  - 6B silently goes to **Aesthetic 6/3**; the problem only shows later on the dashboard ("6B Aesthetic 6 / 3, 3 too many periods").
  - The By teacher "Teach together (combined)" option offers the same thing (for example, + 6B for English while 6B is 5/5).
- **Screenshots:** `screenshots/tt-group-pinmode.png`, `screenshots/tt-6b-aesthetic-over.png`, `screenshots/dashboard-warnings.png`

### 4. A disabled school's admin can still sign in, and signed-in teachers keep access
- **Area / flow:** Super admin → Schools → Disable.
- **Steps:**
  1. As super admin, Schools → Lakeview → Disable → "Disable school". The dialog says "Everyone at this school, admins and teachers, will be blocked from signing in until you enable it again."
  2. In a fresh browser, sign in as the Lakeview admin with email and password.
  3. Try Subjects → + Add subject → Add subject.
  4. Separately, disable Siripura while SCC024 is signed in on a phone, then reload `/me`.
- **Expected:** The admin's sign-in is refused, or they land on a "school disabled" screen. Teachers who are already signed in lose access.
- **Actual:**
  - The admin signs in and sees the full normal dashboard with no notice.
  - Writes fail with the generic "Could not add the subject. Try again."
  - The already-signed-in teacher still sees the whole timetable after reload.
- **Screenshots:** `screenshots/suspended-admin-login.png`, `screenshots/suspended-admin-write.png`, `screenshots/suspended-teacher-session.png`, `screenshots/super-disable-confirm.png`

---

## Minor

### 5. Duplicate subject names are allowed
- **Area / flow:** Setup → Subjects → + Add subject.
- **Steps:** Load the standard list, then add a subject with Name in English "Mathematics".
- **Expected:** An error like "Mathematics already exists", which is the same check the short name already gets.
- **Actual:**
  - It's saved as a second "Mathematics" with the auto short name "Math" and an empty Sinhala name.
  - Only short names are checked for uniqueness (`shortTaken`).
  - Two identical entries then appear in the grade plan and timetable pickers.
- **Screenshot:** `screenshots/subjects-dup-list.png`

### 6. A duplicate or invalid year label is accepted
- **Area / flow:** Dashboard → New year.
- **Steps:** With "2027" already existing, New year → "2027" → Create year. Also try "abc".
- **Expected:** Duplicates are rejected, and the label is validated as a year.
- **Actual:**
  - A second "2027 · draft" is created silently, so the year dropdown lists two identical entries.
  - "abc" enables the Create button.
- **Screenshot:** `screenshots/new-year-dup.png`

### 7. Register: the duplicate census number is caught very late
- **Area / flow:** Register a new school.
- **Steps:**
  1. Step 1 with census 12345, which is already taken by Siripura.
  2. Go through Logo & colours and Your account → Create school.
  3. Verify the email (the "Check your email" gate) → "I've confirmed it" → Create school again.
- **Expected:** "This school is already registered" shows on step 1, when you press Next.
- **Actual:** You only find out after creating an account, verifying the email and pressing Create. Then you're bounced back to step 1. The error message itself is good.
- **Screenshots:** `screenshots/register-dup-census.png`, `screenshots/register-dup-census-error.png`

### 8. The publish confirm hides open problems
- **Area / flow:** Dashboard → Publish to teachers.
- **Steps:** Publish while the dashboard shows 0/5 classes complete, 1 teacher over the daily limit, an over-plan subject and an orphaned entry.
- **Expected:** The dialog summarises the warnings, for example "3 problems need attention — publish anyway?"
- **Actual:** It only says "Teachers will see the timetable as it is now." One click publishes.
- **Screenshot:** `screenshots/publish-dialog.png`

### 9. Placed counts disagree between the dashboard and the class page
- **Area / flow:** Dashboard → Classes card vs Timetable → 6B.
- **Steps:** After issue 3 (6B Aesthetic 6/3), compare the two.
- **Expected:** The same number in both places.
- **Actual:** The class page header says **39 / 40 placed**; the dashboard says **6B 36/40**. The dashboard caps each subject at its plan, while the page counts over-plan periods.
- **Screenshots:** `screenshots/tt-6b-aesthetic-over.png`, `screenshots/dashboard-warnings.png`

### 10. Print slip / WhatsApp before a reset give a useless slip
- **Area / flow:** Teachers → Edit (for example, SCC011).
- **Steps:** Open Edit, then click Print slip or Share on WhatsApp without resetting first.
- **Expected:** Both are disabled, or they prompt you to reset first.
- **Actual:** The slip and the WhatsApp text contain "Password: Reset needed".
- **Screenshot:** `screenshots/print-slip-no-password.png`

### 11. "Print all login slips" prints mostly useless slips
- **Area / flow:** Teachers → Print all login slips (seeded school).
- **Steps:** Click Print all login slips.
- **Expected:**
  - A warning that passwords are only known right after a reset.
  - An option to reset everyone or only those selected, or to print only the teachers with a fresh password.
- **Actual:** It prints 18 slips, and 17 of them say "Password: Reset needed".
- **Screenshot:** `screenshots/print-all-slips.png`

### 12. "Reset password" has no confirm
- **Area / flow:** Teachers → Edit → Reset password.
- **Steps:** Click Reset password.
- **Expected:** A confirm step ("The current password stops working immediately"), since an accidental click locks the teacher out until they get a new slip.
- **Actual:** The password resets immediately and the new one is shown.
- **Screenshot:** `screenshots/teacher-reset-done.png`

### 13. Deleting a teacher who is in use: the block comes after confirmation
- **Area / flow:** Teachers → Delete (SCC011, who is used in 8 slots).
- **Steps:** Click Delete, then Delete in the dialog.
- **Expected:** The first dialog already says "Used in 8 slots — remove them from the timetable first". Subjects already show "Used in" this way.
- **Actual:**
  - The first dialog says "This removes the teacher and their login. It cannot be undone."
  - Only after you confirm does it switch to "Used in 8 slots. Remove them from the timetable first."
  - The block itself works: nothing is deleted.
- **Screenshots:** `screenshots/teacher-delete-in-use.png`, `screenshots/teacher-delete-in-use-result.png`

### 14. The forgot-password error is misplaced and sticks
- **Area / flow:** Login (admin) → Forgot password?
- **Steps:**
  1. Click "Forgot password?" with the email empty.
  2. Type the email and click it again.
- **Expected:** The error sits under Email and clears on success.
- **Actual:**
  - "Enter your email above first." shows under the **Password** field, with a red border on Password.
  - After a successful send the toast says "If an account exists, we've sent a link", but the red error stays.
  - The reset mail itself is correct: the `mail` doc is in state SUCCESS (dry run) and bilingual.
- **Screenshot:** `screenshots/forgot-pw-sent.png`

### 15. A signed-out visit to `/me` opens the Admin tab
- **Area / flow:** Teacher on a phone with `/me` bookmarked.
- **Steps:** While signed out, open `/me`.
- **Expected:** `/login?as=teacher`, the Teacher tab.
- **Actual:** `/login` with the School admin tab selected.
- **Screenshot:** `screenshots/me-redirect-admin-tab.png`

### 16. `?school=<id>` is ignored without `as=teacher`
- **Area / flow:** Login params.
- **Steps:** Open `/login?school=siripura`.
- **Expected:** The Teacher tab, with the school preselected.
- **Actual:**
  - The Admin tab opens, and the school param does nothing until you switch tabs.
  - The low impact is because slip and app links always include both params.
  - `?as=teacher&school=bogus` shows an empty picker without any message.
- **Screenshot:** `screenshots/login-school-param.png`

### 17. Report popup: invalid email gives a generic error
- **Area / flow:** Login → Report a school.
- **Steps:**
  1. Choose a school and a reason.
  2. Enter "bad-email" in Your email → Send report.
- **Expected:** A field error on the email.
- **Actual:** "Could not send the report. Please try again." With a valid email the report is sent and appears in Super → Reports.
- **Screenshot:** `screenshots/report-bad-email.png`

### 18. Slip link for a disabled school gives no explanation
- **Area / flow:** Teacher login while the school is disabled.
- **Steps:** Open `/login?as=teacher&school=<disabled id>`.
- **Expected:** "This school is currently disabled. Contact your admin."
- **Actual:** The school picker is empty, and pressing Log in says "Choose your school first".
- **Screenshot:** `screenshots/suspended-teacher-login.png`

### 19. Members: the admin's name and email are in the wrong columns
- **Area / flow:** School → Members.
- **Steps:** Open Members.
- **Expected:** NAME "Principal Siripura", EMAIL "admin@…".
- **Actual:** NAME shows the email address and EMAIL is empty. Teachers' EMAIL is empty too.
- **Screenshot:** `screenshots/members.png`

### 20. Admin at 375px: the layout after "Continue anyway"
- **Area / flow:** Admin on a phone.
- **Steps:** At 375px open `/admin` → Continue anyway.
- **What works:**
  - The notice appears.
  - The banner "Admin screens work best on a laptop…" persists across pages and reloads.
  - The notice doesn't come back.
- **Issue:**
  - The sidebar stays expanded at about 250px, so the document is 1024px wide with horizontal scroll.
  - The sidebar could start collapsed on phones.
- **Screenshots:** `screenshots/admin-375-notice.png`, `screenshots/admin-375-continue.png`

### 21. Modals don't make the background inert
- **Area / flow:** Every modal (report, add subject, custom plan, …).
- **Steps:** Open a modal and inspect the accessibility tree.
- **Expected:** The page behind is `inert` or `aria-hidden`.
- **Actual:**
  - Background controls stay exposed to assistive tech; a label lookup in the Custom plan dialog matched the grade plan's input behind it.
  - Tab focus trapping, Esc to close and focus return all work.
  - Dropdowns inside modals are not clipped.
- **Screenshot:** `screenshots/custom-plan-6b.png`

### 22. Sinhala teacher view: an English date and truncated cells
- **Area / flow:** Teacher `/me` in Sinhala at 390px.
- **Steps:** Switch the language to සිංහල on `/me` and `/me/week`.
- **Expected:** A localized date, and readable subjects.
- **Actual:**
  - The date line stays "Thursday 26 November".
  - Week cells truncate subjects to "ගණි…".
- **Screenshots:** `screenshots/si-teacher-today-mobile.png`, `screenshots/si-teacher-week-mobile.png`

### 23. Local dev: emails and legal links point at production
- **Area / flow:** `dev:local`, then `sendAuthEmail` / register.
- **Steps:** Request a password reset, then check the `mail` doc and the register step 3 links.
- **Expected:** Links use the local app and website (`localhost:5173` / `localhost:4321`) when running against the emulators.
- **Actual:**
  - Reset and verify links are `https://app.sathiya.kanushka.com/auth/action?…oobCode=<emulator code>`.
  - The Terms & Conditions and Privacy Policy links go to `https://sathiya.kanushka.com/…`.
  - A local tester who clicks them lands on production. I tested `/auth/action` by rewriting the host to localhost.
- **Screenshot:** none. The link is in the `mail` doc's `text` and `html`.

---

## Polish

### 24. Slot editor (filled slot) shows confusing counts
- **Steps:** 6A → Fri P1 (Maths with Mr. P. Bandara) → open.
- **Actual:**
  - The current teacher shows as "Free · 0/7 periods on Friday", although he teaches this very slot.
  - The subject shows "needs 1" while Mathematics is 6/6.
  - The current-teacher row wraps ("0/7 / periods on Friday").
- **Screenshot:** `screenshots/tt-filled-slot.png`

### 25. Group block editor
- **Steps:** 6A → Mon P4 Religion (6A+6B) → open.
- **Actual:**
  - The joined 6B chip (`aria-pressed=true`) renders pale and outlined, so it looks unselected next to the solid 6A.
  - The block's own teachers show as "0/6 ✓ free".
- **Screenshot:** `screenshots/tt-group-block.png`

### 26. The `+` popup flashes while assigning
- **Steps:** `+` → Mathematics → Mr. P. Bandara (starred and preselected) → Assign.
- **Actual:** While saving, the list re-renders with Bandara as "Teaching 6A · Mathematics" and his radio gone, before the dialog closes.
- **Screenshot:** none; the frame wasn't kept.

### 27. Pin mode: the outline is clipped in the last column
- **Steps:** Pin mode on 6A; look at Fri P1.
- **Actual:** The right edge of the pinned cell's outline is cut off.
- **Screenshot:** `screenshots/pin-over-plan.png`

### 28. Dashboard on a new school
- **Actual:**
  - The year selector appears in both the sidebar and the header.
  - With no classes it shows "Classes complete 0 / 0, all subjects placed".
  - "Publish to teachers" is enabled.
- **Screenshot:** `screenshots/dashboard-new-school.png`

### 29. Grades: a new grade isn't selected after adding it
- **Steps:** With Grade 6 open, + Add grade → Grade 12.
- **Actual:** Grade 12 is added to the list, but Grade 6 settings stay open.
- **Screenshot:** `screenshots/grade6-plan.png`

### 30. Report popup: the URL keeps `?report=1`
- **Steps:** Send a report.
- **Actual:** The popup closes with "Report sent. Thank you." but the URL is still `/login?report=1`, so a refresh reopens the popup.
- **Screenshot:** `screenshots/report-sent.png`

### 31. Super admin wording and confirms
- **Actual:**
  - The Reports row button says "Suspend school" but opens a "Disable …? / Disable school" dialog.
  - The list uses Disable/Enable and the status says "Disabled"; the emails say "has been suspended".
  - Enable runs without a confirm.
  - A disabled school's row shows "…" for its teacher and class counts.
- **Screenshots:** `screenshots/super-reports.png`, `screenshots/super-disabled.png`

### 32. Super school details have stale stats
- **Steps:** Super → Schools → Lakeview → Details.
- **Actual:** "Active year: None" (it has 2027 drafts), "Entries: —", and "Last activity: Never", although its admin had worked in it today.
- **Screenshot:** `screenshots/super-school-detail.png`

### 33. Super schools list: no logo placeholder
- **Actual:** Siripura has no logo, so its name starts further left than Lakeview's.
- **Screenshot:** `screenshots/super-schools.png`

### 34. Profile: contradictory contrast messages
- **Steps:** School profile → Primary colour → custom `#F5F5A0`.
- **Actual:** "This primary colour is too light for white text (contrast 1.1:1…) Pick a darker colour." appears next to "Text colour is chosen automatically so it stays readable."
- **Screenshot:** `screenshots/profile-contrast.png`

### 35. Brand preview hard-codes 2026
- **Actual:** The register and profile previews say "Timetable 2026" / "2026 කාලසටහන" while the school year is 2027.
- **Screenshots:** `screenshots/register-logo-colours.png`, `screenshots/si-profile.png`

### 36. Sinhala admin text fitting
- **Actual:**
  - The Teachers search placeholder is truncated ("නමින් හෝ සේවක අංකයෙ").
  - The red login-column text "තවම පිවිස නැත" wraps onto two lines.
  - Class-grid group cells cut "කණ්ඩායම · ගුරුවරු 3".
  - The template name "School default" is shown untranslated in the grid header.
- **Screenshots:** `screenshots/si-teachers.png`, `screenshots/si-timetable-class-c-6b.png`

### 37. Website: robots and sitemap 404 in dev
- **Steps:** `curl localhost:4321/robots.txt` and `/sitemap.xml`.
- **Actual:**
  - Both return 404 under `astro dev`, because `trailingSlash: 'always'`; `/robots.txt/` returns the file.
  - A static build writes real files, so this is likely dev-only. The production site was not checked.
- **Screenshot:** none.

---

## What worked (spot-checked, no issue found)

**Website**
- Home, features, FAQ, T&C, privacy and contact in English and Sinhala.
- The language switch keeps the current page.
- The "Report a school" link goes to `/login?report=1`.
- No horizontal scroll at 375px, and the mobile menu works.

**Login**
- The Admin/Teacher switch, and `?as=teacher&school=siripura` preselecting the school.
- The "Wrong email or password" and "Wrong staff ID or password" messages.

**`/auth/action`**
- Good reset code: the 8+ character rule, the mismatch message, and "Password changed".
- A used code and a garbage code both give "This link has already been used or is not valid".
- A missing code gives "This link is not valid".
- The verifyEmail link gives "Email confirmed".

**Register**
- The verify-email gate: "Not verified yet" until verified.
- The no-census toggle, which is disabled for Government schools.
- The staff ID prefix suggestion (Lakeview Maha Vidyalaya → LMV).
- Logo upload, and the colour swatches with their `aria-pressed` state.
- The welcome email.

**Teachers**
- Add with title, the slip with QR, and slip printing.
- Edit, search, and deleting an unused teacher.
- The login column updates after a teacher signs in.

**Subjects**
- The standard list, a loading spinner, and no duplicates on a second load.
- Auto short name ("Information Technology" → IT).
- Short-name uniqueness, case-insensitive.
- Unused delete.

**Grades & classes**
- Add and delete a grade (the confirm lists its classes), add classes.
- Subjects and a Religion group with three options in the plan.
- A per-class custom plan ("OWN PLAN").
- Dropdowns inside modals are not clipped.

**Period templates**
- New template, a different-per-day template with a Fri tab, and the orphan warning before saving.

**Timetable by class**
- The `+` popup flow: subject, then teacher, with the preferred teacher starred and preselected.
- Pin mode: pin and unpin, Suggest, the over-plan "+1 over" badge, Esc and Done.
- Clear slot.
- Group pin with three teachers, plus the "Same teacher twice" validation.

**Timetable by teacher**
- `+`: subject, then class.
- A class on another template is shown in its own time ("No 6C period" cells).
- Daily-limit "Limit · 3/3" cells, with the dashboard warning "4 periods on Monday".
- A clash is blocked ("6A · Mathematics · Mr. P. Bandara. Pin the other free slots instead.").
- The selected class and teacher are remembered when switching between By class and By teacher.

**Publish and print**
- Publishing writes `publishedClasses` and `publishedTeachers`; the orphan is excluded.
- Class and teacher print pages: `@page` is A4 landscape, and a PDF export fits on one page.

**Teacher at 390px**
- Login with a slip and Today's NOW and Next (tested with a faked clock for Thursday 07:50).
- The Week view.
- Change password: the 8+ rule, mismatch, wrong current password, and success.
- **No phone-size notice** appears.

**Super admin**
- Schools list and search by name, city, census and prefix.
- The read-only school view: all inputs are read-only, and there's no publish or edit buttons.
- Disable and Enable.
- Reports: Close, Suspend.
- Census release (the index doc is removed and the details show "released").

**Members and email**
- Invite admin (pending invite plus an invitation mail), the app links with a QR, and Copy.
- Every `mail` doc reached `delivery.state: SUCCESS` (`dryRun: true`).

**General**
- Loading states on buttons: Load standard, Deleting…, Resetting…, Assign, and Create school.
- Empty states have action buttons.

## Not tested, and why

- **Google sign-in:** it needs the Auth emulator's Google popup flow, which I didn't run.
- **Expired action codes:** emulator oob codes don't expire within a session, so only used and invalid codes were tested.
- **Real email delivery:** `sendMail` runs as a dry run without `RESEND_API_KEY`, so I checked the `mail` docs only.
- **Physical printing:** I checked the print pages, the `@page` CSS and a headless PDF only. The browser print dialog was stubbed or skipped.
- **Logo validation:** a PNG, more than 1MB, or a non-square image were not tried; only an SVG upload was.
- **Some timetable actions:** I didn't run "Fill empty with class teacher" or create a new combined block via "Combine with other classes". Existing combined blocks (Religion 6A+6B) were viewed.
- **Remaining super admin pages:** Usage, Default subjects, Terms and Announcements were not exercised.
- **Register in Sinhala and the Sinhala super-admin screens:** skipped for time; the Sinhala subset focused on the website, the admin pages, the grids and the teacher mobile views.
- **Concurrent editing by two admins:** not tested.
- **Production site:** not touched, by design.

## Test-run notes

- `pnpm dev:local` failed at first with the system pnpm 11 (`ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`) and Node 26. It ran with Node 22 and a pnpm 9.15.9 shim on `PATH`. The script always calls the `pnpm` on `PATH`, so it's worth pinning or checking the pnpm version.
- Once during the run the browser tab went to `about:blank` and lost the session. I couldn't reproduce it after a restart, so I treated it as a tooling issue.
- Data I changed in the emulators:
  - Lakeview was registered and its census 54321 released.
  - SCC007 was deleted.
  - SCC011 got max/day 3 and a reset password.
  - The Short Friday template's Friday was shrunk.
  - 2027 was published.
  - Running `pnpm seed` restores the demo.
