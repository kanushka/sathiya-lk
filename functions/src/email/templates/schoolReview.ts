// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { brandSubject, render, sathiyaHeader, schoolFooter, schoolHeader, type Fact, type Rendered, type SchoolBrand } from './layout';
import { siteFooter } from './footer';

export interface NewSchoolDetails {
  schoolId: string;
  nameEn: string;
  nameSi?: string;
  censusNo?: string;
  type: string;
  district: string;
  city: string;
  address?: string;
  medium?: string[];
  grades: number[];
  registrant: { name: string; email?: string };
}

export interface DuplicateRow {
  name: string;
  /** School id, or census number for an MOE list row. */
  id: string;
  district?: string;
  city?: string;
  status?: string;
}

export interface SchoolListedInput {
  school: NewSchoolDetails;
  schoolUrl: string;
  webUrl?: string;
}

export interface SchoolPendingInput extends SchoolListedInput {
  similarRegistered: DuplicateRow[];
  similarMoe: DuplicateRow[];
  sameDistrict: DuplicateRow[];
}

const MEDIUM: Record<string, string> = { si: 'Sinhala', ta: 'Tamil', en: 'English' };

const span = (g: number[]): string => {
  if (!g.length) return '—';
  const contiguous = g.every((n, i) => i === 0 || n === g[i - 1]! + 1);
  return contiguous && g.length > 1 ? `${g[0]}–${g[g.length - 1]}` : g.join(', ');
};

function facts(s: NewSchoolDetails): Fact[] {
  return [
    { label: 'School', value: { b: s.nameEn || s.nameSi || s.schoolId } },
    ...(s.nameEn && s.nameSi ? [{ label: 'Sinhala name', value: s.nameSi }] : []),
    { label: 'School ID', value: s.schoolId },
    { label: 'Census no', value: s.censusNo ?? 'None' },
    { label: 'Type', value: s.type },
    { label: 'District', value: s.district },
    { label: 'City', value: s.city },
    ...(s.address ? [{ label: 'Address', value: s.address }] : []),
    { label: 'Medium', value: s.medium?.length ? s.medium.map((m) => MEDIUM[m] ?? m).join(', ') : 'Not given' },
    { label: 'Grades', value: span(s.grades) },
    { label: 'Registrant', value: s.registrant.email ? `${s.registrant.name} <${s.registrant.email}>` : s.registrant.name },
  ];
}

const row = (r: DuplicateRow): string =>
  `- ${r.name} · ${r.id}${[r.city, r.district].filter(Boolean).length ? ` (${[r.city, r.district].filter(Boolean).join(', ')})` : ''}${r.status && r.status !== 'active' ? ` [${r.status}]` : ''}`;

const section = (title: string, rows: DuplicateRow[]): string => [title, ...(rows.length ? rows.map(row) : ['- None'])].join('\n');

export function schoolListed({ school, schoolUrl, webUrl }: SchoolListedInput): Rendered {
  const name = school.nameEn || school.nameSi || school.schoolId;
  return render({
    subject: brandSubject(`New school (MOE listed): ${name}`),
    header: { ...sathiyaHeader, badge: 'Super admin' },
    en: {
      title: 'A listed school registered',
      status: { tone: 'ok', badge: 'Active', text: 'Census number matched the MOE list, so the school is live.' },
      paras: ['No action is needed. Suspend the school from its page if the registration looks wrong.'],
      facts: facts(school),
      cta: { label: 'Open school page', url: schoolUrl },
    },
    footer: siteFooter(webUrl),
  });
}

export function schoolPendingReview({ school, schoolUrl, webUrl, similarRegistered, similarMoe, sameDistrict }: SchoolPendingInput): Rendered {
  const name = school.nameEn || school.nameSi || school.schoolId;
  return render({
    subject: brandSubject(`School to review: ${name}`),
    header: { ...sathiyaHeader, badge: 'Super admin' },
    en: {
      title: 'A school is waiting for review',
      status: { tone: 'bad', badge: 'Pending', text: 'Not in the MOE list. Approve or reject it from the school page.' },
      paras: [],
      facts: facts(school),
      quoteLabel: 'Possible duplicates',
      quote: [
        section('Similar names, registered:', similarRegistered),
        section('Similar names, MOE list:', similarMoe),
        section(`Registered in ${school.district}:`, sameDistrict),
      ].join('\n\n'),
      cta: { label: 'Review school', url: schoolUrl },
    },
    footer: siteFooter(webUrl),
  });
}

export interface SchoolApprovedInput {
  school: SchoolBrand;
  adminUrl: string;
}

export interface SchoolRejectedInput {
  school: SchoolBrand;
  reason: string;
  contactEmail: string;
}

export function schoolApproved({ school, adminUrl }: SchoolApprovedInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: brandSubject(`${name} is approved`),
    header: schoolHeader(school),
    en: {
      title: 'Your school is approved',
      status: { tone: 'ok', badge: 'Approved', text: 'Your school is now live on Sathiya.' },
      paras: [[{ b: name }, ' is approved. Publishing, admin invites and printing are now open, and the school is listed in the Sathiya directory.']],
      cta: { label: 'Open school admin', url: adminUrl },
    },
    si: {
      title: 'ඔබගේ පාසල අනුමත කර ඇත',
      paras: [`${si} අනුමත කර ඇත. දැන් කාලසටහන ප්‍රකාශයට පත් කිරීම, පරිපාලක ආරාධනා සහ මුද්‍රණය කළ හැක.`],
    },
    footer: schoolFooter(school),
  });
}

export function schoolRejected({ school, reason, contactEmail }: SchoolRejectedInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: brandSubject(`${name} was not approved`),
    header: schoolHeader(school),
    en: {
      title: 'Your school was not approved',
      status: { tone: 'bad', badge: 'Not approved', text: 'The school is not listed and cannot be published.' },
      paras: [
        [{ b: name }, ' was not approved on Sathiya.'],
        'You can remove the registration from the Not approved screen when you sign in.',
      ],
      quoteLabel: 'Reason',
      quote: reason,
      note: `Questions? Write to ${contactEmail} or reply to this email.`,
    },
    si: {
      title: 'ඔබගේ පාසල අනුමත කර නැත',
      paras: [`${si} Sathiya හි අනුමත කර නැත. ඔබට පිවිසීමෙන් පසු ලියාපදිංචිය ඉවත් කළ හැක.`],
      note: `ප්‍රශ්න ඇත්නම් ${contactEmail} වෙත ලියන්න හෝ මෙම ඊමේලයට පිළිතුරු දෙන්න.`,
    },
    footer: schoolFooter(school),
  });
}
