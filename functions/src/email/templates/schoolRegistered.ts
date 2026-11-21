// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { render, schoolHeader, type Rendered, type SchoolBrand } from './layout';
import { siteFooter } from './footer';

export interface SchoolRegisteredInput {
  adminName: string;
  school: SchoolBrand;
  loginUrl: string;
  webUrl?: string;
}

export function schoolRegistered({ adminName, school, loginUrl, webUrl }: SchoolRegisteredInput): Rendered {
  const si = pickName({ nameEn: school.nameEn, nameSi: school.nameSi }, 'si');
  return render({
    subject: `Welcome to Sathiya: ${school.nameEn} is registered`,
    header: schoolHeader(school),
    en: {
      greeting: `Hello ${adminName},`,
      paras: [[{ b: school.nameEn }, ' is now registered on Sathiya. Here is how to get started:']],
      steps: [
        'Add your subjects, period times and classes.',
        'Add your teachers. Each one gets a login slip.',
        'Build the timetable, then publish it.',
      ],
      cta: { label: 'Open Sathiya', url: loginUrl },
      note: 'Invite other admins from the school settings when you are ready.',
    },
    si: {
      greeting: `ආයුබෝවන් ${adminName},`,
      paras: [`${si} Sathiya හි ලියාපදිංචි කර ඇත. ආරම්භ කිරීමට:`],
      steps: [
        'විෂයන්, කාලච්ඡේද වේලාවන් සහ පන්ති එක් කරන්න.',
        'ගුරුවරුන් එක් කරන්න. සෑම ගුරුවරයෙකුටම පිවිසුම් පත්‍රිකාවක් ලැබේ.',
        'කාලසටහන සාදා එය ප්‍රකාශයට පත් කරන්න.',
      ],
    },
    footer: siteFooter(webUrl),
  });
}
