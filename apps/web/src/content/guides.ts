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

export const GUIDE_ORDER = [
  'register-school',
  'profile',
  'members',
  'subjects',
  'grades',
  'templates',
  'teachers',
  'import',
  'timetable-class',
  'timetable-teacher',
  'autofill',
  'publish-print',
  'teacher-phone',
] as const;

export type GuideSlug = (typeof GUIDE_ORDER)[number];

export interface Guide {
  slug: GuideSlug;
  minutes: number;
  portrait?: boolean;
  youtube: Record<Lang, string>;
  text: Record<Lang, GuideText>;
}

const list: Guide[] = [
  {
    slug: 'register-school',
    minutes: 3,
    youtube: { en: 'Y5K3s1phDyc', si: '_PPvqwqfAWY' },
    text: {
      en: {
        title: 'Register your school',
        summary: 'Create your school on Sathiya and become its first admin. It is free.',
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
        summary: 'සතිය හි ඔබේ පාසල සාදා එහි පළමු පරිපාලක වන්න. සම්පූර්ණයෙන්ම නොමිලේ.',
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
  {
    slug: 'profile',
    minutes: 1,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'School profile, logo and colours',
        summary: 'Change your school details, logo and colours at any time.',
        steps: [
          { title: 'Open the profile', body: 'Open "School profile & colours". The school name comes from registration. To change it, click "Request a name change" and Sathiya checks it first.', image: 'profile' },
          { title: 'Add details and your logo', body: 'Add the phone number and address. Upload a square PNG, JPEG or WebP logo up to 1 MB.' },
          { title: 'Pick colours and save', body: 'Choose the primary and second colours. The preview shows how timetables and buttons will look. Click "Save changes".', image: 'colours' },
        ],
      },
      si: {
        title: 'පාසල් තොරතුරු, ලාංඡනය සහ වර්ණ',
        summary: 'ඕනෑම වේලාවක පාසලේ විස්තර, ලාංඡනය සහ වර්ණ වෙනස් කරන්න.',
        steps: [
          { title: 'පැතිකඩ විවෘත කරන්න', body: '"පාසල් තොරතුරු සහ වර්ණ" විවෘත කරන්න. පාසලේ නම ලියාපදිංචියේදී ලැබේ. එය වෙනස් කිරීමට "නම වෙනස් කිරීමට ඉල්ලන්න" ක්ලික් කරන්න, සතිය මුලින්ම එය පරීක්ෂා කරයි.', image: 'profile' },
          { title: 'විස්තර සහ ලාංඡනය එක් කරන්න', body: 'දුරකථන අංකය සහ ලිපිනය එක් කරන්න. 1 MB දක්වා සමචතුරස්‍ර PNG, JPEG හෝ WebP ලාංඡනයක් උඩුගත කරන්න.' },
          { title: 'වර්ණ තෝරා සුරකින්න', body: 'ප්‍රධාන සහ දෙවන වර්ණ තෝරන්න. කාලසටහන් සහ බොත්තම් පෙනෙන ආකාරය පෙරදසුනේ පෙනේ. "වෙනස්කම් සුරකින්න" ක්ලික් කරන්න.', image: 'colours' },
        ],
      },
    },
  },
  {
    slug: 'members',
    minutes: 1,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'Invite another admin',
        summary: 'A deputy principal or timetable teacher can help as an admin too.',
        steps: [
          { title: 'Open Members', body: 'Open "Members". It lists everyone who can sign in to your school.', image: 'members' },
          { title: 'Send an invite', body: 'Click "Invite admin", type their email and click "Send invite". If they also teach, link them to their teacher record.', image: 'invite' },
          { title: 'Pending invites', body: 'The invite shows under "Pending invites" until they sign in with that email. You can cancel it any time. Teachers do not need an invite here. They join with the link on the Teachers page.', image: 'pending' },
        ],
      },
      si: {
        title: 'තවත් පරිපාලකයෙකුට ආරාධනා කරන්න',
        summary: 'නියෝජ්‍ය විදුහල්පතිවරයෙකුට හෝ කාලසටහන් ගුරුවරයෙකුටත් පරිපාලක ලෙස උදව් කළ හැක.',
        steps: [
          { title: 'සාමාජිකයන් විවෘත කරන්න', body: '"සාමාජිකයන්" විවෘත කරන්න. ඔබේ පාසලට පිවිසිය හැකි සැමදෙනාම එහි ලැයිස්තුගත වේ.', image: 'members' },
          { title: 'ආරාධනාවක් යවන්න', body: '"පරිපාලකයෙකු ආරාධනා කරන්න" ක්ලික් කර, ඔවුන්ගේ විද්‍යුත් තැපෑල ලියා "ආරාධනය යවන්න" ක්ලික් කරන්න. ඔවුන් උගන්වන්නේ නම්, ඔවුන්ගේ ගුරු වාර්තාවට සම්බන්ධ කරන්න.', image: 'invite' },
          { title: 'පොරොත්තු ආරාධනා', body: 'ඔවුන් එම විද්‍යුත් තැපෑලෙන් පිවිසෙන තුරු ආරාධනාව "පොරොත්තු ආරාධනා" යටතේ පෙනේ. ඕනෑම වේලාවක එය අවලංගු කළ හැක. ගුරුවරුන්ට මෙහි ආරාධනාවක් අවශ්‍ය නැත. ඔවුන් ගුරුවරුන් පිටුවේ සබැඳියෙන් සම්බන්ධ වේ.', image: 'pending' },
        ],
      },
    },
  },
  {
    slug: 'import',
    minutes: 2,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'Import teachers from Excel',
        summary: 'Add all your teachers and subjects at once from one file.',
        steps: [
          { title: 'Download the template', body: 'Open "Teachers", click "Import", then "Download Excel template". It has a Teachers sheet, a Subjects sheet with common subjects filled in, and instructions.', image: 'template' },
          { title: 'Fill it in', body: 'One row per teacher: title, name, subjects, grades and daily limit. Staff IDs can be left empty. Sathiya adds them. If you save a CSV from Excel, choose "CSV UTF-8" so Sinhala text is kept.' },
          { title: 'Check and import', body: 'Click "Choose file" and pick the file. You see exactly what will be added, and any mistakes, before anything is saved. Click "Import". Import only adds. Nothing already saved is changed.', image: 'preview' },
          { title: 'Done', body: 'The teachers are in the list with staff IDs.', image: 'list' },
        ],
      },
      si: {
        title: 'Excel වලින් ගුරුවරුන් ආයාත කරන්න',
        summary: 'එක් ගොනුවකින් ඔබේ සියලු ගුරුවරුන් සහ විෂයයන් එකවර එක් කරන්න.',
        steps: [
          { title: 'සැකිල්ල බාගන්න', body: '"ගුරුවරුන්" විවෘත කර "ගොනුවකින් ඇතුළත් කරන්න" ක්ලික් කර, "Excel සැකිල්ල බාගන්න" ක්ලික් කරන්න. එහි ගුරුවරුන් පත්‍රිකාවක්, සුපුරුදු විෂයයන් පුරවා ඇති විෂය පත්‍රිකාවක් සහ උපදෙස් ඇත.', image: 'template' },
          { title: 'එය පුරවන්න', body: 'එක් ගුරුවරයෙකුට එක් පේළියක්: ගෞරව නාමය, නම, විෂයයන්, ශ්‍රේණි සහ දෛනික සීමාව. සේවක අංක හිස්ව තැබිය හැක. සතිය ඒවා එක් කරයි. Excel වලින් CSV ලෙස සුරකින්නේ නම්, සිංහල අකුරු රැකීමට "CSV UTF-8" තෝරන්න.' },
          { title: 'පරීක්ෂා කර ආයාත කරන්න', body: '"ගොනුව තෝරන්න" ක්ලික් කර ගොනුව තෝරන්න. කිසිවක් සුරැකීමට පෙර එක් කරන දේ සහ වැරදි හරියටම පෙනේ. "ඇතුළත් කරන්න" ක්ලික් කරන්න. ආයාත කිරීම එක් කිරීම පමණක් කරයි. දැනටමත් සුරැකි කිසිවක් වෙනස් නොවේ.', image: 'preview' },
          { title: 'අවසන්', body: 'ගුරුවරුන් සේවක අංක සමඟ ලැයිස්තුවේ ඇත.', image: 'list' },
        ],
      },
    },
  },
  {
    slug: 'timetable-teacher',
    minutes: 2,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'The timetable by teacher',
        summary: 'See each teacher\'s week and daily load, and give them lessons.',
        steps: [
          { title: 'Open a teacher\'s week', body: 'Open "By teacher" and choose a teacher. The meters show how many periods they teach each day against their daily limit.', image: 'week' },
          { title: 'Give a lesson', body: 'Click an empty period, choose the subject, then the class. Classes that are busy at that time are marked with the lesson they already have. Click "Assign".', image: 'choose-class' },
          { title: 'Pin mode', body: 'The class week is laid over the teacher\'s, so you can pin more lessons where both are free. Click "Done" when finished. Use "Print" for a teacher\'s own timetable sheet.', image: 'pin' },
        ],
      },
      si: {
        title: 'ගුරුවරුන් අනුව කාලසටහන',
        summary: 'සෑම ගුරුවරයෙකුගේම සතිය සහ දෛනික කාර්ය භාරය බලා, ඔවුන්ට පාඩම් ලබා දෙන්න.',
        steps: [
          { title: 'ගුරුවරයෙකුගේ සතිය විවෘත කරන්න', body: '"ගුරුවරුන් අනුව" විවෘත කර ගුරුවරයෙකු තෝරන්න. ඔවුන් දිනකට උගන්වන කාලච්ඡේද ගණන දෛනික සීමාවට සාපේක්ෂව මීටර්වලින් පෙනේ.', image: 'week' },
          { title: 'පාඩමක් දෙන්න', body: 'හිස් කාලච්ඡේදයක් ක්ලික් කර, විෂය සහ පසුව පන්තිය තෝරන්න. එම වේලාවේ කාර්යබහුල පන්ති, ඒවාට දැනටමත් ඇති පාඩම සමඟ සලකුණු කර ඇත. "පවරන්න" ක්ලික් කරන්න.', image: 'choose-class' },
          { title: 'ඇමිණීමේ ක්‍රමය', body: 'පන්තියේ සතිය ගුරුවරයාගේ සතිය මත පෙන්වන බැවින්, දෙදෙනාම නිදහස් තැන්වල තවත් පාඩම් ඇමිණිය හැක. අවසන් වූ විට "අවසන්" ක්ලික් කරන්න. ගුරුවරයෙකුගේම කාලසටහන් පත්‍රිකාවට "මුද්‍රණය" භාවිත කරන්න.', image: 'pin' },
        ],
      },
    },
  },
  {
    slug: 'autofill',
    minutes: 2,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'Auto-fill the whole timetable',
        summary: 'Sathiya places every lesson for every class in seconds, without clashes.',
        steps: [
          { title: 'Check the setup', body: 'Open "By class" and click "Auto-fill". Sathiya checks grades, classes, teachers and templates first, and tells you what to fix if something is missing.', image: 'ready' },
          { title: 'Generate', body: 'Click "Continue". "Fill around" keeps every lesson you already placed and fills only what is missing. Click "Generate timetable".' },
          { title: 'Check the preview', body: 'Nothing is saved yet. The Allocation tab shows who teaches each subject in each class. Change a teacher there if needed. The Classes tab shows each class\'s new timetable.', image: 'preview' },
          { title: 'Save', body: 'Click "Save". You can still change any lesson by hand, then publish to teachers.', image: 'saved' },
        ],
      },
      si: {
        title: 'මුළු කාලසටහනම ස්වයංක්‍රීයව පුරවන්න',
        summary: 'සතිය සෑම පන්තියකටම සෑම පාඩමක්ම තත්පර කිහිපයකින්, ගැටුම් නොමැතිව තබයි.',
        steps: [
          { title: 'සැකසුම පරීක්ෂා කරන්න', body: '"පන්ති අනුව" විවෘත කර "ස්වයංක්‍රීයව පුරවන්න" ක්ලික් කරන්න. සතිය මුලින්ම ශ්‍රේණි, පන්ති, ගුරුවරුන් සහ ආකෘති පරීක්ෂා කර, යමක් අඩු නම් නිවැරදි කළ යුත්තේ කුමක්දැයි පවසයි.', image: 'ready' },
          { title: 'සාදන්න', body: '"ඉදිරියට" ක්ලික් කරන්න. "වටේට පුරවන්න" ඔබ දැනටමත් තැබූ සෑම පාඩමක්ම තබාගෙන අඩු දේ පමණක් පුරවයි. "කාලසටහන සාදන්න" ක්ලික් කරන්න.' },
          { title: 'පෙරදසුන පරීක්ෂා කරන්න', body: 'තවම කිසිවක් සුරැකී නැත. එක් එක් පන්තියේ සෑම විෂයක්ම උගන්වන්නේ කවුදැයි "ගුරු පැවරීම" ටැබයේ පෙනේ. අවශ්‍ය නම් එහිදී ගුරුවරයා වෙනස් කරන්න. "පන්ති" ටැබයේ එක් එක් පන්තියේ නව කාලසටහන පෙනේ.', image: 'preview' },
          { title: 'සුරකින්න', body: '"සුරකින්න" ක්ලික් කරන්න. ඕනෑම පාඩමක් තවමත් අතින් වෙනස් කර, පසුව ගුරුවරුන්ට ප්‍රකාශයට පත් කළ හැක.', image: 'saved' },
        ],
      },
    },
  },
  {
    slug: 'publish-print',
    minutes: 2,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'Publish and print the timetable',
        summary: 'Make the timetable live for teachers, then print class and teacher sheets.',
        steps: [
          { title: 'Publish', body: 'Until you publish, the timetable is a draft only admins see. On the dashboard click "Publish to teachers". Sathiya checks for problems like incomplete classes or clashes. Then click "Publish".', image: 'dashboard' },
          { title: 'Teachers see it', body: 'Teachers now see their timetable on their phones. If you change something later, publish again.', image: 'published' },
          { title: 'Print', body: 'Open a class in "By class" and click "Print" for a clean A4 sheet with your school name, logo and colours. Print it or save it as a PDF. Teacher timetables print the same way from "By teacher".', image: 'class-sheet' },
        ],
      },
      si: {
        title: 'කාලසටහන ප්‍රකාශ කර මුද්‍රණය කරන්න',
        summary: 'කාලසටහන ගුරුවරුන්ට ලබා දී, පසුව පන්ති සහ ගුරු පත්‍රිකා මුද්‍රණය කරන්න.',
        steps: [
          { title: 'ප්‍රකාශ කරන්න', body: 'ප්‍රකාශ කරන තුරු කාලසටහන පරිපාලකයින්ට පමණක් පෙනෙන කෙටුම්පතකි. පුවරුවේ "ගුරුවරුන්ට ප්‍රකාශ කරන්න" ක්ලික් කරන්න. සතිය අසම්පූර්ණ පන්ති හෝ ගැටුම් වැනි ගැටලු පරීක්ෂා කරයි. ඉන්පසු "ප්‍රකාශ කරන්න" ක්ලික් කරන්න.', image: 'dashboard' },
          { title: 'ගුරුවරුන්ට පෙනේ', body: 'ගුරුවරුන්ට දැන් තම දුරකථනවල කාලසටහන පෙනේ. පසුව යමක් වෙනස් කළහොත්, නැවත ප්‍රකාශ කරන්න.', image: 'published' },
          { title: 'මුද්‍රණය', body: '"පන්ති අනුව" තුළ පන්තියක් විවෘත කර "මුද්‍රණය" ක්ලික් කරන්න. ඔබේ පාසල් නම, ලාංඡනය සහ වර්ණ සහිත A4 පත්‍රිකාවක් ලැබේ. එය මුද්‍රණය කරන්න, නැතහොත් PDF ලෙස සුරකින්න. ගුරු කාලසටහන්ද "ගුරුවරුන් අනුව" තුළින් එලෙසම මුද්‍රණය කළ හැක.', image: 'class-sheet' },
        ],
      },
    },
  },
  {
    slug: 'teacher-phone',
    minutes: 1,
    portrait: true,
    youtube: { en: '', si: '' },
    text: {
      en: {
        title: 'For teachers: your timetable on your phone',
        summary: 'Join your school once, then see your day at a glance.',
        steps: [
          { title: 'Open the join link', body: 'Your school admin shares a join link, for example on WhatsApp. Open it on your phone.', image: 'join' },
          { title: 'Sign in', body: 'Click "Continue with Google" with the email your school has for you. You can also use an email and password.' },
          { title: 'Today', body: '"Today" shows the lesson happening now, the minutes left, and the rest of your day.', image: 'now' },
          { title: 'Timetable', body: 'Tap "Timetable" for your full timetable, and switch between Day, 3 days and Week.', image: 'week' },
          { title: 'My class', body: 'Class teachers see their class\'s week under "My class", including who covers a lesson when a teacher is away.', image: 'my-class' },
          { title: 'Me', body: '"Me" has your details and phone number, how many periods you teach, and a button to print your timetable. When the school publishes changes or plans relief for you, you see it in the app.', image: 'me' },
        ],
      },
      si: {
        title: 'ගුරුවරුන් සඳහා: ඔබේ දුරකථනයේ ඔබේ කාලසටහන',
        summary: 'එක් වරක් ඔබේ පාසලට සම්බන්ධ වී, ඔබේ දිනය එක බැල්මකින් බලන්න.',
        steps: [
          { title: 'සම්බන්ධ වීමේ සබැඳිය විවෘත කරන්න', body: 'ඔබේ පාසල් පරිපාලක සම්බන්ධ වීමේ සබැඳියක් බෙදා ගනී, උදා. WhatsApp හරහා. එය ඔබේ දුරකථනයේ විවෘත කරන්න.', image: 'join' },
          { title: 'පිවිසෙන්න', body: 'ඔබේ පාසල ඔබ සඳහා භාවිත කරන විද්‍යුත් තැපෑල සමඟ "Google සමඟ ඉදිරියට යන්න" ක්ලික් කරන්න. විද්‍යුත් තැපෑල සහ මුරපදයක්ද භාවිත කළ හැක.' },
          { title: 'අද', body: '"අද" තුළ දැන් සිදුවන පාඩම, ඉතිරි මිනිත්තු සහ ඔබේ දිනයේ ඉතිරිය පෙනේ.', image: 'now' },
          { title: 'කාලසටහන', body: 'ඔබේ සම්පූර්ණ කාලසටහනට "කාලසටහන" තට්ටු කර, දිනය, දින 3 සහ සතිය අතර මාරු වන්න.', image: 'week' },
          { title: 'මගේ පන්තිය', body: 'පන්ති භාර ගුරුවරුන්ට "මගේ පන්තිය" යටතේ තම පන්තියේ සතිය පෙනේ, ගුරුවරයෙකු නොපැමිණි විට පාඩම බාරගන්නේ කවුදැයි ද ඇතුළුව.', image: 'my-class' },
          { title: 'මම', body: '"මම" තුළ ඔබේ විස්තර සහ දුරකථන අංකය, ඔබ උගන්වන කාලච්ඡේද ගණන සහ ඔබේ කාලසටහන මුද්‍රණය කිරීමට බොත්තමක් ඇත. පාසල වෙනස්කම් ප්‍රකාශයට පත් කළ විට හෝ ඔබට ආදේශක කාලච්ඡේද සැලසූ විට, ඔබට එය යෙදුමේ පෙනේ.', image: 'me' },
        ],
      },
    },
  },
];

export const guides: Guide[] = GUIDE_ORDER.map((slug) => list.find((g) => g.slug === slug)!);

export const guide = (slug: GuideSlug): Guide => guides.find((g) => g.slug === slug)!;
