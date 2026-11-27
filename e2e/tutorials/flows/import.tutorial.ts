// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('bulk import', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('import');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('import', k, v);
  const { email } = await demoSchool('import', lang, lang === 'si' ? '99975' : '99974', 'classes');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Import teachers from Excel', si: 'Excel වලින් ගුරුවරුන් ආයාත කරන්න' },
    { en: 'Add all your teachers and subjects at once from one file.', si: 'එක් ගොනුවකින් ඔබේ සියලු ගුරුවරුන් සහ විෂයයන් එකවර එක් කරන්න.' },
  );

  await tut.say({ en: 'Open "Teachers" and click "Import".', si: '"ගුරුවරුන්" විවෘත කර "ගොනුවකින් ඇතුළත් කරන්න" ක්ලික් කරන්න.' }, 1800);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.teachers'), exact: true }), 1000);
  await tut.click(page.getByRole('button', { name: t('open'), exact: true }));
  const dialog = page.getByRole('dialog', { name: t('title') });

  await tut.say({
    en: 'First download the Excel template. It has a Teachers sheet, a Subjects sheet with common subjects filled in, and instructions.',
    si: 'මුලින්ම Excel සැකිල්ල බාගන්න. එහි ගුරුවරුන් පත්‍රිකාවක්, සුපුරුදු විෂයයන් පුරවා ඇති විෂය පත්‍රිකාවක් සහ උපදෙස් ඇත.',
  });
  const download = page.waitForEvent('download');
  await tut.click(dialog.getByRole('button', { name: t('downloadXlsx') }), 800);
  await download;
  await tut.still('template');

  await tut.say({
    en: 'Fill in one row per teacher: title, name, subjects, grades and daily limit. Staff IDs can be left empty. Sathiya adds them.',
    si: 'එක් ගුරුවරයෙකුට එක් පේළියක් පුරවන්න: ගෞරව නාමය, නම, විෂයයන්, ශ්‍රේණි සහ දෛනික සීමාව. සේවක අංක හිස්ව තැබිය හැක. සතිය ඒවා එක් කරයි.',
  });
  await tut.say({ en: 'Then click "Choose file" and pick the filled file.', si: 'ඉන්පසු "ගොනුව තෝරන්න" ක්ලික් කර පුරවා ඇති ගොනුව තෝරන්න.' }, 1800);
  await dialog.getByText(t('chooseFile'), { exact: true }).hover();
  await page.waitForTimeout(500);
  await dialog.locator('input[type=file]').setInputFiles(new URL('../assets/teachers.csv', import.meta.url).pathname);
  await expect(dialog.getByText(tut.rx('import', 'summary'))).toBeVisible();
  await page.waitForTimeout(800);

  await tut.say({
    en: 'You see exactly what will be added before anything is saved. Mistakes are listed so you can fix the file.',
    si: 'කිසිවක් සුරැකීමට පෙර එක් කරන දේ හරියටම පෙනේ. වැරදි ලැයිස්තුගත කරන බැවින් ගොනුව නිවැරදි කළ හැක.',
  });
  await tut.still('preview');
  await tut.click(dialog.getByRole('button', { name: t('import'), exact: true }));
  const done = page.getByRole('dialog', { name: t('doneTitle') });
  await expect(done).toBeVisible();
  await tut.say({ en: 'Imported. Click "Done".', si: 'ආයාත විය. "අවසන්" ක්ලික් කරන්න.' }, 1600);
  await tut.click(done.getByRole('button', { name: t('done') }), 1200);

  await tut.say({
    en: 'All six teachers are in the list with staff IDs. Import only adds: nothing already saved is changed.',
    si: 'ගුරුවරුන් හයදෙනාම සේවක අංක සමඟ ලැයිස්තුවේ ඇත. ආයාත කිරීම එක් කිරීම පමණක් කරයි: දැනටමත් සුරැකි කිසිවක් වෙනස් නොවේ.',
  });
  await tut.still('list');
  await tut.card(
    { en: 'Teachers imported', si: 'ගුරුවරුන් ආයාත කර ඇත' },
    { en: 'Next: build the timetable.', si: 'ඊළඟට: කාලසටහන සකසන්න.' },
  );
  await tut.finish();
});
