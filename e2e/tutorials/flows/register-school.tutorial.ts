// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect, type Locator, type Page } from '@playwright/test';
import { test, WEB_URL, type Tutorial } from '../kit';

const demo = {
  en: { census: '99999', email: 'principal.en@demo.sathiya.lk', name: 'K. Perera' },
  si: { census: '99998', email: 'principal.si@demo.sathiya.lk', name: 'කේ. පෙරේරා' },
};

// The emulator's popup sometimes never hands the result back to the app. Retry with a fresh popup and cut the stall from the video.
async function signInWithGoogle(tut: Tutorial, button: Locator, email: string, name: string, during: () => Promise<void>): Promise<void> {
  let stalled: number | undefined;
  for (let attempt = 0; ; attempt++) {
    const opened = tut.page.waitForEvent('popup');
    await button.click();
    if (attempt === 0) await during();
    const popup = await opened;
    await popup.waitForLoadState();
    await popup.getByText('Add new account').click();
    await popup.locator('#email-input').fill(email);
    await popup.locator('#display-name-input').fill(name);
    const closed = popup.waitForEvent('close', { timeout: 6_000 }).then(() => true, () => false);
    stalled ??= tut.mark();
    await popup.locator('#sign-in').click();
    if (await closed) {
      if (attempt > 0) tut.cut(stalled);
      return;
    }
    if (attempt === 2) throw new Error('Google popup sign-in did not complete');
    await popup.close();
    await tut.page.waitForTimeout(500);
  }
}

async function typeIfEmpty(tut: { type(l: ReturnType<Page['getByLabel']>, s: string): Promise<void> }, field: ReturnType<Page['getByLabel']>, text: string) {
  if ((await field.inputValue()) === '') await tut.type(field, text);
}

test('register a school', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('register-school');
  const t = (k: string) => tut.t('register', k);
  const d = demo[lang];

  await page.goto(lang === 'si' ? `${WEB_URL}/si/` : `${WEB_URL}/`);
  await page.locator('[data-consent="denied"]').click();
  await tut.start();
  await tut.card(
    { en: 'How to register your school', si: 'පාසල ලියාපදිංචි කරන ආකාරය' },
    { en: 'Set up your school on Sathiya in about 3 minutes. It is free.', si: 'මිනිත්තු 3 කින් පමණ සතිය හි ඔබේ පාසල සකසන්න. එය නොමිලේ.' },
  );

  await tut.say({
    en: 'Go to sathiya.kanushka.com and click "Register your school".',
    si: 'sathiya.kanushka.com වෙත ගොස් "පාසල ලියාපදිංචි කරන්න" ක්ලික් කරන්න.',
  });
  await tut.click(page.locator('main a[href$="/register"]').first());
  await expect(page).toHaveURL(/\/login$/);

  await page.waitForTimeout(700);
  await tut.still('signin');
  const google = page.getByRole('button', { name: tut.t('auth', 'signIn.google') });
  await google.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await signInWithGoogle(tut, google, d.email, d.name, async () => {
    await tut.say({
      en: 'First, sign in. We recommend "Continue with Google": no new password to remember and no email to confirm.',
      si: 'මුලින්ම පිවිසෙන්න. "Google සමඟ ඉදිරියට යන්න" භාවිත කිරීම අපි නිර්දේශ කරමු: අලුත් මුරපදයක් මතක තබා ගැනීමට හෝ විද්‍යුත් තැපෑල තහවුරු කිරීමට අවශ්‍ය නැත.',
    });
    await tut.say({
      en: 'A Google window opens. Choose the Google account you use for school work.',
      si: 'Google කවුළුවක් විවෘත වේ. පාසල් වැඩ සඳහා භාවිත කරන Google ගිණුම තෝරන්න.',
    }, 2600);
  });
  await expect(page).toHaveURL(/\/register$/, { timeout: 20_000 });

  await expect(page.getByRole('heading', { name: t('census.title') })).toBeVisible();
  await tut.say({
    en: 'Enter your school\'s census number. The school office has it on Ministry of Education letters.',
    si: 'ඔබේ පාසලේ සංගණන අංකය ඇතුළත් කරන්න. අධ්‍යාපන අමාත්‍යාංශ ලිපිවල එය පාසල් කාර්යාලයේ ඇත.',
  }, 2400);
  await tut.type(page.getByLabel(t('census.label')), d.census);
  await tut.click(page.getByRole('button', { name: t('census.find') }), 1200);

  await expect(page.getByRole('heading', { name: t('confirm.title') })).toBeVisible();
  await tut.say({
    en: 'Sathiya finds your school in the Ministry list and fills in the details. Check they are right.',
    si: 'සතිය අමාත්‍යාංශ ලැයිස්තුවෙන් ඔබේ පාසල සොයාගෙන විස්තර පුරවයි. ඒවා නිවැරදිදැයි පරීක්ෂා කරන්න.',
  });
  await tut.still('confirm-school');

  await tut.say({
    en: 'Type the school name in Sinhala, and the city.',
    si: 'පාසලේ නම සිංහලෙන් සහ නගරය ලියන්න.',
  }, 1600);
  await typeIfEmpty(tut, page.getByLabel(t('school.nameSi')), 'සතිය ආදර්ශ විද්‍යාලය');
  await typeIfEmpty(tut, page.getByLabel(t('school.city'), { exact: true }), 'Kandy');

  const prefix = page.getByLabel(t('school.prefix'));
  await typeIfEmpty(tut, prefix, 'SDC');
  await prefix.evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  await page.waitForTimeout(500);
  await tut.say({
    en: 'Teacher staff IDs start with this prefix, like SDC001. Grades 6 to 13 are created for you.',
    si: 'ගුරු සේවක අංක මෙම උපසර්ගයෙන් අරඹයි, උදා. SDC001. 6 සිට 13 දක්වා ශ්‍රේණි ස්වයංක්‍රීයව සෑදේ.',
  });
  await tut.click(page.getByRole('button', { name: t('confirm.next') }));

  await expect(page.getByRole('heading', { name: t('brand.title') })).toBeVisible();
  await tut.say({
    en: 'Step 2: add your school logo. This is optional. Use a square PNG or SVG.',
    si: 'දෙවන පියවර: පාසල් ලාංඡනය එක් කරන්න. මෙය අනිවාර්ය නොවේ. සමචතුරස්‍ර PNG හෝ SVG එකක් භාවිත කරන්න.',
  }, 2400);
  const chooser = page.waitForEvent('filechooser');
  await tut.click(page.getByRole('button', { name: t('logo.choose') }), 200);
  await (await chooser).setFiles(new URL('../assets/demo-logo.svg', import.meta.url).pathname);
  await page.waitForTimeout(900);

  await tut.say({
    en: 'Pick your school colours. The preview shows how timetables will look.',
    si: 'පාසල් වර්ණ තෝරන්න. කාලසටහන් පෙනෙන ආකාරය පෙරදසුනේ දැකිය හැක.',
  }, 2000);
  await tut.click(page.getByRole('group', { name: t('brand.primary') }).getByRole('button').nth(3));
  await tut.click(page.getByRole('group', { name: t('brand.second') }).getByRole('button').nth(1), 1600);
  await tut.still('brand');
  await tut.click(page.getByRole('button', { name: t('brand.next') }));

  await expect(page.getByRole('heading', { name: t('account.title') })).toBeVisible();
  await tut.say({
    en: 'Step 3: check your name, accept the terms, then click "Create school".',
    si: 'තුන්වන පියවර: ඔබේ නම පරීක්ෂා කර, නියම සහ කොන්දේසි පිළිගෙන, "පාසල සාදන්න" ක්ලික් කරන්න.',
  }, 2400);
  await typeIfEmpty(tut, page.getByLabel(t('account.name')), d.name);
  await tut.click(page.getByRole('checkbox'));
  await tut.still('account');
  await tut.click(page.getByRole('button', { name: t('account.submit') }), 300);

  await expect(page).toHaveURL(/\/admin$/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await tut.say({
    en: 'Done! Your school is ready. This is your admin dashboard.',
    si: 'හරි! ඔබේ පාසල සූදානම්. මෙය ඔබේ පරිපාලක පුවරුවයි.',
  });
  await tut.still('admin-dashboard');
  await tut.card(
    { en: 'Your school is registered', si: 'ඔබේ පාසල ලියාපදිංචි විය' },
    { en: 'Next: add classes, subjects and teachers.', si: 'ඊළඟට: පන්ති, විෂයයන් සහ ගුරුවරුන් එක් කරන්න.' },
  );
  await tut.finish();
});
