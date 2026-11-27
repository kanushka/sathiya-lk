// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('auto-fill', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('autofill');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('autofill', k, v);
  const { email } = await demoSchool('autofill', lang, lang === 'si' ? '99984' : '99983', 'clean');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Auto-fill the whole timetable', si: 'මුළු කාලසටහනම ස්වයංක්‍රීයව පුරවන්න' },
    { en: 'Sathiya places every lesson for every class in seconds, without clashes.', si: 'සතිය සෑම පන්තියකටම සෑම පාඩමක්ම තත්පර කිහිපයකින්, ගැටුම් නොමැතිව තබයි.' },
  );

  await tut.say({
    en: 'Open "By class". This school has four empty classes. Click "Auto-fill".',
    si: '"පන්ති අනුව" විවෘත කරන්න. මෙම පාසලේ හිස් පන්ති හතරක් ඇත. "ස්වයංක්‍රීයව පුරවන්න" ක්ලික් කරන්න.',
  }, 2600);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.byClass'), exact: true }), 1200);
  await tut.click(page.getByRole('link', { name: tut.t('timetable', 'autoFill'), exact: true }));

  await expect(page.getByText(t('ready.title'))).toBeVisible();
  await tut.say({
    en: 'Sathiya first checks your setup: grades, classes, teachers and templates. If something is missing, it tells you what to fix.',
    si: 'සතිය මුලින්ම ඔබේ සැකසුම පරීක්ෂා කරයි: ශ්‍රේණි, පන්ති, ගුරුවරුන් සහ ආකෘති. යමක් අඩු නම්, නිවැරදි කළ යුත්තේ කුමක්දැයි පවසයි.',
  });
  await tut.still('ready');
  await tut.click(page.getByRole('button', { name: t('continue'), exact: true }));

  await tut.say({
    en: '"Fill around" keeps every lesson you already placed and fills only what is missing. Click "Generate timetable".',
    si: '"වටේට පුරවන්න" ඔබ දැනටමත් තැබූ සෑම පාඩමක්ම තබාගෙන අඩු දේ පමණක් පුරවයි. "කාලසටහන සාදන්න" ක්ලික් කරන්න.',
  });
  await tut.click(page.getByRole('button', { name: t('options.run'), exact: true }));

  await expect(page.getByRole('heading', { name: t('preview.title') })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(800);
  await tut.say({
    en: 'Done in seconds. Every period is placed. Nothing is saved yet, so you can check it first.',
    si: 'තත්පර කිහිපයකින් අවසන්. සෑම කාලච්ඡේදයක්ම තබා ඇත. තවම කිසිවක් සුරැකී නැති බැවින්, මුලින්ම පරීක්ෂා කළ හැක.',
  });
  await tut.still('preview');
  await tut.say({
    en: 'The Allocation tab shows who teaches each subject in each class. Change a teacher here if you need to.',
    si: 'එක් එක් පන්තියේ සෑම විෂයක්ම උගන්වන්නේ කවුදැයි "ගුරු පැවරීම" ටැබයේ පෙනේ. අවශ්‍ය නම් මෙහිදී ගුරුවරයා වෙනස් කරන්න.',
  });

  await tut.click(page.getByRole('tab', { name: t('preview.tab.classes') }), 1200);
  await tut.say({
    en: 'The Classes tab shows the new timetable for each class.',
    si: 'පන්ති ටැබයේ එක් එක් පන්තියේ නව කාලසටහන පෙනේ.',
  });
  await tut.still('preview-class');

  await tut.say({ en: 'Happy with it? Click "Save".', si: 'සෑහීමකට පත්ද? "සුරකින්න" ක්ලික් කරන්න.' }, 1800);
  await tut.click(page.getByRole('button', { name: t('preview.save'), exact: true }), 2500);
  await expect(page.getByText(tut.rx('autofill', 'preview.saved_other')).first()).toBeVisible({ timeout: 20_000 });

  await tut.say({
    en: 'The timetable is saved. You can still change any lesson by hand, then publish it to teachers.',
    si: 'කාලසටහන සුරැකිණි. ඕනෑම පාඩමක් අතින් වෙනස් කර, පසුව ගුරුවරුන්ට ප්‍රකාශයට පත් කළ හැක.',
  });
  await tut.still('saved');
  await tut.card(
    { en: 'Your timetable is ready', si: 'ඔබේ කාලසටහන සූදානම්' },
    { en: 'Next: publish it and print class and teacher timetables.', si: 'ඊළඟට: එය ප්‍රකාශයට පත් කර පන්ති සහ ගුරු කාලසටහන් මුද්‍රණය කරන්න.' },
  );
  await tut.finish();
});
