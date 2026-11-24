// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Hhmm } from '@sathiya/core';
import { render, schoolFooter, schoolHeader, type Fact, type Rendered, type SchoolBrand } from './layout';

export interface ReliefMailRow {
  period: number;
  start: Hhmm;
  end: Hhmm;
  className: string;
  subject: string;
  forTeacher: string;
  subjectSi?: string;
  forTeacherSi?: string;
}

export interface ReliefAssignedInput {
  school: SchoolBrand;
  teacherName: string;
  teacherNameSi?: string;
  date: string;
  rows: ReliefMailRow[];
  todayUrl: string;
}

export interface ReliefCancelledInput {
  school: SchoolBrand;
  teacherName: string;
  teacherNameSi?: string;
  date: string;
  todayUrl: string;
}

const footer = (school: SchoolBrand) => schoolFooter(school, 'Not expecting this? Ignore it.');

export function reliefAssigned({ school, teacherName, teacherNameSi, date, rows, todayUrl }: ReliefAssignedInput): Rendered {
  const first = rows[0]!;
  const subject = rows.length === 1 ? `Relief today: P${first.period} ${first.className} ${first.subject}` : `${rows.length} relief periods today`;
  const factsEn: Fact[] = rows.map((r) => ({ label: `P${r.period} · ${r.start}–${r.end}`, value: `${r.className} · ${r.subject} (for ${r.forTeacher})` }));
  const factsSi: Fact[] = rows.map((r) => ({ label: `වාරය ${r.period} · ${r.start}–${r.end}`, value: `${r.className} · ${r.subjectSi ?? r.subject} (${r.forTeacherSi ?? r.forTeacher} වෙනුවට)` }));
  const si = teacherNameSi ?? teacherName;
  return render({
    subject,
    header: schoolHeader(school),
    en: {
      title: rows.length === 1 ? 'You have a relief period today' : `You have ${rows.length} relief periods today`,
      paras: [['Hello ', { b: teacherName }, `, you are covering the following on ${date}.`]],
      facts: factsEn,
      cta: { label: "Open today's timetable", url: todayUrl },
      note: 'This is the full current list. A later email replaces it if anything changes.',
    },
    si: {
      title: rows.length === 1 ? 'අද ඔබට ආදේශක වාරයක් ඇත' : `අද ඔබට ආදේශක වාර ${rows.length}ක් ඇත`,
      paras: [`${si}, ${date} දින ඔබ ආවරණය කළ යුතු වාර පහත දැක්වේ.`],
      facts: factsSi,
    },
    footer: footer(school),
  });
}

export function reliefCancelled({ school, teacherName, teacherNameSi, date, todayUrl }: ReliefCancelledInput): Rendered {
  const si = teacherNameSi ?? teacherName;
  return render({
    subject: 'Relief cancelled today',
    header: schoolHeader(school),
    en: {
      title: 'Your relief periods are cancelled',
      paras: [['Hello ', { b: teacherName }, `, you no longer have relief periods on ${date}.`]],
      cta: { label: "Open today's timetable", url: todayUrl },
    },
    si: {
      title: 'ඔබගේ ආදේශක වාර අවලංගු කර ඇත',
      paras: [`${si}, ${date} දින ඔබට තවදුරටත් ආදේශක වාර නොමැත.`],
    },
    footer: footer(school),
  });
}
