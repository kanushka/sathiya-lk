// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { brandSubject, render, schoolHeader, type Rendered, type SchoolBrand } from './layout';
import { siteFooter } from './footer';

export interface SchoolRegisteredInput {
  adminName: string;
  school: SchoolBrand;
  loginUrl: string;
  webUrl?: string;
  /** Waiting for super admin review: setup works, publishing, invites and printing do not yet. */
  pending?: boolean;
}

export function schoolRegistered({ adminName, school, loginUrl, webUrl, pending }: SchoolRegisteredInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: brandSubject(`${name} is registered`),
    header: schoolHeader(school),
    en: {
      ...(pending && { status: { tone: 'bad' as const, badge: 'Under review', text: 'Sathiya is reviewing your school before it goes live.' } }),
      title: `Welcome, ${adminName}`,
      paras: [[{ b: name }, ' is registered on Sathiya. Three steps to your first timetable:']],
      steps: [
        'Add your subjects, period times and classes.',
        'Add your teachers. Each one gets a login slip.',
        'Build the timetable, then publish it.',
      ],
      cta: { label: 'Open Sathiya', url: loginUrl },
      note: pending
        ? 'You can set up the school and draft the timetable now. Publishing, admin invites and printing open after approval.'
        : "Invite other admins from school settings when you're ready.",
    },
    si: {
      title: `සාදරයෙන් පිළිගනිමු, ${adminName}`,
      paras: [`${si} Sathiya හි ලියාපදිංචි කර ඇත. ආරම්භ කිරීමට:`],
      steps: [
        'විෂයන්, කාලච්ඡේද වේලාවන් සහ පන්ති එක් කරන්න.',
        'ගුරුවරුන් එක් කරන්න. සෑම ගුරුවරයෙකුටම පිවිසුම් පත්‍රිකාවක් ලැබේ.',
        'කාලසටහන සාදා එය ප්‍රකාශයට පත් කරන්න.',
      ],
      ...(pending && {
        note: 'ඔබේ පාසල Sathiya විසින් සමාලෝචනය කරමින් පවතී. දැන් සැකසීම සහ කාලසටහන කෙටුම්පත් කිරීම කළ හැක; ප්‍රකාශයට පත් කිරීම, පරිපාලක ආරාධනා සහ මුද්‍රණය අනුමත කිරීමෙන් පසු ලැබේ.',
      }),
    },
    footer: siteFooter(webUrl),
  });
}
