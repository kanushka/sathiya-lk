// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { paths } from '@sathiya/core';
import { createHash } from 'node:crypto';
import { admin, YEAR_ID } from '../../../scripts/seed';
import { callAs, idToken } from '../../helpers';
import { autoFill, demoSchool, PASSWORD, signIn, signInWithGoogle } from '../demo';
import { test } from '../kit';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

const TOKEN = 'sathiya-demo-join-link';

test('teacher on a phone', async ({ page, lang, tutorial, browser }) => {
  const tut = await tutorial('teacher-phone');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('teacher', k, v);
  const { email: adminEmail, sid } = await demoSchool('teacher-phone', lang, lang === 'si' ? '99977' : '99976', 'clean');
  const teacherEmail = `n.perera.${lang}@demo.sathiya.lk`;
  const { db } = admin();
  await db.doc(`${paths.teachers(sid)}/t-perera`).update({ email: teacherEmail });
  await db.doc(paths.joinLink(sid)).set({ hash: createHash('sha256').update(TOKEN).digest('hex'), token: TOKEN, createdAt: Date.now(), createdBy: 'demo' });
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const adminPage = await adminContext.newPage();
  await adminPage.addInitScript((l) => localStorage.setItem('sathiya.lang', l), lang);
  await signIn(adminPage, tut, adminEmail);
  await autoFill(adminPage, tut, sid);
  await adminContext.close();
  await callAs(await idToken(adminEmail, PASSWORD), 'publishYear', { schoolId: sid, yearId: YEAR_ID });

  // Monday 08:00 in Colombo: period 1, which auto-fill gives to class teachers such as Mrs. N. Perera (6A).
  await page.clock.setFixedTime(new Date('2026-11-23T08:00:00+05:30'));
  await page.goto('/login');
  await tut.start();
  await tut.card(
    { en: 'For teachers: your timetable on your phone', si: 'ගුරුවරුන් සඳහා: ඔබේ දුරකථනයේ ඔබේ කාලසටහන' },
    { en: 'Join your school once, then see your day at a glance.', si: 'එක් වරක් ඔබේ පාසලට සම්බන්ධ වී, ඔබේ දිනය එක බැල්මකින් බලන්න.' },
  );

  await tut.say({
    en: 'Your school admin shares a join link, for example on WhatsApp. Open it on your phone.',
    si: 'ඔබේ පාසල් පරිපාලක සම්බන්ධ වීමේ සබැඳියක් බෙදා ගනී, උදා. WhatsApp හරහා. එය ඔබේ දුරකථනයේ විවෘත කරන්න.',
  });
  await page.goto(`/join/${sid}/${TOKEN}`);
  await expect(page).toHaveURL(/\/login$/);
  await page.waitForTimeout(800);
  await tut.still('join');

  const google = page.getByRole('button', { name: tut.t('auth', 'signIn.google') });
  await signInWithGoogle(tut, google, teacherEmail, 'N. Perera', async () => {
    await tut.say({
      en: 'Sign in with "Continue with Google", using the email your school has for you.',
      si: 'ඔබේ පාසල ඔබ සඳහා භාවිත කරන විද්‍යුත් තැපෑල සමඟ "Google සමඟ ඉදිරියට යන්න" ක්ලික් කර පිවිසෙන්න.',
    });
  });
  await expect(page).toHaveURL(new RegExp(`/s/${sid}/me$`), { timeout: 20_000 });
  await page.waitForTimeout(1200);

  await tut.say({
    en: "You're in. The top card shows the lesson happening now and how many minutes are left.",
    si: 'ඔබ ඇතුළු විය. දැන් සිදුවන පාඩම සහ ඉතිරි මිනිත්තු ගණන ඉහළ කාඩ්පතේ පෙනේ.',
  });
  await tut.still('now');
  await tut.say({
    en: "Scroll to see the rest of today's lessons, with intervals and free periods.",
    si: 'විවේක සහ නිදහස් කාලච්ඡේද සමඟ අද දින ඉතිරි පාඩම් බැලීමට පහළට යන්න.',
  }, 2400);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(1500);

  await tut.say({ en: 'Tap another day to see that day.', si: 'එම දිනය බැලීමට වෙනත් දිනයක් තට්ටු කරන්න.' }, 1800);
  await page.mouse.wheel(0, -800);
  await page.waitForTimeout(600);
  await tut.click(page.getByRole('main').getByRole('button', { name: tut.t('common', 'days.short.1'), exact: true }), 1500);

  await tut.say({ en: 'Or switch to "Week" for the whole week.', si: 'නැතහොත් මුළු සතියම බැලීමට "සතිය" වෙත මාරු වන්න.' }, 1800);
  await tut.click(page.getByRole('link', { name: t('views.week'), exact: true }), 1800);
  await tut.still('week');

  await tut.say({
    en: 'When the school publishes changes or plans relief for you, you see it here.',
    si: 'පාසල වෙනස්කම් ප්‍රකාශයට පත් කළ විට හෝ ඔබට ආදේශක කාලච්ඡේද සැලසූ විට, ඔබට එය මෙහි පෙනේ.',
  });
  await tut.card(
    { en: 'Your week, in your pocket', si: 'ඔබේ සතිය, ඔබේ සාක්කුවේ' },
    { en: 'Ask your school admin for the join link.', si: 'සම්බන්ධ වීමේ සබැඳිය ඔබේ පාසල් පරිපාලකගෙන් ඉල්ලන්න.' },
  );
  await tut.finish();
});
