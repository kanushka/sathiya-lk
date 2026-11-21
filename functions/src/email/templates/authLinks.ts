// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { render, sathiyaHeader, type Rendered } from './layout';
import { siteFooter } from './footer';

export interface LinkEmailInput {
  link: string;
  lang?: 'en' | 'si';
  webUrl?: string;
}

// Sent by sendAuthEmail with Admin SDK generated links; `lang` only orders the bilingual subject.
const subject = (en: string, si: string, lang?: 'en' | 'si'): string => (lang === 'si' ? `${si} · ${en}` : `${en} · ${si}`);

export function verifyEmail({ link, lang, webUrl }: LinkEmailInput): Rendered {
  return render({
    subject: subject('Confirm your email for Sathiya', 'ඔබගේ ඊමේල් තහවුරු කරන්න', lang),
    header: sathiyaHeader,
    en: {
      greeting: 'Hello,',
      paras: ['Please confirm this email address so you can register your school on Sathiya.'],
      cta: { label: 'Confirm email', url: link },
      note: "If you didn't ask for this, you can ignore this email.",
    },
    si: {
      greeting: 'ආයුබෝවන්,',
      paras: ['ඔබගේ පාසල Sathiya හි ලියාපදිංචි කිරීමට මෙම ඊමේල් ලිපිනය තහවුරු කරන්න. ඉහත බොත්තම ඔබන්න.'],
    },
    footer: siteFooter(webUrl),
  });
}

export function passwordReset({ link, lang, webUrl }: LinkEmailInput): Rendered {
  return render({
    subject: subject('Reset your Sathiya password', 'ඔබගේ මුරපදය යළි සකසන්න', lang),
    header: sathiyaHeader,
    en: {
      greeting: 'Hello,',
      paras: ['We got a request to reset the password for your Sathiya account. Use the button below to choose a new one.'],
      cta: { label: 'Reset password', url: link },
      note: "If you didn't ask for this, you can ignore this email. Your password stays the same.",
    },
    si: {
      greeting: 'ආයුබෝවන්,',
      paras: ['ඔබගේ Sathiya ගිණුමේ මුරපදය යළි සැකසීමට ඉල්ලීමක් ලැබුණි. නව මුරපදයක් තෝරා ගැනීමට ඉහත බොත්තම ඔබන්න.'],
    },
    footer: siteFooter(webUrl),
  });
}
