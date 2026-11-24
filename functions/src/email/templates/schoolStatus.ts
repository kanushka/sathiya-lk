// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { brandSubject, render, schoolFooter, schoolHeader, type Rendered, type SchoolBrand } from './layout';

export interface SchoolStatusInput {
  school: SchoolBrand;
  loginUrl: string;
  webUrl?: string;
}

export function schoolSuspended({ school }: SchoolStatusInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: brandSubject(`${name} is suspended`),
    header: schoolHeader(school),
    en: {
      title: 'Your school is suspended',
      status: { tone: 'bad', badge: 'Suspended', text: 'Sign-in is off for admins and teachers.' },
      paras: [
        [{ b: name }, " has been suspended on Sathiya. Admins and teachers can't sign in until it is reactivated."],
        'Your timetables and setup are kept.',
      ],
      note: 'Think this is a mistake? Reply to this email.',
    },
    si: {
      title: 'ඔබගේ පාසල අත්හිටුවා ඇත',
      paras: [
        `${si} Sathiya හි අත්හිටුවා ඇත. නැවත සක්‍රිය කරන තෙක් පරිපාලකයන්ට සහ ගුරුවරුන්ට පිවිසිය නොහැක.`,
        'ඔබගේ දත්ත ආරක්ෂිතව තබා ඇත.',
      ],
      note: 'මෙය වැරදීමක් යැයි ඔබ සිතන්නේ නම් මෙම ඊමේලයට පිළිතුරු දෙන්න.',
    },
    footer: schoolFooter(school),
  });
}

export function schoolReactivated({ school, loginUrl }: SchoolStatusInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: brandSubject(`${name} is active again`),
    header: schoolHeader(school),
    en: {
      title: 'Your school is active again',
      status: { tone: 'ok', badge: 'Active', text: 'Admins and teachers can sign in again.' },
      paras: [[{ b: name }, ' has been reactivated on Sathiya. Everything is where you left it.']],
      cta: { label: 'Open Sathiya', url: loginUrl },
    },
    si: {
      title: 'ඔබගේ පාසල නැවත සක්‍රියයි',
      paras: [`${si} Sathiya හි නැවත සක්‍රිය කර ඇත. පරිපාලකයන්ට සහ ගුරුවරුන්ට නැවත පිවිසිය හැක.`],
    },
    footer: schoolFooter(school),
  });
}
