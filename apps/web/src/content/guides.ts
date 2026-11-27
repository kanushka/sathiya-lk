// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Lang } from '../lib/links';

export interface GuideStep {
  title: string;
  body: string;
  image?: string;
}

export interface GuideText {
  title: string;
  summary: string;
  steps: GuideStep[];
  next?: string;
}

export type GuideSlug = 'register-school' | 'subjects' | 'grades' | 'templates' | 'teachers' | 'timetable-class';

export interface Guide {
  slug: GuideSlug;
  minutes: number;
  youtube: Record<Lang, string>;
  text: Record<Lang, GuideText>;
}

export const guides: Guide[] = [
  {
    slug: 'register-school',
    minutes: 3,
    youtube: { en: 'Y5K3s1phDyc', si: '_PPvqwqfAWY' },
    text: {
      en: {
        title: 'Register your school',
        summary: 'Create your school on Sathiya and become its first admin. It takes about 3 minutes and is free.',
        steps: [
          {
            title: 'Sign in with Google',
            body: 'Click "Register your school" on this site. Sathiya asks you to sign in first. We recommend "Continue with Google": there is no new password to remember and no email to confirm. You can also create an account with email and a password.',
            image: 'signin',
          },
          {
            title: 'Find your school',
            body: 'Enter your census number and click "Find my school". The school office has it on Ministry of Education letters. Private and international schools, or schools missing from the list, choose "My school isn\'t listed" and fill in the details. Sathiya reviews those schools before they go live.',
            image: 'find-school',
          },
          {
            title: 'Check the school details',
            body: 'Sathiya fills in the official name, address, grades and medium from the Ministry list. Add the school name in Sinhala and the city. Teacher staff IDs start with the prefix shown, like SDC001. Click "Yes, this is my school".',
            image: 'confirm-school',
          },
          {
            title: 'Add your logo and colours',
            body: 'Upload a square PNG or SVG logo (optional) and pick two school colours. The preview shows how timetables will look. Click "Next: your account".',
            image: 'brand',
          },
          {
            title: 'Create the school',
            body: 'Check your name, accept the terms and click "Create school".',
            image: 'account',
          },
          {
            title: 'Your school is ready',
            body: 'You land on the admin dashboard. Next, add your classes, subjects and teachers.',
            image: 'admin-dashboard',
          },
        ],
      },
      si: {
        title: 'ඔබේ පාසල ලියාපදිංචි කරන්න',
        summary: 'සතිය හි ඔබේ පාසල සාදා එහි පළමු පරිපාලක වන්න. මිනිත්තු 3 ක් පමණ ගත වේ. සම්පූර්ණයෙන්ම නොමිලේ.',
        steps: [
          {
            title: 'Google සමඟ පිවිසෙන්න',
            body: 'මෙම වෙබ් අඩවියේ "ඔබේ පාසල ලියාපදිංචි කරන්න" ක්ලික් කරන්න. සතිය මුලින්ම පිවිසෙන ලෙස ඉල්ලයි. "Google සමඟ ඉදිරියට යන්න" අපි නිර්දේශ කරමු: අලුත් මුරපදයක් මතක තබා ගැනීමට හෝ විද්‍යුත් තැපෑල තහවුරු කිරීමට අවශ්‍ය නැත. විද්‍යුත් තැපෑල සහ මුරපදයක් සමඟ ගිණුමක් සෑදීමටද හැකිය.',
            image: 'signin',
          },
          {
            title: 'ඔබේ පාසල සොයන්න',
            body: 'සංගණන අංකය ඇතුළත් කර "මගේ පාසල සොයන්න" ක්ලික් කරන්න. අධ්‍යාපන අමාත්‍යාංශ ලිපිවල එය පාසල් කාර්යාලයේ ඇත. පෞද්ගලික සහ ජාත්‍යන්තර පාසල්, හෝ ලැයිස්තුවේ නැති පාසල්, "මගේ පාසල ලැයිස්තුවේ නැත" තෝරා විස්තර පුරවන්න. එවැනි පාසල් සජීවී වීමට පෙර සතිය පරීක්ෂා කරයි.',
            image: 'find-school',
          },
          {
            title: 'පාසලේ විස්තර පරීක්ෂා කරන්න',
            body: 'අමාත්‍යාංශ ලැයිස්තුවෙන් නිල නම, ලිපිනය, ශ්‍රේණි සහ මාධ්‍යය සතිය පුරවයි. පාසලේ නම සිංහලෙන් සහ නගරය එක් කරන්න. ගුරු සේවක අංක පෙන්වා ඇති උපසර්ගයෙන් අරඹයි, උදා. SDC001. "ඔව්, මෙය මගේ පාසලයි" ක්ලික් කරන්න.',
            image: 'confirm-school',
          },
          {
            title: 'ලාංඡනය සහ වර්ණ එක් කරන්න',
            body: 'සමචතුරස්‍ර PNG හෝ SVG ලාංඡනයක් උඩුගත කර (අනිවාර්ය නොවේ) පාසල් වර්ණ දෙකක් තෝරන්න. කාලසටහන් පෙනෙන ආකාරය පෙරදසුනේ දැකිය හැක. "ඊළඟ: ඔබේ ගිණුම" ක්ලික් කරන්න.',
            image: 'brand',
          },
          {
            title: 'පාසල සාදන්න',
            body: 'ඔබේ නම පරීක්ෂා කර, නියම සහ කොන්දේසි පිළිගෙන "පාසල සාදන්න" ක්ලික් කරන්න.',
            image: 'account',
          },
          {
            title: 'ඔබේ පාසල සූදානම්',
            body: 'ඔබ පරිපාලක පුවරුවට පැමිණේ. ඊළඟට පන්ති, විෂයයන් සහ ගුරුවරුන් එක් කරන්න.',
            image: 'admin-dashboard',
          },
        ],
      },
    },
  },
  {
    slug: 'subjects',
    minutes: 2,
    youtube: { en: 'ZmBJSpzX0j0', si: 'd8mxd2vd_-c' },
    text: {
      en: {
        title: 'Add your subjects',
        summary: 'Set up one subject list for the whole school, in Sinhala and English.',
        steps: [
          { title: 'Open Subjects', body: 'Sign in as the school admin and open "Subjects" in the menu.', image: 'empty' },
          { title: 'Load the standard list', body: 'Click "Load standard Sri Lankan list". The usual subjects are added with Sinhala and English names. Change any name or short name right in the list. The short name is what fits in a timetable cell.', image: 'standard-list' },
          { title: 'Add a missing subject', body: 'Click "+ Add subject", type the name in English and Sinhala, and click "Add subject". The short name and colour are filled in for you.', image: 'add-subject' },
          { title: 'Next', body: 'Each grade picks its subjects from this list in Grade settings.' },
        ],
      },
      si: {
        title: 'විෂයයන් එක් කරන්න',
        summary: 'සිංහලෙන් සහ ඉංග්‍රීසියෙන්, මුළු පාසලටම එක් විෂය ලැයිස්තුවක් සකසන්න.',
        steps: [
          { title: 'විෂයයන් විවෘත කරන්න', body: 'පාසල් පරිපාලක ලෙස පිවිස මෙනුවේ "විෂයයන්" විවෘත කරන්න.', image: 'empty' },
          { title: 'සම්මත ලැයිස්තුව පූරණය කරන්න', body: '"ශ්‍රී ලංකාවේ සම්මත ලැයිස්තුව පූරණය කරන්න" ක්ලික් කරන්න. සුපුරුදු විෂයයන් සිංහල සහ ඉංග්‍රීසි නම් සමඟ එක් වේ. ඕනෑම නමක් හෝ කෙටි නමක් ලැයිස්තුවේම වෙනස් කළ හැක. කාලසටහන් කොටුවක දිස්වන්නේ කෙටි නමයි.', image: 'standard-list' },
          { title: 'අඩු විෂයක් එක් කරන්න', body: '"+ විෂයක් එක් කරන්න" ක්ලික් කර, නම ඉංග්‍රීසියෙන් සහ සිංහලෙන් ලියා "විෂය එක් කරන්න" ක්ලික් කරන්න. කෙටි නම සහ වර්ණය ස්වයංක්‍රීයව පිරේ.', image: 'add-subject' },
          { title: 'ඊළඟට', body: 'සෑම ශ්‍රේණියක්ම ශ්‍රේණි සැකසුම්වලදී මෙම ලැයිස්තුවෙන් විෂයයන් තෝරා ගනී.' },
        ],
      },
    },
  },
  {
    slug: 'grades',
    minutes: 2,
    youtube: { en: 'TJsmDk1zQJk', si: 'e0TriYtVBiQ' },
    text: {
      en: {
        title: 'Set up grades and classes',
        summary: 'Add each grade and its classes, and choose how many periods each subject gets in a week.',
        steps: [
          { title: 'Add a grade', body: 'Open "Grades & classes", click "+ Add grade", choose the grade and click "Add grade".' },
          { title: 'Add the classes', body: 'Click "+ Add class" once for each class. Each click adds the next one: 6A, 6B, 6C.', image: 'classes' },
          { title: 'Plan the subjects', body: 'Under "Subjects & periods per week", add each subject the grade learns and the number of periods it gets in a week. The total shows how much of the week is planned. All classes in the grade share this plan, and changes save automatically.', image: 'plan' },
        ],
      },
      si: {
        title: 'ශ්‍රේණි සහ පන්ති සකසන්න',
        summary: 'සෑම ශ්‍රේණියක්ම සහ එහි පන්ති එක් කර, සෑම විෂයකටම සතියකට කාලච්ඡේද කීයක් දැයි තෝරන්න.',
        steps: [
          { title: 'ශ්‍රේණියක් එක් කරන්න', body: '"ශ්‍රේණි සහ පන්ති" විවෘත කර, "+ ශ්‍රේණියක් එක් කරන්න" ක්ලික් කර, ශ්‍රේණිය තෝරා "ශ්‍රේණිය එක් කරන්න" ක්ලික් කරන්න.' },
          { title: 'පන්ති එක් කරන්න', body: 'සෑම පන්තියකටම "+ පන්තිය එක් කරන්න" එක් වරක් ක්ලික් කරන්න. සෑම ක්ලික් කිරීමකින්ම ඊළඟ පන්තිය එක් වේ: 6A, 6B, 6C.', image: 'classes' },
          { title: 'විෂයයන් සැලසුම් කරන්න', body: 'ශ්‍රේණිය ඉගෙන ගන්නා සෑම විෂයක්ම සහ එයට සතියකට ලැබෙන කාලච්ඡේද ගණන එක් කරන්න. සතියෙන් කොපමණ ප්‍රමාණයක් සැලසුම් කර ඇත්දැයි එකතුවෙන් පෙනේ. ශ්‍රේණියේ සියලු පන්ති මෙම සැලැස්ම බෙදා ගන්නා අතර වෙනස්කම් ස්වයංක්‍රීයව සුරැකේ.', image: 'plan' },
        ],
      },
    },
  },
  {
    slug: 'templates',
    minutes: 2,
    youtube: { en: 'YM9ZSlB6Q9U', si: '2IliGo3PIWg' },
    text: {
      en: {
        title: 'Set your school day with period templates',
        summary: 'Period templates hold the bell schedule: periods, times and intervals.',
        steps: [
          { title: 'Open the default template', body: 'Open "Period templates". Your school starts with a default template, and every class uses it unless you pick another one. Set "Day starts at" to your first bell. Each row is a period, an interval or an activity.', image: 'default-template' },
          { title: 'Set how long each row is', body: 'Change a row\'s minutes with − and +, or type a number. Sathiya works out every start and end time, so the rows after it move too. Then click "Save template".' },
          { title: 'Move or add rows', body: 'Drag a row by its ⋮⋮ handle to move it. Click "+ Insert" between two rows to add a period, interval or activity there. "+ Period" adds one at the end.' },
          { title: 'Make a template for a different day', body: 'For a short Friday or primary classes, click "+ New template", give it a name and click "Create template". Choose "Different per day" to give a day its own periods, then save. Pick which template a class uses in Grade settings.', image: 'per-day' },
        ],
      },
      si: {
        title: 'කාලච්ඡේද ආකෘති සමඟ පාසල් දිනය සකසන්න',
        summary: 'කාලච්ඡේද ආකෘතිවල සීනු කාලසටහන ඇත: කාලච්ඡේද, වේලාවන් සහ විවේක.',
        steps: [
          { title: 'පෙරනිමි ආකෘතිය විවෘත කරන්න', body: '"කාලච්ඡේද ආකෘති" විවෘත කරන්න. ඔබේ පාසල පෙරනිමි ආකෘතියකින් ආරම්භ වන අතර, වෙනත් එකක් තෝරා නොගන්නේ නම් සෑම පන්තියක්ම එය භාවිත කරයි. "දිනය ආරම්භ වන්නේ" ඔබේ පළමු සීනුවට සකසන්න. සෑම පේළියක්ම කාලච්ඡේදයක්, විවේකයක් හෝ ක්‍රියාකාරකමකි.', image: 'default-template' },
          { title: 'සෑම පේළියකම දිග සකසන්න', body: 'පේළියක මිනිත්තු − සහ + මඟින් වෙනස් කරන්න, නැතහොත් අංකයක් ලියන්න. සතිය සෑම ආරම්භක සහ අවසන් වේලාවක්ම ගණනය කරයි, එබැවින් පසුව ඇති පේළිද ඒ සමඟ ගමන් කරයි. ඉන්පසු "ආකෘතිය සුරකින්න" ක්ලික් කරන්න.' },
          { title: 'පේළි ගෙන යන්න හෝ එක් කරන්න', body: 'පේළියක් එහි ⋮⋮ හසුරුවෙන් අදිමින් ගෙන යන්න. පේළි දෙකක් අතර කාලච්ඡේදයක්, විවේකයක් හෝ ක්‍රියාකාරකමක් එක් කිරීමට "+ ඇතුළු කරන්න" ක්ලික් කරන්න. "+ කාලච්ඡේදය" අවසානයට එකක් එක් කරයි.' },
          { title: 'වෙනස් දිනයකට ආකෘතියක් සාදන්න', body: 'කෙටි සිකුරාදාවකට හෝ ප්‍රාථමික පන්තිවලට, "+ නව ආකෘතිය" ක්ලික් කර, නමක් දී "ආකෘතිය සාදන්න" ක්ලික් කරන්න. දිනයකට වෙනම කාලච්ඡේද දීමට "දිනපතා වෙනස්" තෝරා සුරකින්න. පන්තියක් භාවිත කරන ආකෘතිය ශ්‍රේණි සැකසුම්වලදී තෝරන්න.', image: 'per-day' },
        ],
      },
    },
  },
  {
    slug: 'teachers',
    minutes: 2,
    youtube: { en: '24CzDvT64Zw', si: 't-N2oY4sI_g' },
    text: {
      en: {
        title: 'Add and edit teachers',
        summary: 'Add each teacher with their staff ID, subjects, grades and daily limit.',
        steps: [
          { title: 'Add a teacher', body: 'Open "Teachers" and click "+ Add teacher". The staff ID is filled in from your school prefix. Type the name in English and Sinhala, without the title. Choose the subjects and grades they teach, and the most periods they can take in a day.', image: 'add-teacher' },
          { title: 'Save', body: 'Click "Save teacher". The teacher is added to the list. Later they can sign in with their own account using an invite link.', image: 'list' },
          { title: 'Edit a teacher', body: 'Click "Edit" on the row, change the details and save. With many teachers, import them all from an Excel sheet instead.' },
        ],
      },
      si: {
        title: 'ගුරුවරුන් එක් කිරීම සහ සංස්කරණය',
        summary: 'සෑම ගුරුවරයෙකුම සේවක අංකය, විෂයයන්, ශ්‍රේණි සහ දෛනික සීමාව සමඟ එක් කරන්න.',
        steps: [
          { title: 'ගුරුවරයෙකු එක් කරන්න', body: '"ගුරුවරුන්" විවෘත කර "+ ගුරුවරයෙකු එක් කරන්න" ක්ලික් කරන්න. ඔබේ පාසල් උපසර්ගයෙන් සේවක අංකය පිරේ. ගෞරව නාමය නොමැතිව නම ඉංග්‍රීසියෙන් සහ සිංහලෙන් ලියන්න. ඔවුන් උගන්වන විෂයයන්, ශ්‍රේණි සහ දිනකට ගත හැකි උපරිම කාලච්ඡේද ගණන තෝරන්න.', image: 'add-teacher' },
          { title: 'සුරකින්න', body: '"ගුරුවරයා සුරකින්න" ක්ලික් කරන්න. ගුරුවරයා ලැයිස්තුවට එක් වේ. පසුව ආරාධනා සබැඳියක් භාවිතයෙන් ඔවුන්ට තමන්ගේම ගිණුමකින් පිවිසිය හැක.', image: 'list' },
          { title: 'ගුරුවරයෙකු සංස්කරණය කරන්න', body: 'පේළියේ "සංස්කරණය" ක්ලික් කර විස්තර වෙනස් කර සුරකින්න. ගුරුවරුන් බොහෝ දෙනෙක් සිටී නම්, Excel පත්‍රිකාවකින් සියල්ලන්ම ආයාත කරන්න.' },
        ],
      },
    },
  },
  {
    slug: 'timetable-class',
    minutes: 2,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'Build the timetable by class',
        summary: 'Place lessons period by period. Sathiya stops teacher clashes for you.',
        steps: [
          { title: 'Choose a class', body: 'Open "By class" and choose a class. Empty periods have a "+", and the counter shows how much of the weekly plan is placed.', image: 'empty-class' },
          { title: 'Add a lesson', body: 'Click an empty period and choose the subject. Each subject shows how many periods it still needs. Then pick a teacher and click "Assign". Only teachers who are free in that period can be chosen.', image: 'teacher-picker' },
          { title: 'No clashes', body: 'A teacher who is teaching another class at that time is listed as not available, with the class they are in.', image: 'clash' },
          { title: 'Pin mode', body: 'After Assign, pin mode stays on so you can click more free periods for the same lesson. Click "Done" when finished. Changes save as you go.', image: 'placed' },
        ],
      },
      si: {
        title: 'පන්ති අනුව කාලසටහන සකසන්න',
        summary: 'කාලච්ඡේදයෙන් කාලච්ඡේදයට පාඩම් තබන්න. ගුරු ගැටුම් සතිය වළක්වයි.',
        steps: [
          { title: 'පන්තියක් තෝරන්න', body: '"පන්ති අනුව" විවෘත කර පන්තියක් තෝරන්න. හිස් කාලච්ඡේදවල "+" ඇති අතර, සතියේ සැලැස්මෙන් කොපමණ ප්‍රමාණයක් තබා ඇත්දැයි ගණකයෙන් පෙනේ.', image: 'empty-class' },
          { title: 'පාඩමක් එක් කරන්න', body: 'හිස් කාලච්ඡේදයක් ක්ලික් කර විෂය තෝරන්න. සෑම විෂයකටම තව කාලච්ඡේද කීයක් අවශ්‍යදැයි පෙන්වයි. ඉන්පසු ගුරුවරයෙකු තෝරා "පවරන්න" ක්ලික් කරන්න. එම කාලච්ඡේදයේ නිදහස් ගුරුවරුන් පමණක් තෝරාගත හැක.', image: 'teacher-picker' },
          { title: 'ගැටුම් නැත', body: 'එම වේලාවේ වෙනත් පන්තියකට උගන්වන ගුරුවරයෙකු, ඔවුන් සිටින පන්තිය සමඟ නොමැති ලෙස පෙන්වයි.', image: 'clash' },
          { title: 'ඇමිණීමේ ක්‍රමය', body: 'පැවරීමෙන් පසු ඇමිණීමේ ක්‍රමය සක්‍රියව පවතින බැවින්, එම පාඩමටම තවත් නිදහස් කාලච්ඡේද ක්ලික් කළ හැක. අවසන් වූ විට "අවසන්" ක්ලික් කරන්න. වෙනස්කම් ඔබ වැඩ කරන විට සුරැකේ.', image: 'placed' },
        ],
      },
    },
  },
];

export const guide = (slug: GuideSlug): Guide => guides.find((g) => g.slug === slug)!;
