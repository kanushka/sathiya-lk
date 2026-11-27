// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('period templates', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('templates');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('templates', k, v);
  const { email } = await demoSchool('templates', lang, lang === 'si' ? '99995' : '99994', 'fresh');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Set your school day', si: 'පාසල් දිනය සකසන්න' },
    { en: 'Period templates hold the bell schedule: periods, times and intervals.', si: 'කාලච්ඡේද ආකෘතිවල සීනු කාලසටහන ඇත: කාලච්ඡේද, වේලාවන් සහ විවේක.' },
  );

  await tut.say({ en: 'Open "Period templates" in the menu.', si: 'මෙනුවේ "කාලච්ඡේද සැකිලි" විවෘත කරන්න.' }, 1800);
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.templates'), exact: true }));
  await tut.say({
    en: 'Your school starts with a default template. Every class uses it unless you choose another one.',
    si: 'ඔබේ පාසල පෙරනිමි ආකෘතියකින් ආරම්භ වේ. වෙනත් එකක් තෝරා නොගන්නේ නම් සෑම පන්තියක්ම එය භාවිත කරයි.',
  });
  await tut.click(page.getByRole('button', { name: /^School default/ }), 1200);
  await expect(page.getByRole('textbox', { name: t('editor.templateName') })).toBeVisible();
  await tut.say({
    en: 'Each row is a period or an interval. Change the start and end times to match your school bell.',
    si: 'සෑම පේළියක්ම කාලච්ඡේදයක් හෝ විවේකයකි. ඔබේ පාසල් සීනුවට ගැලපෙන ලෙස ආරම්භක සහ අවසාන වේලාවන් වෙනස් කරන්න.',
  });
  await tut.still('default-template');

  await tut.say({
    en: 'Need one more period? Click "+ Period", then "Save template".',
    si: 'තවත් කාලච්ඡේදයක් අවශ්‍යද? "+ කාලච්ඡේදය" ක්ලික් කර, "ආකෘතිය සුරකින්න" ක්ලික් කරන්න.',
  }, 2000);
  await tut.click(page.getByRole('button', { name: t('editor.addPeriod') }), 1000);
  await tut.click(page.getByRole('button', { name: t('editor.save') }));
  await expect(page.getByText(t('page.saved'))).toBeVisible();

  await tut.say({
    en: 'Some classes keep a different day, like a short Friday or primary classes. Make a new template for them.',
    si: 'සමහර පන්තිවලට වෙනස් දිනයක් ඇත, උදා. කෙටි සිකුරාදා හෝ ප්‍රාථමික පන්ති. ඒවාට නව ආකෘතියක් සාදන්න.',
  });
  await tut.click(page.getByRole('button', { name: t('list.new') }));
  const dialog = page.getByRole('dialog', { name: t('new.title') });
  const name = lang === 'si' ? 'කෙටි සිකුරාදා' : 'Short Friday';
  await tut.type(dialog.getByLabel(t('new.name'), { exact: true }), name, 600);
  await tut.click(dialog.getByRole('button', { name: t('new.create') }), 1000);
  await tut.click(page.getByRole('button', { name: new RegExp(`^${name}`) }), 1000);
  await tut.say({
    en: 'Choose "Different per day" to give Friday its own periods. It starts as a copy of the school default.',
    si: 'සිකුරාදාට වෙනම කාලච්ඡේද ලබා දීමට "දිනපතා වෙනස්" තෝරන්න. එය පාසලේ පෙරනිමි ආකෘතියේ පිටපතක් ලෙස ආරම්භ වේ.',
  });
  await tut.click(page.getByRole('radio', { name: t('editor.perDay') }), 1200);
  await tut.still('per-day');
  await tut.click(page.getByRole('button', { name: t('editor.save') }));
  await expect(page.getByText(t('page.saved')).first()).toBeVisible();

  await tut.say({
    en: 'Pick which template a class uses in Grade settings.',
    si: 'පන්තියක් භාවිත කරන ආකෘතිය ශ්‍රේණි සැකසුම්වලදී තෝරන්න.',
  }, 2200);
  await tut.card(
    { en: 'Your school day is set', si: 'ඔබේ පාසල් දිනය සකසා ඇත' },
    { en: 'Next: add your teachers.', si: 'ඊළඟට: ඔබේ ගුරුවරුන් එක් කරන්න.' },
  );
  await tut.finish();
});
