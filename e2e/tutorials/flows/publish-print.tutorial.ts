// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { autoFill, demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('publish and print', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('publish-print');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('dashboard', k, v);
  const { email, sid } = await demoSchool('publish-print', lang, lang === 'si' ? '99988' : '99987', 'clean');
  // Print sheets open in a new tab; keep them in the recorded one.
  await page.addInitScript(() => {
    window.print = () => undefined;
    window.open = (url?: string | URL) => {
      if (url) location.href = String(url);
      return null;
    };
  });
  await signIn(page, tut, email);
  await autoFill(page, tut, sid);
  await page.waitForTimeout(1500);

  await tut.start();
  await tut.card(
    { en: 'Publish and print the timetable', si: 'කාලසටහන ප්‍රකාශ කර මුද්‍රණය කරන්න' },
    { en: 'Make the timetable live for teachers, then print class and teacher sheets.', si: 'කාලසටහන ගුරුවරුන්ට ලබා දී, පසුව පන්ති සහ ගුරු පත්‍රිකා මුද්‍රණය කරන්න.' },
  );

  await tut.say({
    en: 'Until you publish, the timetable is a draft that only admins can see. On the dashboard, click "Publish to teachers".',
    si: 'ප්‍රකාශ කරන තුරු, කාලසටහන පරිපාලකයින්ට පමණක් පෙනෙන කෙටුම්පතකි. පුවරුවේ "ගුරුවරුන්ට ප්‍රකාශ කරන්න" ක්ලික් කරන්න.',
  });
  await tut.still('dashboard');
  await tut.click(page.getByRole('button', { name: t('publish.button') }));
  const dialog = page.getByRole('dialog', { name: t('publish.title', { year: '2027' }) });
  await tut.say({
    en: 'Sathiya checks for problems first, like incomplete classes or clashes. Then click "Publish".',
    si: 'සතිය මුලින්ම අසම්පූර්ණ පන්ති හෝ ගැටුම් වැනි ගැටලු පරීක්ෂා කරයි. ඉන්පසු "ප්‍රකාශ කරන්න" ක්ලික් කරන්න.',
  }, 2400);
  await tut.click(dialog.getByRole('button', { name: t('publish.confirm'), exact: true }), 1500);
  await expect(dialog).toBeHidden({ timeout: 20_000 });

  await tut.say({
    en: 'Published. Teachers now see their timetable on their phones. If you change something later, publish again.',
    si: 'ප්‍රකාශයට පත් විය. ගුරුවරුන්ට දැන් තම දුරකථනවල කාලසටහන පෙනේ. පසුව යමක් වෙනස් කළහොත්, නැවත ප්‍රකාශ කරන්න.',
  });
  await tut.still('published');

  await tut.say({ en: 'To print a class timetable, open the class and click "Print".', si: 'පන්ති කාලසටහනක් මුද්‍රණය කිරීමට, පන්තිය විවෘත කර "මුද්‍රණය" ක්ලික් කරන්න.' }, 2200);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.byClass'), exact: true }), 1200);
  await tut.click(page.getByRole('combobox', { name: tut.t('timetable', 'classView.classLabel') }), 600);
  await tut.click(page.getByRole('option', { name: tut.rx('timetable', 'classView.classOption', { grade: 6, name: '6A' }) }), 1000);
  await tut.click(page.getByRole('main').getByRole('button', { name: tut.t('timetable', 'classView.print'), exact: true }), 1500);
  await expect(page.getByRole('heading', { name: tut.t('print', 'sheet.classTitle', { grade: 6, name: '6A' }) })).toBeVisible();
  await tut.say({
    en: 'A clean A4 sheet with your school name, logo and colours. Print it or save it as a PDF to share.',
    si: 'ඔබේ පාසල් නම, ලාංඡනය සහ වර්ණ සහිත පිරිසිදු A4 පත්‍රිකාවක්. එය මුද්‍රණය කරන්න, නැතහොත් බෙදා ගැනීමට PDF ලෙස සුරකින්න.',
  });
  await tut.still('class-sheet');
  await tut.say({
    en: 'Teacher timetables print the same way, from "By teacher".',
    si: 'ගුරු කාලසටහන්ද එලෙසම "ගුරුවරුන් අනුව" තුළින් මුද්‍රණය කළ හැක.',
  }, 2200);
  await tut.card(
    { en: 'Your timetable is live', si: 'ඔබේ කාලසටහන සජීවීයි' },
    { en: 'Next: how teachers join and see their timetable.', si: 'ඊළඟට: ගුරුවරුන් සම්බන්ධ වී තම කාලසටහන බලන ආකාරය.' },
  );
  await tut.finish();
});
