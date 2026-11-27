// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { entries, T } from '@sathiya/core/fixtures';
import { demoSchool, EMPTY_CLASS, signIn } from '../demo';
import { test } from '../kit';

// First period in the week where one of the Grade 6 maths teachers is free.
function freeMathsSlot(): { day: number; n: number } {
  const others = entries.filter((e) => !e.classIds.includes(EMPTY_CLASS));
  for (let n = 1; n <= 7; n++)
    for (let day = 0; day < 5; day++) {
      const busy = new Set(others.filter((e) => e.day === day && e.period === n).flatMap((e) => e.lessons.map((l) => l.teacherId)));
      if (!busy.has(T.bandara) || !busy.has(T.perera)) return { day, n };
    }
  throw new Error('no free maths slot');
}

test('timetable by class', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('timetable-class');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('timetable', k, v);
  const day = (d: number) => tut.t('common', `days.long.${d}`);
  const maths = lang === 'si' ? 'ගණිතය' : 'Mathematics';
  const science = lang === 'si' ? 'විද්‍යාව' : 'Science';
  const { email } = await demoSchool('timetable', lang, lang === 'si' ? '99981' : '99980', 'full');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Build the timetable by class', si: 'පන්ති අනුව කාලසටහන සකසන්න' },
    { en: 'Place lessons period by period. Sathiya stops teacher clashes for you.', si: 'කාලච්ඡේදයෙන් කාලච්ඡේදයට පාඩම් තබන්න. ගුරු ගැටුම් සතිය වළක්වයි.' },
  );

  await tut.say({ en: 'Open "By class" in the menu and choose a class.', si: 'මෙනුවේ "පන්ති අනුව" විවෘත කර පන්තියක් තෝරන්න.' }, 1800);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.byClass'), exact: true }));
  await tut.click(page.getByRole('combobox', { name: t('classView.classLabel') }), 600);
  await tut.click(page.getByRole('option', { name: tut.rx('timetable', 'classView.classOption', { grade: 6, name: '6C' }) }), 1000);
  await expect(page).toHaveURL(/\/class\/c-6c$/);

  await tut.say({
    en: 'This is the week for class 6C. Empty periods have a "+". The counter shows how much of the weekly plan is placed.',
    si: 'මෙය 6C පන්තියේ සතියයි. හිස් කාලච්ඡේදවල "+" ඇත. සතියේ සැලැස්මෙන් කොපමණ ප්‍රමාණයක් තබා ඇත්දැයි ගණකයෙන් පෙනේ.',
  });
  await tut.still('empty-class');

  await tut.say({ en: 'Click an empty period and choose the subject.', si: 'හිස් කාලච්ඡේදයක් ක්ලික් කර විෂය තෝරන්න.' }, 1800);
  const slot = freeMathsSlot();
  await tut.click(page.getByRole('button', { name: tut.rx('timetable', 'grid.cellAdd', { day: day(slot.day), n: slot.n }) }));
  const subjectPicker = page.getByRole('dialog', { name: t('picker.titleSubject') });
  await tut.say({
    en: 'Each subject shows how many periods it still needs this week.',
    si: 'සෑම විෂයකටම මෙම සතියේ තව කාලච්ඡේද කීයක් අවශ්‍යදැයි පෙන්වයි.',
  }, 2000);
  await tut.click(subjectPicker.getByRole('option', { name: new RegExp(`^${maths}`) }));

  const teacherPicker = page.getByRole('dialog', { name: t('picker.titleTeacher') });
  await tut.say({
    en: 'Then pick the teacher. Only teachers who are free in this period can be chosen.',
    si: 'ඉන්පසු ගුරුවරයා තෝරන්න. මෙම කාලච්ඡේදයේ නිදහස් ගුරුවරුන් පමණක් තෝරාගත හැක.',
  });
  await tut.still('teacher-picker');
  await tut.click(teacherPicker.getByRole('option').first(), 600);
  await tut.click(teacherPicker.getByRole('button', { name: t('picker.assign') }));
  await expect(teacherPicker).toBeHidden();

  const pin = page.getByRole('region', { name: t('pin.mode') });
  await expect(pin).toBeVisible();
  await tut.say({
    en: 'Pin mode stays on, so you can click more free periods to place the same lesson quickly. Click "Done" when finished.',
    si: 'ඇමිණීමේ ක්‍රමය සක්‍රියව පවතී, එබැවින් එම පාඩමම ඉක්මනින් තැබීමට තවත් නිදහස් කාලච්ඡේද ක්ලික් කළ හැක. අවසන් වූ විට "අවසන්" ක්ලික් කරන්න.',
  });
  await tut.click(pin.getByRole('button', { name: t('pin.done') }), 1200);

  await tut.say({
    en: 'Now try Science on Wednesday, period 4.',
    si: 'දැන් බදාදා, 4 වන කාලච්ඡේදයට විද්‍යාව උත්සාහ කරන්න.',
  }, 1800);
  await tut.click(page.getByRole('button', { name: tut.rx('timetable', 'grid.cellAdd', { day: day(2), n: 4 }) }));
  await tut.click(subjectPicker.getByRole('option', { name: new RegExp(`^${science}`) }));
  const busy = teacherPicker.getByRole('listitem').filter({ hasText: 'N. Perera' });
  await busy.scrollIntoViewIfNeeded();
  await tut.say({
    en: 'Mrs. N. Perera is teaching 6A at this time, so she is shown as not available. A teacher can never be in two classes at once.',
    si: 'එන්. පෙරේරා මහත්මිය මේ වේලාවේ 6A පන්තියට උගන්වයි, එබැවින් ඇය නොමැති ලෙස පෙන්වයි. ගුරුවරයෙකුට එකවර පන්ති දෙකක සිටිය නොහැක.',
  });
  await tut.still('clash');
  await tut.say({
    en: 'Mrs. S. Gunasekara is free, so choose her and click "Assign".',
    si: 'එස්. ගුණසේකර මහත්මිය නිදහස් බැවින් ඇයව තෝරා "පවරන්න" ක්ලික් කරන්න.',
  }, 2000);
  await tut.click(teacherPicker.getByRole('option', { name: /S\. Gunasekara/ }), 600);
  await tut.click(teacherPicker.getByRole('button', { name: t('picker.assign') }));
  await expect(teacherPicker).toBeHidden();
  await tut.click(pin.getByRole('button', { name: t('pin.done') }), 1200);
  await tut.still('placed');

  await tut.say({
    en: 'Changes save as you go. When every class is ready, publish the timetable so teachers can see it.',
    si: 'වෙනස්කම් ඔබ වැඩ කරන විට සුරැකේ. සියලු පන්ති සූදානම් වූ පසු ගුරුවරුන්ට පෙනෙන ලෙස කාලසටහන ප්‍රකාශයට පත් කරන්න.',
  });
  await tut.card(
    { en: 'You can build a timetable', si: 'දැන් ඔබට කාලසටහනක් සැකසිය හැක' },
    { en: 'Next: let auto-fill build the whole week for you.', si: 'ඊළඟට: ස්වයංක්‍රීය පිරවීමෙන් මුළු සතියම සකසන්න.' },
  );
  await tut.finish();
});
