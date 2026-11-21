// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { render, schoolHeader, type Rendered, type SchoolBrand } from './layout';

export interface SchoolStatusInput {
  school: SchoolBrand;
  loginUrl: string;
  webUrl?: string;
}

export function schoolSuspended({ school }: SchoolStatusInput): Rendered {
  const si = pickName({ nameEn: school.nameEn, nameSi: school.nameSi }, 'si');
  return render({
    subject: `${school.nameEn} has been suspended on Sathiya`,
    header: schoolHeader(school),
    en: {
      greeting: 'Hello,',
      paras: [
        [{ b: school.nameEn }, ' has been suspended on Sathiya. Admins and teachers cannot sign in to it until it is reactivated.'],
        'Your data is kept.',
      ],
      note: 'If you think this is a mistake, reply to this email.',
    },
    si: {
      greeting: 'ආයුබෝවන්,',
      paras: [
        `${si} Sathiya හි අත්හිටුවා ඇත. නැවත සක්‍රිය කරන තෙක් පරිපාලකයන්ට සහ ගුරුවරුන්ට පිවිසිය නොහැක.`,
        'ඔබගේ දත්ත ආරක්ෂිතව තබා ඇත.',
      ],
      note: 'මෙය වැරදීමක් යැයි ඔබ සිතන්නේ නම් මෙම ඊමේලයට පිළිතුරු දෙන්න.',
    },
    footer: { en: `Sent by Sathiya for ${school.nameEn}.` },
  });
}

export function schoolReactivated({ school, loginUrl }: SchoolStatusInput): Rendered {
  const si = pickName({ nameEn: school.nameEn, nameSi: school.nameSi }, 'si');
  return render({
    subject: `${school.nameEn} is active again on Sathiya`,
    header: schoolHeader(school),
    en: {
      greeting: 'Hello,',
      paras: [[{ b: school.nameEn }, ' has been reactivated on Sathiya. Admins and teachers can sign in again.']],
      cta: { label: 'Open Sathiya', url: loginUrl },
    },
    si: {
      greeting: 'ආයුබෝවන්,',
      paras: [`${si} Sathiya හි නැවත සක්‍රිය කර ඇත. පරිපාලකයන්ට සහ ගුරුවරුන්ට නැවත පිවිසිය හැක.`],
    },
    footer: { en: `Sent by Sathiya for ${school.nameEn}.` },
  });
}
