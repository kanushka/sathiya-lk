# Tutorial videos and guides

Videos are recorded by Playwright against the emulators with seeded data, so they can be re-recorded whenever the UI changes.

## Make the videos

```bash
pnpm tutorials
```

This builds functions, starts the emulators, runs `e2e/tutorials/flows/*.tutorial.ts` once per language (`en`, `si`), then `scripts/render-tutorials.mjs`. Playwright serves the app on port 4173 and the website on 4322, with the website's register links pointing at the local app.

- Each flow registers its own demo school through `registerSchool`. `demoSchool()` clears the emulator's `rateLimits` collection first, so a full run stays under the per-IP registration limit.
- Sign-in uses the auth emulator's Google popup. The popup is a separate window, so it is not in the video; a caption covers it. The emulator popup sometimes never hands the result back to the app; the flow retries and records a cut (`tut.cut()`), which the render step removes from the video and the captions.
- `e2e/tutorials/demo-moe.mjs` adds a fictional school, census numbers 99960–99999 (one per flow and language) for "Sathiya Demo College", to the emulator's built copy of the MOE list (`functions/lib/moeSchools.json`), so videos never show a real school. The functions predeploy build overwrites that file, so the entry never ships.

Output per flow and language in `e2e/tutorials/out/<flow>/<lang>/` (gitignored):

- `<flow>.<lang>.mp4`: 1920×1080, captions burned in, silent audio track (YouTube needs one)
- `<flow>.<lang>.srt`: the same captions, upload to YouTube as subtitles
- `stills/*.png`: screenshots without captions. The render step scales them and copies them to `apps/web/public/guide/<flow>/<lang>/` for the website guide.

Re-render without re-recording: `node scripts/render-tutorials.mjs [flow]`.

## Add a flow

1. Copy `e2e/tutorials/flows/register-school.tutorial.ts`.
2. Find elements with `tut.t(namespace, key)` from `packages/i18n` so the same script works in both languages.
3. Every `tut.say()` and `tut.card()` takes `{ en, si }` text.
4. Add the guide text to `apps/web/src/content/guides.ts`, a page under `apps/web/src/pages/guide/` and `si/guide/`, and the page to `Page` in `apps/web/src/lib/links.ts`, `PUBLIC_PAGES` in `seo.ts` and `pages` in `apps/web/test/build.test.ts`.

## Publish on YouTube

Upload each MP4, add the SRT as subtitles in the matching language, then put the video ID in `youtube` for that guide in `apps/web/src/content/guides.ts`.

Channel: https://www.youtube.com/@sathiya_lk. Put each video in the matching EN or SI playlist: Getting Started, School Setup, Timetable, Daily Use. Channel art is in `docs/youtube/`.

Title format: EN `<Task> | Sathiya Tutorial`, SI `<කාර්යය> | සතිය, පියවරෙන් පියවර`. Description: steps with timestamps, link to the written guide, then `#Sathiya #SchoolTimetable #කාලසටහන`. Chapter timestamps come from the `.srt` caption times; YouTube needs the first at 0:00 and each at least 10 seconds long.

### register-school (en) · playlist Getting Started

- Title: `How to register your school | Sathiya Tutorial`
- Description:

  ```
  Register your school on Sathiya in about 3 minutes. It's free for every Sri Lankan school.

  0:00 Open sathiya.kanushka.com and click Register
  0:15 Sign in with Google and find your school by census number
  0:51 Logo and school colours
  1:06 Create the school

  Start here: https://app.sathiya.kanushka.com/register
  Written guide: https://sathiya.kanushka.com/guide/register-school/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: Sathiya, school timetable, Sri Lanka, school admin, timetable app, register school

### register-school (si) · playlist Getting Started

- Title: `පාසල ලියාපදිංචි කරන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  මිනිත්තු 3 කින් පමණ සතිය හි ඔබේ පාසල ලියාපදිංචි කරන්න. සෑම ශ්‍රී ලාංකීය පාසලකටම නොමිලේ.

  0:00 sathiya.kanushka.com වෙත ගොස් ලියාපදිංචි වන්න ක්ලික් කිරීම
  0:16 Google සමඟ පිවිසී සංගණන අංකයෙන් පාසල සෙවීම
  0:50 ලාංඡනය සහ පාසල් වර්ණ
  1:04 පාසල සෑදීම

  ආරම්භ කරන්න: https://app.sathiya.kanushka.com/register
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/register-school/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: සතිය, කාලසටහන, පාසල් කාලසටහන, ශ්‍රී ලංකා, Sathiya, school timetable

### subjects (en) · playlist Getting Started

- File: `subjects.en.mp4` + `subjects.en.srt`
- Title: `How to add subjects | Sathiya Tutorial`
- Description:

  ```
  Set up one subject list for the whole school, in Sinhala and English. Load the standard Sri Lankan list in one click, then add any missing subject.

  0:00 Open Subjects
  0:14 Load the standard Sri Lankan list
  0:28 Add a missing subject
  0:42 Next: grades and classes

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/subjects/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: subjects, school subjects, Sathiya, school timetable, Sri Lanka, school admin

### subjects (si) · playlist Getting Started

- File: `subjects.si.mp4` + `subjects.si.srt`
- Title: `විෂයයන් එක් කරන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  සිංහලෙන් සහ ඉංග්‍රීසියෙන්, මුළු පාසලටම එක් විෂය ලැයිස්තුවක් සකසන්න. ශ්‍රී ලංකාවේ සම්මත ලැයිස්තුව එක් ක්ලික් කිරීමකින් පූරණය කර, අඩු විෂයයන් එක් කරන්න.

  0:00 විෂයයන් විවෘත කිරීම
  0:14 සම්මත ලැයිස්තුව පූරණය කිරීම
  0:27 අඩු විෂයක් එක් කිරීම
  0:42 ඊළඟට: ශ්‍රේණි සහ පන්ති

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/subjects/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: විෂයයන්, පාසල් විෂය, සතිය, කාලසටහන, පාසල් කාලසටහන, Sathiya

### grades (en) · playlist School Setup

- File: `grades.en.mp4` + `grades.en.srt`
- Title: `How to set up grades and classes | Sathiya Tutorial`
- Description:

  ```
  Add a grade, its classes (6A, 6B, 6C) and how many periods each subject gets in a week.

  0:00 Open Grades & classes
  0:11 Add a grade
  0:21 Add the classes
  0:29 Subjects and periods per week

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/grades/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: grades, classes, periods per week, Sathiya, school timetable, Sri Lanka

### grades (si) · playlist School Setup

- File: `grades.si.mp4` + `grades.si.srt`
- Title: `ශ්‍රේණි සහ පන්ති සකසන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  ශ්‍රේණියක්, එහි පන්ති (6A, 6B, 6C) සහ සෑම විෂයකටම සතියකට ලැබෙන කාලච්ඡේද ගණන එක් කරන්න.

  0:00 ශ්‍රේණි සහ පන්ති විවෘත කිරීම
  0:11 ශ්‍රේණියක් එක් කිරීම
  0:21 පන්ති එක් කිරීම
  0:30 විෂයයන් සහ සතියක කාලච්ඡේද

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/grades/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: ශ්‍රේණි, පන්ති, කාලච්ඡේද, සතිය, කාලසටහන, පාසල් කාලසටහන, Sathiya

### templates (en) · playlist School Setup

- File: `templates.en.mp4` + `templates.en.srt`
- Title: `How to set up period templates (bell schedule) | Sathiya Tutorial`
- Description:

  ```
  Set your school day: periods, times and intervals. Add a period, and make a separate template for a short Friday or primary classes.

  0:00 Open Period templates
  0:11 The school default template
  0:25 Add a period and save
  0:32 A template for a different day

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/templates/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: period templates, bell schedule, school periods, Sathiya, school timetable, Sri Lanka

### templates (si) · playlist School Setup

- File: `templates.si.mp4` + `templates.si.srt`
- Title: `කාලච්ඡේද ආකෘති (සීනු කාලසටහන) සකසන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  ඔබේ පාසල් දිනය සකසන්න: කාලච්ඡේද, වේලාවන් සහ විවේක. කාලච්ඡේදයක් එක් කර, කෙටි සිකුරාදාවකට හෝ ප්‍රාථමික පන්තිවලට වෙනම ආකෘතියක් සාදන්න.

  0:00 කාලච්ඡේද ආකෘති විවෘත කිරීම
  0:11 පාසලේ පෙරනිමි ආකෘතිය
  0:25 කාලච්ඡේදයක් එක් කර සුරැකීම
  0:31 වෙනස් දිනයකට ආකෘතියක්

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/templates/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: කාලච්ඡේද, සීනු කාලසටහන, පාසල් දිනය, සතිය, කාලසටහන, Sathiya

### teachers (en) · playlist School Setup

- File: `teachers.en.mp4` + `teachers.en.srt`
- Title: `How to add and edit teachers | Sathiya Tutorial`
- Description:

  ```
  Add teachers with staff IDs, Sinhala and English names, subjects, grades and the most periods they can teach in a day. Then edit a teacher.

  0:00 Open Teachers
  0:13 Staff ID and name
  0:22 Subjects, grades and daily limit
  0:44 The teacher list and editing
  0:58 Many teachers? Import from Excel

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/teachers/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: teachers, staff ID, add teacher, Sathiya, school timetable, Sri Lanka

### teachers (si) · playlist School Setup

- File: `teachers.si.mp4` + `teachers.si.srt`
- Title: `ගුරුවරුන් එක් කිරීම සහ සංස්කරණය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  සේවක අංක, සිංහල සහ ඉංග්‍රීසි නම්, විෂයයන්, ශ්‍රේණි සහ දිනකට ඉගැන්විය හැකි උපරිම කාලච්ඡේද ගණන සමඟ ගුරුවරුන් එක් කරන්න. ඉන්පසු ගුරුවරයෙකු සංස්කරණය කරන්න.

  0:00 ගුරුවරුන් විවෘත කිරීම
  0:14 සේවක අංකය සහ නම
  0:22 විෂයයන්, ශ්‍රේණි සහ දෛනික සීමාව
  0:46 ගුරු ලැයිස්තුව සහ සංස්කරණය
  1:00 ගුරුවරුන් බොහෝද? Excel වලින් ආයාත කරන්න

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/teachers/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: ගුරුවරුන්, සේවක අංකය, සතිය, කාලසටහන, පාසල් කාලසටහන, Sathiya

### timetable-class (en) · playlist Timetable

- File: `timetable-class.en.mp4` + `timetable-class.en.srt`
- Title: `How to build the timetable by class | Sathiya Tutorial`
- Description:

  ```
  Place lessons period by period for a class. See how many periods each subject still needs, pick a free teacher, use pin mode, and see how Sathiya stops teacher clashes.

  0:00 Open By class
  0:15 The class week
  0:21 Add a lesson and pin mode
  0:46 No teacher clashes
  1:06 Save and publish

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/timetable-class/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: timetable, class timetable, teacher clash, Sathiya, school timetable, Sri Lanka

### timetable-class (si) · playlist Timetable

- File: `timetable-class.si.mp4` + `timetable-class.si.srt`
- Title: `පන්ති අනුව කාලසටහන සකසන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  පන්තියකට කාලච්ඡේදයෙන් කාලච්ඡේදයට පාඩම් තබන්න. සෑම විෂයකටම තව කාලච්ඡේද කීයක් අවශ්‍යදැයි බලා, නිදහස් ගුරුවරයෙකු තෝරා, ඇමිණීමේ ක්‍රමය භාවිත කර, සතිය ගුරු ගැටුම් වළක්වන ආකාරය බලන්න.

  0:00 පන්ති අනුව විවෘත කිරීම
  0:15 පන්තියේ සතිය
  0:21 පාඩමක් එක් කිරීම සහ ඇමිණීමේ ක්‍රමය
  0:45 ගුරු ගැටුම් නැත
  1:05 සුරැකීම සහ ප්‍රකාශනය

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/timetable-class/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: කාලසටහන, පන්ති කාලසටහන, ගුරු ගැටුම්, සතිය, පාසල් කාලසටහන, Sathiya

### profile (en) · playlist Getting Started

- File: `profile.en.mp4` + `profile.en.srt`
- Title: `How to change your school profile, logo and colours | Sathiya Tutorial`
- Description:

  ```
  Update your school details, upload a logo and pick school colours. Ask Sathiya to change the school name.

  0:00 Open the school profile
  0:17 Phone, address and logo
  0:30 Colours and save

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/profile/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: school profile, school logo, school colours, Sathiya, school timetable, Sri Lanka

### profile (si) · playlist Getting Started

- File: `profile.si.mp4` + `profile.si.srt`
- Title: `පාසල් තොරතුරු, ලාංඡනය සහ වර්ණ වෙනස් කරන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  පාසල් විස්තර යාවත්කාලීන කර, ලාංඡනයක් උඩුගත කර පාසල් වර්ණ තෝරන්න. පාසලේ නම වෙනස් කිරීමට සතියෙන් ඉල්ලන්න.

  0:00 පාසල් තොරතුරු විවෘත කිරීම
  0:17 දුරකථනය, ලිපිනය සහ ලාංඡනය
  0:30 වර්ණ සහ සුරැකීම

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/profile/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: පාසල් තොරතුරු, ලාංඡනය, පාසල් වර්ණ, සතිය, කාලසටහන, Sathiya

### members (en) · playlist Getting Started

- File: `members.en.mp4` + `members.en.srt`
- Title: `How to invite another admin | Sathiya Tutorial`
- Description:

  ```
  Share the work: invite a deputy principal or timetable teacher as an admin, and see pending invites.

  0:00 Open Members
  0:15 Invite an admin
  0:31 Pending invites

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/members/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: invite admin, school admin, members, Sathiya, school timetable, Sri Lanka

### members (si) · playlist Getting Started

- File: `members.si.mp4` + `members.si.srt`
- Title: `තවත් පරිපාලකයෙකුට ආරාධනා කරන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  වැඩ බෙදා ගන්න: නියෝජ්‍ය විදුහල්පතිවරයෙකුට හෝ කාලසටහන් ගුරුවරයෙකුට පරිපාලක ලෙස ආරාධනා කර, පොරොත්තු ආරාධනා බලන්න.

  0:00 සාමාජිකයන් විවෘත කිරීම
  0:15 පරිපාලකයෙකුට ආරාධනා කිරීම
  0:32 පොරොත්තු ආරාධනා

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/members/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: පරිපාලක, ආරාධනා, සාමාජිකයන්, සතිය, කාලසටහන, Sathiya

### import (en) · playlist School Setup

- File: `import.en.mp4` + `import.en.srt`
- Title: `How to import teachers from Excel | Sathiya Tutorial`
- Description:

  ```
  Add all your teachers and subjects at once: download the Excel template, fill it in, check the preview and import.

  0:00 Open import
  0:14 Download the Excel template
  0:27 Choose the file and check it
  0:43 Import

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/import/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: import teachers, Excel, bulk import, Sathiya, school timetable, Sri Lanka

### import (si) · playlist School Setup

- File: `import.si.mp4` + `import.si.srt`
- Title: `Excel වලින් ගුරුවරුන් ආයාත කරන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  ඔබේ සියලු ගුරුවරුන් සහ විෂයයන් එකවර එක් කරන්න: Excel සැකිල්ල බාගෙන, පුරවා, පෙරදසුන පරීක්ෂා කර ඇතුළත් කරන්න.

  0:00 ගොනුවකින් ඇතුළත් කිරීම විවෘත කිරීම
  0:13 Excel සැකිල්ල බාගැනීම
  0:27 ගොනුව තෝරා පරීක්ෂා කිරීම
  0:43 ඇතුළත් කිරීම

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/import/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: ගුරුවරුන් ආයාත කිරීම, Excel, සතිය, කාලසටහන, පාසල් කාලසටහන, Sathiya

### timetable-teacher (en) · playlist Timetable

- File: `timetable-teacher.en.mp4` + `timetable-teacher.en.srt`
- Title: `How to use the timetable by teacher | Sathiya Tutorial`
- Description:

  ```
  See each teacher's week and daily load, give them a lesson, and pin more lessons where the teacher and class are both free.

  0:00 Open a teacher
  0:16 Week and daily load
  0:28 Choose the class
  0:42 Pin mode

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/timetable-teacher/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: teacher timetable, teacher load, Sathiya, school timetable, Sri Lanka

### timetable-teacher (si) · playlist Timetable

- File: `timetable-teacher.si.mp4` + `timetable-teacher.si.srt`
- Title: `ගුරුවරුන් අනුව කාලසටහන භාවිත කරන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  සෑම ගුරුවරයෙකුගේම සතිය සහ දෛනික කාර්ය භාරය බලා, ඔවුන්ට පාඩමක් දී, ගුරුවරයා සහ පන්තිය දෙකම නිදහස් තැන්වල තවත් පාඩම් අමුණන්න.

  0:00 ගුරුවරයෙකු විවෘත කිරීම
  0:16 සතිය සහ දෛනික කාර්ය භාරය
  0:27 පන්තිය තේරීම
  0:38 ඇමිණීමේ ක්‍රමය

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/timetable-teacher/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: ගුරු කාලසටහන, කාර්ය භාරය, සතිය, කාලසටහන, පාසල් කාලසටහන, Sathiya

### autofill (en) · playlist Timetable

- File: `autofill.en.mp4` + `autofill.en.srt`
- Title: `How to auto-fill the whole timetable | Sathiya Tutorial`
- Description:

  ```
  Let Sathiya place every lesson for every class in seconds, without clashes. Check the setup, generate, review the preview and save.

  0:00 Open auto-fill
  0:14 Setup check and generate
  0:38 Preview and allocation
  0:51 Classes and save
  1:01 Saved

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/autofill/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: auto-fill, timetable generator, automatic timetable, Sathiya, school timetable, Sri Lanka

### autofill (si) · playlist Timetable

- File: `autofill.si.mp4` + `autofill.si.srt`
- Title: `මුළු කාලසටහනම ස්වයංක්‍රීයව පුරවන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  සතියට සෑම පන්තියකටම සෑම පාඩමක්ම තත්පර කිහිපයකින්, ගැටුම් නොමැතිව තැබීමට ඉඩ දෙන්න. සැකසුම පරීක්ෂා කර, සාදා, පෙරදසුන බලා සුරකින්න.

  0:00 ස්වයංක්‍රීය පිරවීම විවෘත කිරීම
  0:14 සැකසුම පරීක්ෂාව සහ සෑදීම
  0:38 පෙරදසුන සහ ගුරු පැවරීම
  0:51 පන්ති සහ සුරැකීම
  1:01 සුරැකිණි

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/autofill/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: ස්වයංක්‍රීය කාලසටහන, කාලසටහන් සෑදීම, සතිය, කාලසටහන, පාසල් කාලසටහන, Sathiya

### publish-print (en) · playlist Timetable

- File: `publish-print.en.mp4` + `publish-print.en.srt`
- Title: `How to publish and print the timetable | Sathiya Tutorial`
- Description:

  ```
  Publish the timetable so teachers see it on their phones, then print class and teacher timetables as A4 sheets or PDF.

  0:00 Publish to teachers
  0:15 Check and publish
  0:26 Print a class timetable
  0:43 Teacher timetables

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/publish-print/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: publish timetable, print timetable, PDF, Sathiya, school timetable, Sri Lanka

### publish-print (si) · playlist Timetable

- File: `publish-print.si.mp4` + `publish-print.si.srt`
- Title: `කාලසටහන ප්‍රකාශ කර මුද්‍රණය කරන ආකාරය | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  ගුරුවරුන්ට තම දුරකථනවල පෙනෙන ලෙස කාලසටහන ප්‍රකාශ කර, පන්ති සහ ගුරු කාලසටහන් A4 පත්‍රිකා හෝ PDF ලෙස මුද්‍රණය කරන්න.

  0:00 ගුරුවරුන්ට ප්‍රකාශ කිරීම
  0:15 පරීක්ෂා කර ප්‍රකාශ කිරීම
  0:26 පන්ති කාලසටහනක් මුද්‍රණය
  0:43 ගුරු කාලසටහන්

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/publish-print/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: කාලසටහන ප්‍රකාශ කිරීම, මුද්‍රණය, PDF, සතිය, පාසල් කාලසටහන, Sathiya

### teacher-phone (en) · playlist Daily Use (vertical video)

- File: `teacher-phone.en.mp4` + `teacher-phone.en.srt`
- Title: `For teachers: your timetable on your phone | Sathiya Tutorial`
- Description:

  ```
  For teachers: join your school with the link your admin shares, sign in with Google, and see today's lessons and your week on your phone.

  0:00 Open the join link and sign in
  0:23 Today's lessons
  0:39 Your week

  Open Sathiya: https://app.sathiya.kanushka.com
  Written guide: https://sathiya.kanushka.com/guide/teacher-phone/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: teacher timetable, timetable app, teachers, Sathiya, Sri Lanka

### teacher-phone (si) · playlist Daily Use (vertical video)

- File: `teacher-phone.si.mp4` + `teacher-phone.si.srt`
- Title: `ගුරුවරුන් සඳහා: ඔබේ දුරකථනයේ ඔබේ කාලසටහන | සතිය, පියවරෙන් පියවර`
- Description:

  ```
  ගුරුවරුන් සඳහා: පරිපාලක බෙදා ගන්නා සබැඳියෙන් පාසලට සම්බන්ධ වී, Google සමඟ පිවිස, අද දින පාඩම් සහ ඔබේ සතිය දුරකථනයෙන් බලන්න.

  0:00 සම්බන්ධ වීමේ සබැඳිය සහ පිවිසීම
  0:24 අද දින පාඩම්
  0:39 ඔබේ සතිය

  සතිය විවෘත කරන්න: https://app.sathiya.kanushka.com
  ලිඛිත මාර්ගෝපදේශය: https://sathiya.kanushka.com/si/guide/teacher-phone/

  #Sathiya #SchoolTimetable #කාලසටහන
  ```
- Tags: ගුරු කාලසටහන, ගුරුවරුන්, සතිය, කාලසටහන, Sathiya

Thumbnail: the title card (first seconds of the video) or `stills/confirm-school.png` with the title on top, in the channel's teal/saffron grid style.
