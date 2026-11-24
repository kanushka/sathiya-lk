// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { brandSubject, render, sathiyaHeader, type Content, type Rendered } from './layout';
import { siteFooter } from './footer';

export interface LinkEmailInput {
  link: string;
  lang?: 'en' | 'si';
  webUrl?: string;
}

const FALLBACK = { en: 'Button not working? Paste this link into your browser:', si: 'බොත්තම ක්‍රියා නොකරයි නම් මෙම සබැඳිය බ්‍රවුසරයට අලවන්න:' };
// The Sinhala copy points at the button: below it when Sinhala comes first, above it otherwise.
const where = (siFirst: boolean) => (siFirst ? 'පහත' : 'ඉහත');

export function verifyEmail({ link, lang, webUrl }: LinkEmailInput): Rendered {
  const siFirst = lang === 'si';
  const en: Content = {
    title: 'Confirm your email',
    paras: ['Confirm this address to finish registering your school on Sathiya.'],
    cta: { label: 'Confirm email', url: link, fallback: FALLBACK.en },
    note: "Didn't ask for this? You can ignore this email.",
  };
  const si: Content = {
    title: 'ඔබගේ ඊමේල් තහවුරු කරන්න',
    paras: [`ඔබගේ පාසල Sathiya හි ලියාපදිංචි කිරීම අවසන් කිරීමට මෙම ලිපිනය තහවුරු කරන්න. ${where(siFirst)} බොත්තම ඔබන්න.`],
    cta: { label: 'ඊමේල් තහවුරු කරන්න', url: link, fallback: FALLBACK.si },
    note: 'ඔබ මෙය ඉල්ලුවේ නැත්නම් මෙම ඊමේලය නොසලකා හරින්න.',
  };
  return render({
    subject: brandSubject(siFirst ? si.title : en.title),
    header: sathiyaHeader,
    lang,
    en,
    si,
    footer: siteFooter(webUrl),
  });
}

export function passwordReset({ link, lang, webUrl }: LinkEmailInput): Rendered {
  const siFirst = lang === 'si';
  const en: Content = {
    title: 'Reset your password',
    paras: ['We got a request to reset the password for your Sathiya account. Use the button to choose a new one.'],
    cta: { label: 'Reset password', url: link, fallback: FALLBACK.en },
    note: "Didn't ask for this? You can ignore this email. Your password stays the same.",
  };
  const si: Content = {
    title: 'ඔබගේ මුරපදය යළි සකසන්න',
    paras: [`ඔබගේ Sathiya ගිණුමේ මුරපදය යළි සැකසීමට ඉල්ලීමක් ලැබුණි. නව මුරපදයක් තෝරා ගැනීමට ${where(siFirst)} බොත්තම ඔබන්න.`],
    cta: { label: 'මුරපදය යළි සකසන්න', url: link, fallback: FALLBACK.si },
    note: 'ඔබ මෙය ඉල්ලුවේ නැත්නම් මෙම ඊමේලය නොසලකා හරින්න. ඔබගේ මුරපදය වෙනස් නොවේ.',
  };
  return render({
    subject: brandSubject(siFirst ? si.title : en.title),
    header: sathiyaHeader,
    lang,
    en,
    si,
    footer: siteFooter(webUrl),
  });
}
