// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type Bilingual } from '@sathiya/core';
import { brandSubject, render, sathiyaHeader, schoolFooter, schoolHeader, type Fact, type Rendered, type SchoolBrand } from './layout';
import { siteFooter } from './footer';

export interface NameChangeRequestedInput {
  schoolId: string;
  censusNo?: string;
  /** Name in the MOE school list for the census number; undefined when the school is not listed. */
  moeName?: string;
  current: Bilingual;
  requested: Bilingual;
  requester: { name?: string; email?: string };
  schoolUrl: string;
  webUrl?: string;
}

const none = 'None';

function nameFacts(prefix: string, n: Bilingual): Fact[] {
  return [
    { label: `${prefix} name`, value: { b: n.nameEn || none } },
    { label: `${prefix} Sinhala name`, value: n.nameSi || none },
  ];
}

export function nameChangeRequested({ schoolId, censusNo, moeName, current, requested, requester, schoolUrl, webUrl }: NameChangeRequestedInput): Rendered {
  const name = pickName(current, 'en') || schoolId;
  const who = [requester.name, requester.email && `<${requester.email}>`].filter(Boolean).join(' ') || 'Unknown';
  return render({
    subject: brandSubject(`Name change to review: ${name}`),
    header: { ...sathiyaHeader, badge: 'Super admin' },
    en: {
      title: 'A school asked to change its name',
      status: { tone: 'bad', badge: 'Pending', text: 'The current name stays in use until you approve the change.' },
      paras: ['Approve or reject the new name from the school page.'],
      facts: [
        { label: 'School ID', value: schoolId },
        { label: 'Census no', value: censusNo ?? none },
        { label: 'MOE list name', value: moeName ?? 'Not in the MOE list' },
        ...nameFacts('Current', current),
        ...nameFacts('Requested', requested),
        { label: 'Requested by', value: who },
      ],
      cta: { label: 'Review name change', url: schoolUrl },
    },
    footer: siteFooter(webUrl),
  });
}

export interface NameChangeApprovedInput {
  /** The school with its new name. */
  school: SchoolBrand;
  oldName: Bilingual;
  adminUrl: string;
}

export function nameChangeApproved({ school, oldName, adminUrl }: NameChangeApprovedInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: brandSubject(`${name}: name change is approved`),
    header: schoolHeader(school),
    en: {
      title: 'Your new school name is approved',
      status: { tone: 'ok', badge: 'Approved', text: 'Sathiya now shows the new name everywhere.' },
      paras: [['The school is now called ', { b: name }, '. Published timetables, print sheets and the Sathiya directory use the new name.']],
      facts: [
        { label: 'Previous name', value: pickName(oldName, 'en') || none },
        ...(oldName.nameSi ? [{ label: 'Previous Sinhala name', value: oldName.nameSi }] : []),
      ],
      cta: { label: 'Open school profile', url: adminUrl },
    },
    si: {
      title: 'ඔබේ පාසලේ නව නම අනුමත කර ඇත',
      paras: [`පාසල දැන් ${si} ලෙස හැඳින්වේ. ප්‍රකාශිත කාලසටහන්, මුද්‍රණ පත්‍ර සහ Sathiya නාමාවලිය නව නම භාවිත කරයි.`],
    },
    footer: schoolFooter(school),
  });
}

export interface NameChangeRejectedInput {
  /** The school with its current, unchanged name. */
  school: SchoolBrand;
  requested: Bilingual;
  reason: string;
  contactEmail: string;
}

export function nameChangeRejected({ school, requested, reason, contactEmail }: NameChangeRejectedInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: brandSubject(`${name}: name change was not approved`),
    header: schoolHeader(school),
    en: {
      title: 'Your name change was not approved',
      status: { tone: 'bad', badge: 'Not approved', text: 'The school keeps its current name.' },
      paras: [['The school is still called ', { b: name }, '. You can send a new request from the school profile.']],
      facts: [
        { label: 'Requested name', value: requested.nameEn || none },
        ...(requested.nameSi ? [{ label: 'Requested Sinhala name', value: requested.nameSi }] : []),
      ],
      quoteLabel: 'Reason',
      quote: reason,
      note: `Questions? Write to ${contactEmail} or reply to this email.`,
    },
    si: {
      title: 'නම වෙනස් කිරීම අනුමත කර නැත',
      paras: [`පාසල තවමත් ${si} ලෙස හැඳින්වේ. පාසල් පැතිකඩෙන් නව ඉල්ලීමක් යැවිය හැක.`],
      note: `ප්‍රශ්න ඇත්නම් ${contactEmail} වෙත ලියන්න හෝ මෙම ඊමේලයට පිළිතුරු දෙන්න.`,
    },
    footer: schoolFooter(school),
  });
}
