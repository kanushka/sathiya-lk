// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('school profile', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('profile');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('profile', k, v);
  const { email } = await demoSchool('profile', lang, lang === 'si' ? '99971' : '99970', 'fresh');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'School profile, logo and colours', si: 'පාසල් පැතිකඩ, ලාංඡනය සහ වර්ණ' },
    { en: 'Change your school details, logo and colours at any time.', si: 'ඕනෑම වේලාවක පාසලේ විස්තර, ලාංඡනය සහ වර්ණ වෙනස් කරන්න.' },
  );

  await tut.say({ en: 'Open "School profile & colours" in the menu.', si: 'මෙනුවේ "පාසල් තොරතුරු සහ වර්ණ" විවෘත කරන්න.' }, 1800);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.profile'), exact: true }), 1000);
  await tut.say({
    en: 'Names come from registration. To change the school name, send a request and Sathiya checks it first.',
    si: 'නම් ලියාපදිංචියේදී ලැබේ. පාසලේ නම වෙනස් කිරීමට ඉල්ලීමක් යවන්න, සතිය මුලින්ම එය පරීක්ෂා කරයි.',
  });
  await tut.still('profile');

  await tut.say({ en: 'Add the school phone number and address.', si: 'පාසලේ දුරකථන අංකය සහ ලිපිනය එක් කරන්න.' }, 1600);
  await tut.type(page.getByLabel(t('fields.phone')), '081 222 3344');
  await page.getByLabel(t('fields.address')).fill('');
  await tut.type(page.getByLabel(t('fields.address')), 'Temple Road, Kandy');

  await tut.say({
    en: 'Upload your logo, a square PNG, JPEG or WebP up to 1 MB.',
    si: '1 MB දක්වා සමචතුරස්‍ර PNG, JPEG හෝ WebP ලාංඡනයක් උඩුගත කරන්න.',
  }, 2000);
  const chooser = page.waitForEvent('filechooser');
  await tut.click(page.getByRole('button', { name: tut.t('register', 'logo.choose') }), 200);
  await (await chooser).setFiles(new URL('../assets/demo-logo.png', import.meta.url).pathname);
  await page.waitForTimeout(1000);

  await tut.say({
    en: 'Pick new colours. The preview shows how timetables and buttons will look.',
    si: 'නව වර්ණ තෝරන්න. කාලසටහන් සහ බොත්තම් පෙනෙන ආකාරය පෙරදසුනේ පෙනේ.',
  }, 2000);
  await tut.click(page.getByRole('group', { name: tut.t('register', 'brand.primary') }).getByRole('button').nth(0));
  await tut.click(page.getByRole('group', { name: tut.t('register', 'brand.second') }).getByRole('button').nth(1), 1500);
  await tut.still('colours');

  await tut.say({ en: 'Click "Save changes". Everyone at your school sees the new look.', si: '"වෙනස්කම් සුරකින්න" ක්ලික් කරන්න. ඔබේ පාසලේ සැමට නව පෙනුම පෙනේ.' }, 2000);
  await tut.click(page.getByRole('button', { name: t('page.save') }));
  await expect(page.getByText(t('page.saved'))).toBeVisible();
  await page.waitForTimeout(1200);
  await tut.card(
    { en: 'Your school looks like your school', si: 'ඔබේ පාසල දැන් ඔබේ පාසල මෙන් පෙනේ' },
    { en: 'Next: invite another admin.', si: 'ඊළඟට: තවත් පරිපාලකයෙකුට ආරාධනා කරන්න.' },
  );
  await tut.finish();
});
