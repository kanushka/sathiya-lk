// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { expect } from '@playwright/test';
import { demoSchool, signIn } from '../demo';
import { test } from '../kit';

test('members', async ({ page, lang, tutorial }) => {
  const tut = await tutorial('members');
  const t = (k: string, v?: Record<string, string | number>) => tut.t('members', k, v);
  const { email } = await demoSchool('members', lang, lang === 'si' ? '99973' : '99972', 'fresh');
  await signIn(page, tut, email);

  await tut.start();
  await tut.card(
    { en: 'Invite another admin', si: 'තවත් පරිපාලකයෙකුට ආරාධනා කරන්න' },
    { en: 'Share the work: a deputy principal or timetable teacher can be an admin too.', si: 'වැඩ බෙදා ගන්න: නියෝජ්‍ය විදුහල්පතිවරයෙකු හෝ කාලසටහන් ගුරුවරයෙකුටත් පරිපාලක විය හැක.' },
  );

  await tut.say({ en: 'Open "Members" in the menu. It lists everyone who can sign in to your school.', si: 'මෙනුවේ "සාමාජිකයන්" විවෘත කරන්න. ඔබේ පාසලට පිවිසිය හැකි සැමදෙනාම එහි ලැයිස්තුගත වේ.' });
  await tut.click(page.getByRole('link', { name: tut.t('shell', 'nav.members'), exact: true }), 1000);
  await tut.still('members');

  await tut.say({ en: 'Click "Invite admin" and type their email.', si: '"පරිපාලකයෙකු ආරාධනා කරන්න" ක්ලික් කර ඔවුන්ගේ විද්‍යුත් තැපෑල ලියන්න.' }, 2000);
  await tut.click(page.getByRole('button', { name: t('page.invite') }).first());
  const dialog = page.getByRole('dialog', { name: t('invite.title') });
  await tut.type(dialog.getByLabel(t('invite.email'), { exact: true }), 'deputy@demo.sathiya.lk');
  await tut.say({
    en: 'They become an admin when they sign in with this email. If they also teach, link them to their teacher record.',
    si: 'ඔවුන් මෙම විද්‍යුත් තැපෑලෙන් පිවිසි විට පරිපාලක වේ. ඔවුන් උගන්වන්නේ නම්, ඔවුන්ගේ ගුරු වාර්තාවට සම්බන්ධ කරන්න.',
  });
  await tut.still('invite');
  await tut.click(dialog.getByRole('button', { name: t('invite.send') }));
  await expect(dialog).toBeHidden();

  await tut.say({
    en: 'The invite is sent by email and shows under "Pending invites" until they sign in. You can cancel it any time.',
    si: 'ආරාධනාව විද්‍යුත් තැපෑලෙන් යවන අතර ඔවුන් පිවිසෙන තුරු "පොරොත්තු ආරාධනා" යටතේ පෙනේ. ඕනෑම වේලාවක එය අවලංගු කළ හැක.',
  });
  await tut.still('pending');
  await tut.say({
    en: 'Teachers do not need an invite here. They join with the invite link on the Teachers page.',
    si: 'ගුරුවරුන්ට මෙහි ආරාධනාවක් අවශ්‍ය නැත. ඔවුන් ගුරුවරුන් පිටුවේ ඇති ආරාධනා සබැඳියෙන් සම්බන්ධ වේ.',
  });
  await tut.card(
    { en: 'You have a team', si: 'දැන් ඔබට කණ්ඩායමක් ඇත' },
    { en: 'Next: set up subjects.', si: 'ඊළඟට: විෂයයන් සකසන්න.' },
  );
  await tut.finish();
});
