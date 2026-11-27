// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('subjects', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('subjects');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('subjects', k, v);
  const { email } = await demoSchool('subjects', lang, lang === 'si' ? '99991' : '99990', 'fresh');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Add your subjects', si: 'විෂයයන් එක් කරන්න' },
    { en: 'One subject list for the whole school, in Sinhala and English.', si: 'සිංහලෙන් සහ ඉංග්‍රීසියෙන්, මුළු පාසලටම එක් විෂය ලැයිස්තුවක්.' },
  );

  await tut.say({
    en: 'Sign in as the school admin and open "Subjects" in the menu.',
    si: 'පාසල් පරිපාලක ලෙස පිවිස මෙනුවේ "විෂයයන්" විවෘත කරන්න.',
  });
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.subjects'), exact: true }));
  await expect(page.getByText(t('page.empty'))).toBeVisible();
  await tut.still('empty');

  await tut.say({
    en: 'The quickest start: load the standard Sri Lankan subject list. Names come in both Sinhala and English.',
    si: 'ඉක්මන්ම ආරම්භය: ශ්‍රී ලංකාවේ සම්මත විෂය ලැයිස්තුව පූරණය කරන්න. නම් සිංහලෙන් සහ ඉංග්‍රීසියෙන් ලැබේ.',
  });
  await tut.click(page.getByRole('button', { name: t('page.loadStandard') }).first(), 1500);
  await tut.say({
    en: 'You can change any name or short name right in the list. The short name is what fits in a timetable cell.',
    si: 'ඕනෑම නමක් හෝ කෙටි නමක් ලැයිස්තුවේම වෙනස් කළ හැක. කාලසටහන් කොටුවක දිස්වන්නේ කෙටි නමයි.',
  });
  await tut.still('standard-list');

  await tut.say({
    en: 'Missing a subject? Click "+ Add subject".',
    si: 'විෂයක් අඩුද? "+ විෂයක් එක් කරන්න" ක්ලික් කරන්න.',
  }, 1800);
  await tut.click(page.getByRole('button', { name: t('page.add') }).first());
  const dialog = page.getByRole('dialog', { name: t('modal.title') });
  await tut.say({
    en: 'Type the name in English and Sinhala. The short name and colour are filled in for you.',
    si: 'නම ඉංග්‍රීසියෙන් සහ සිංහලෙන් ලියන්න. කෙටි නම සහ වර්ණය ස්වයංක්‍රීයව පිරේ.',
  }, 1800);
  await tut.type(dialog.getByLabel(t('modal.nameEn')), 'Agriculture');
  await tut.type(dialog.getByLabel(t('modal.nameSi')), 'කෘෂිකර්මය', 1200);
  await tut.still('add-subject');
  await tut.click(dialog.getByRole('button', { name: t('modal.save') }));
  await expect(dialog).toBeHidden();

  await tut.say({
    en: 'Done. Each grade picks its subjects from this list in Grade settings.',
    si: 'හරි. සෑම ශ්‍රේණියක්ම ශ්‍රේණි සැකසුම්වලදී මෙම ලැයිස්තුවෙන් විෂයයන් තෝරා ගනී.',
  });
  await tut.card(
    { en: 'Subjects are ready', si: 'විෂයයන් සූදානම්' },
    { en: 'Next: grades and classes.', si: 'ඊළඟට: ශ්‍රේණි සහ පන්ති.' },
  );
  await tut.finish();
});
