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

// Fixed words, not Intl: ICU's Sinhala month names differ between Node versions.
const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  si: ['ජනවාරි', 'පෙබරවාරි', 'මාර්තු', 'අප්‍රේල්', 'මැයි', 'ජූනි', 'ජූලි', 'අගෝස්තු', 'සැප්තැම්බර්', 'ඔක්තෝබර්', 'නොවැම්බර්', 'දෙසැම්බර්'],
};
const WEEKDAYS = {
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  si: ['ඉරිදා', 'සඳුදා', 'අඟහරුවාදා', 'බදාදා', 'බ්‍රහස්පතින්දා', 'සිකුරාදා', 'සෙනසුරාදා'],
};

function dateIn(lang: 'en' | 'si', date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const [y, m, day, wd] = [d.getUTCFullYear(), MONTHS[lang][d.getUTCMonth()], d.getUTCDate(), WEEKDAYS[lang][d.getUTCDay()]];
  return lang === 'si' ? `${y} ${m} ${day}, ${wd}` : `${wd}, ${day} ${m} ${y}`;
}

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
      paras: [['Hello ', { b: teacherName }, `, you are covering the following on ${dateIn('en', date)}.`]],
      facts: factsEn,
      cta: { label: "Open today's timetable", url: todayUrl },
      note: 'This is the full current list. A later email replaces it if anything changes.',
    },
    si: {
      title: rows.length === 1 ? 'අද ඔබට ආදේශක වාරයක් ඇත' : `අද ඔබට ආදේශක වාර ${rows.length}ක් ඇත`,
      paras: [`${si}, ${dateIn('si', date)} දින ඔබ ආවරණය කළ යුතු වාර පහත දැක්වේ.`],
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
      paras: [['Hello ', { b: teacherName }, `, you no longer have relief periods on ${dateIn('en', date)}.`]],
      cta: { label: "Open today's timetable", url: todayUrl },
    },
    si: {
      title: 'ඔබගේ ආදේශක වාර අවලංගු කර ඇත',
      paras: [`${si}, ${dateIn('si', date)} දින ඔබට තවදුරටත් ආදේශක වාර නොමැත.`],
    },
    footer: footer(school),
  });
}
