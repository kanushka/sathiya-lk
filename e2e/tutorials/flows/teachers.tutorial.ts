// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('teachers', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('teachers');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('teachers', k, v);
  const { email } = await demoSchool('teachers', lang, lang === 'si' ? '99997' : '99996', 'classes');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Add and edit teachers', si: 'ගුරුවරුන් එක් කිරීම සහ සංස්කරණය' },
    { en: 'Staff IDs, subjects, grades and how many periods a day each teacher can take.', si: 'සේවක අංක, විෂයයන්, ශ්‍රේණි සහ එක් එක් ගුරුවරයාට දිනකට ගත හැකි කාලච්ඡේද ගණන.' },
  );

  await tut.say({ en: 'Open "Teachers" in the menu and click "+ Add teacher".', si: 'මෙනුවේ "ගුරුවරුන්" විවෘත කර "+ ගුරුවරයෙකු එක් කරන්න" ක්ලික් කරන්න.' }, 2000);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.teachers'), exact: true }));
  await tut.click(page.getByRole('button', { name: t('page.add') }).first());
  const dialog = page.getByRole('dialog', { name: t('modal.titleAdd') });

  await tut.say({
    en: 'The staff ID is filled in for you, using your school prefix. Type the name in English and Sinhala, without the title.',
    si: 'ඔබේ පාසල් උපසර්ගය භාවිතයෙන් සේවක අංකය ස්වයංක්‍රීයව පිරේ. ගෞරව නාමය නොමැතිව නම ඉංග්‍රීසියෙන් සහ සිංහලෙන් ලියන්න.',
  }, 2600);
  await tut.type(dialog.getByLabel(t('modal.nameEn')), 'N. Perera');
  await tut.type(dialog.getByLabel(t('modal.nameSi')), 'එන්. පෙරේරා');

  await tut.say({
    en: 'Choose the subjects and grades this teacher teaches.',
    si: 'මෙම ගුරුවරයා උගන්වන විෂයයන් සහ ශ්‍රේණි තෝරන්න.',
  }, 1800);
  const subjects = dialog.getByRole('combobox', { name: t('modal.subjects') });
  for (const s of lang === 'si' ? ['ගණිතය', 'විද්‍යාව'] : ['Mathematics', 'Science']) {
    const option = page.getByRole('option', { name: s, exact: true });
    if (!(await option.isVisible())) await tut.click(subjects, 500);
    await tut.click(option, 600);
  }
  await page.keyboard.press('Escape');
  const grades = dialog.getByRole('group', { name: t('modal.grades') });
  for (const g of ['6', '7', '8']) await tut.click(grades.getByRole('button', { name: g, exact: true }), 450);

  await tut.say({
    en: 'Set the most periods they can teach in a day. The timetable and auto-fill keep to this limit.',
    si: 'ඔවුන්ට දිනකට ඉගැන්විය හැකි උපරිම කාලච්ඡේද ගණන සකසන්න. කාලසටහන සහ ස්වයංක්‍රීය පිරවීම මෙම සීමාව රකියි.',
  });
  await tut.still('add-teacher');
  await tut.click(dialog.getByRole('button', { name: t('modal.save') }));
  await expect(dialog).toHaveCount(0);

  await tut.say({
    en: 'The teacher is in the list. They can sign in later with their own account, using an invite link.',
    si: 'ගුරුවරයා ලැයිස්තුවේ ඇත. පසුව ආරාධනා සබැඳියක් භාවිතයෙන් ඔවුන්ට තමන්ගේම ගිණුමකින් පිවිසිය හැක.',
  });
  await tut.still('list');

  await tut.say({ en: 'To change details, click "Edit" on the row.', si: 'විස්තර වෙනස් කිරීමට, පේළියේ "සංස්කරණය" ක්ලික් කරන්න.' }, 1800);
  await tut.click(page.getByRole('button', { name: t('page.edit') }).first());
  const edit = page.getByRole('dialog', { name: t('modal.titleEdit') });
  await tut.click(edit.getByRole('group', { name: t('modal.grades') }).getByRole('button', { name: '9', exact: true }), 800);
  await tut.click(edit.getByRole('button', { name: t('modal.save') }));
  await expect(edit).toHaveCount(0);

  await tut.say({
    en: 'Have many teachers? You can import them all from an Excel sheet. That has its own video.',
    si: 'ගුරුවරුන් බොහෝ දෙනෙක් සිටීද? Excel පත්‍රිකාවකින් සියල්ලන්ම ආයාත කළ හැක. ඒ සඳහා වෙනම වීඩියෝවක් ඇත.',
  });
  await tut.card(
    { en: 'Teachers are added', si: 'ගුරුවරුන් එක් කර ඇත' },
    { en: 'Next: build the timetable class by class.', si: 'ඊළඟට: පන්තියෙන් පන්තියට කාලසටහන සකසන්න.' },
  );
  await tut.finish();
});
