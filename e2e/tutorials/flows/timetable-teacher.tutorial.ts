// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('timetable by teacher', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('timetable-teacher');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('timetable', k, v);
  const day = (d: number) => tut.t('common', `days.long.${d}`);
  const science = lang === 'si' ? 'විද්‍යාව' : 'Science';
  const { email } = await demoSchool('timetable-teacher', lang, lang === 'si' ? '99986' : '99985', 'full');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'The timetable by teacher', si: 'ගුරුවරුන් අනුව කාලසටහන' },
    { en: "See each teacher's week, their daily load, and give them lessons.", si: 'සෑම ගුරුවරයෙකුගේම සතිය සහ දෛනික කාර්ය භාරය බලා, ඔවුන්ට පාඩම් ලබා දෙන්න.' },
  );

  await tut.say({ en: 'Open "By teacher" in the menu and choose a teacher.', si: 'මෙනුවේ "ගුරුවරුන් අනුව" විවෘත කර ගුරුවරයෙකු තෝරන්න.' }, 1800);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.byTeacher'), exact: true }), 1000);
  await tut.click(page.getByRole('button', { name: t('teacherView.teacherLabel'), exact: true }), 600);
  await tut.click(page.getByRole('option', { name: /S\. Gunasekara/ }), 1200);

  await tut.say({
    en: "This is Mrs. S. Gunasekara's week across all her classes. The meters show how many periods she teaches each day against her daily limit.",
    si: 'මෙය S. ගුණසේකර මහත්මියගේ සියලු පන්ති සමඟ ඇගේ සතියයි. ඇය දිනකට උගන්වන කාලච්ඡේද ගණන ඇගේ දෛනික සීමාවට සාපේක්ෂව මීටර්වලින් පෙනේ.',
  });
  await tut.still('week');

  await tut.say({
    en: 'To give her a lesson, click an empty period and choose the subject.',
    si: 'ඇයට පාඩමක් දීමට, හිස් කාලච්ඡේදයක් ක්ලික් කර විෂය තෝරන්න.',
  }, 2000);
  await tut.click(page.getByRole('button', { name: tut.rx('timetable', 'grid.cellAdd', { day: day(0), n: 1 }) }));
  await tut.click(page.getByRole('dialog').getByRole('option', { name: new RegExp(`^${science}`) }).first());

  const classes = page.getByRole('dialog', { name: t('teacherPicker.titleClass') });
  await expect(classes).toBeVisible();
  await tut.say({
    en: 'Then choose the class. Classes that are busy at this time are marked, with the lesson they already have.',
    si: 'ඉන්පසු පන්තිය තෝරන්න. මේ වේලාවේ කාර්යබහුල පන්ති, ඒවාට දැනටමත් ඇති පාඩම සමඟ සලකුණු කර ඇත.',
  });
  await tut.still('choose-class');
  await tut.click(classes.getByRole('option', { name: /^6C/ }), 600);
  await tut.click(classes.getByRole('button', { name: t('picker.assign') }));
  await expect(classes).toBeHidden();

  const pin = page.getByRole('region', { name: t('pin.mode') });
  await expect(pin).toBeVisible();
  await tut.say({
    en: "Now 6C's week is laid over hers, so you can pin more Science lessons where both are free. Click \"Done\" when finished.",
    si: 'දැන් 6C පන්තියේ සතිය ඇගේ සතිය මත පෙන්වයි, එබැවින් දෙදෙනාම නිදහස් තැන්වල තවත් විද්‍යාව පාඩම් ඇමිණිය හැක. අවසන් වූ විට "අවසන්" ක්ලික් කරන්න.',
  });
  await tut.still('pin');
  await tut.click(pin.getByRole('button', { name: t('pin.done') }), 1200);

  await tut.say({
    en: 'The lesson shows in both her timetable and the class timetable. Use "Print" for a teacher\'s own timetable sheet.',
    si: 'පාඩම ඇගේ කාලසටහනේ සහ පන්ති කාලසටහනේ යන දෙකෙහිම පෙනේ. ගුරුවරයෙකුගේම කාලසටහන් පත්‍රිකාවට "මුද්‍රණය" භාවිත කරන්න.',
  });
  await tut.card(
    { en: 'Teacher timetables done', si: 'ගුරු කාලසටහන් අවසන්' },
    { en: 'Next: let auto-fill build the whole week for you.', si: 'ඊළඟට: ස්වයංක්‍රීය පිරවීමෙන් මුළු සතියම සකසන්න.' },
  );
  await tut.finish();
});
