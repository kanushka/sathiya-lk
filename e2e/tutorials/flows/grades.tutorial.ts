// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

const plan = [
  { en: 'Mathematics', si: 'ගණිතය', periods: '6' },
  { en: 'Science', si: 'විද්‍යාව', periods: '5' },
  { en: 'Sinhala', si: 'සිංහල', periods: '6' },
];

test('grades and classes', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('grades');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('grades', k, v);
  const { email } = await demoSchool('grades', lang, lang === 'si' ? '99993' : '99992', 'subjects');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Set up grades and classes', si: 'ශ්‍රේණි සහ පන්ති සකසන්න' },
    { en: 'Add classes and choose how many periods each subject gets in a week.', si: 'පන්ති එක් කර සෑම විෂයකටම සතියකට කාලච්ඡේද කීයක් දැයි තෝරන්න.' },
  );

  await tut.say({ en: 'Open "Grades & classes" in the menu.', si: 'මෙනුවේ "ශ්‍රේණි සහ පන්ති" විවෘත කරන්න.' }, 1800);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.grades'), exact: true }));

  await tut.say({ en: 'Click "+ Add grade" and choose the grade.', si: '"+ ශ්‍රේණියක් එක් කරන්න" ක්ලික් කර ශ්‍රේණිය තෝරන්න.' }, 1800);
  await tut.click(page.getByRole('button', { name: t('rail.addGrade') }).first());
  const dialog = page.getByRole('dialog', { name: t('addGrade.title') });
  await tut.click(dialog.getByRole('combobox', { name: t('addGrade.number') }), 600);
  await tut.click(page.getByRole('option', { name: t('rail.grade', { n: 6 }), exact: true }), 600);
  await tut.click(dialog.getByRole('button', { name: t('addGrade.add') }));
  await expect(page.getByRole('heading', { name: t('page.title', { n: 6 }) })).toBeVisible();

  await tut.say({
    en: 'Add the classes in this grade. Each click adds the next class: 6A, 6B, 6C.',
    si: 'මෙම ශ්‍රේණියේ පන්ති එක් කරන්න. සෑම ක්ලික් කිරීමකින්ම ඊළඟ පන්තිය එක් වේ: 6A, 6B, 6C.',
  }, 2400);
  for (const name of ['6A', '6B', '6C']) await tut.click(page.getByRole('button', { name: t('classes.add', { name }) }), 900);
  await tut.still('classes');

  await tut.say({
    en: 'Now add the subjects this grade learns, and the number of periods each one gets in a week.',
    si: 'දැන් මෙම ශ්‍රේණිය ඉගෙන ගන්නා විෂයයන් සහ එක් එක් විෂයට සතියකට ලැබෙන කාලච්ඡේද ගණන එක් කරන්න.',
  }, 2600);
  for (const s of plan) {
    await tut.click(page.getByRole('combobox', { name: t('plan.addSubject') }), 600);
    await tut.click(page.getByRole('option', { name: s[lang], exact: true }), 700);
    const periods = page.getByRole('spinbutton', { name: t('plan.perWeekFor', { name: s[lang] }) });
    await periods.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    await periods.fill('');
    await tut.type(periods, s.periods, 300);
    await periods.blur();
  }
  await tut.say({
    en: 'The total shows how many of the week\'s periods are planned. All classes in the grade share this plan.',
    si: 'සතියේ කාලච්ඡේද වලින් කීයක් සැලසුම් කර ඇත්දැයි එකතුවෙන් පෙනේ. ශ්‍රේණියේ සියලු පන්ති මෙම සැලැස්ම බෙදා ගනී.',
  });
  await tut.still('plan');

  await tut.say({
    en: 'Repeat for each grade. Changes save automatically.',
    si: 'සෑම ශ්‍රේණියකටම මෙය නැවත කරන්න. වෙනස්කම් ස්වයංක්‍රීයව සුරැකේ.',
  }, 2200);
  await tut.card(
    { en: 'Grades and classes are ready', si: 'ශ්‍රේණි සහ පන්ති සූදානම්' },
    { en: 'Next: period templates, the school bell schedule.', si: 'ඊළඟට: කාලච්ඡේද ආකෘති, පාසලේ සීනු කාලසටහන.' },
  );
  await tut.finish();
});
