// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Bilingual, Lang, Teacher, TeacherTitle } from './types';

const nameIn = (x: Bilingual, lang: Lang): string => ((lang === 'si' ? x.nameSi : x.nameEn) ?? '').trim();
const other = (lang: Lang): Lang => (lang === 'si' ? 'en' : 'si');

export function pickName(x: Bilingual, lang: Lang): string {
  return nameIn(x, lang) || nameIn(x, other(lang));
}

export function hasName(x: Bilingual): boolean {
  return pickName(x, 'en') !== '';
}

type TeacherNames = Pick<Teacher, 'name' | 'nameSi' | 'title'>;
const teacherBilingual = (t: Pick<Teacher, 'name' | 'nameSi'>): Bilingual => ({ nameEn: t.name, ...(t.nameSi === undefined ? {} : { nameSi: t.nameSi }) });

export function teacherNameMissing(t: Pick<Teacher, 'name' | 'nameSi'>, lang: Lang): boolean {
  return nameIn(teacherBilingual(t), lang) === '';
}

export const TEACHER_TITLE_LABELS: Record<Lang, Record<TeacherTitle, string>> = {
  en: { Mr: 'Mr.', Mrs: 'Mrs.', Miss: 'Miss', Ms: 'Ms.', Dr: 'Dr.', Rev: 'Rev.', 'Ven.': 'Ven.' },
  si: { Mr: 'මහතා', Mrs: 'මහත්මිය', Miss: 'මෙනවිය', Ms: 'මිය', Dr: 'ආචාර්ය', Rev: 'පූජ්‍ය', 'Ven.': 'පූජ්‍ය' },
};

// Sinhala honorifics for laypeople follow the name; clergy and doctoral titles precede it.
const TITLE_AFTER: Record<Lang, ReadonlySet<TeacherTitle>> = {
  en: new Set<TeacherTitle>(),
  si: new Set<TeacherTitle>(['Mr', 'Mrs', 'Miss', 'Ms']),
};

// Records saved with the retired "Thero" title read as "Ven. <name> Thero" and are rewritten on next save.
export function normalizeTeacher<T extends { name: string; title?: string }>(teacher: T): T {
  if (teacher.title !== 'Thero') return teacher;
  const name = teacher.name.trim();
  return { ...teacher, title: 'Ven.', name: /\bthero$/i.test(name) ? name : `${name} Thero` };
}

const PREFIX = /^(mrs|mr|miss|ms|dr|rev|ven)\.?\s+(\S.*)$/i;
const PREFIX_TITLE: Record<string, TeacherTitle> = { mrs: 'Mrs', mr: 'Mr', miss: 'Miss', ms: 'Ms', dr: 'Dr', rev: 'Rev', ven: 'Ven.' };

export function splitTitle(name: string): { title?: TeacherTitle; name: string } {
  const m = PREFIX.exec(name.trim());
  const title = m?.[1] ? PREFIX_TITLE[m[1].toLowerCase()] : undefined;
  return m?.[2] && title ? { title, name: m[2] } : { name };
}

export function teacherDisplayName(raw: TeacherNames, lang: Lang = 'en'): string {
  const shown: Lang = teacherNameMissing(raw, lang) && !teacherNameMissing(raw, other(lang)) ? other(lang) : lang;
  return shown === 'si' ? withTitle(raw.nameSi!.trim(), raw.title, 'si') : englishDisplay(raw);
}

function withTitle(name: string, title: TeacherTitle | undefined, lang: Lang): string {
  if (!title) return name;
  const label = TEACHER_TITLE_LABELS[lang][title];
  return TITLE_AFTER[lang].has(title) ? `${name} ${label}` : `${label} ${name}`;
}

// English names may still carry a typed title ("Mrs. N. Perera") from before titles were a separate field.
function englishDisplay(raw: TeacherNames): string {
  const teacher = normalizeTeacher(raw);
  const split = splitTitle(teacher.name);
  const title = teacher.title ?? split.title;
  const name = split.title === undefined || split.title === title ? split.name : teacher.name.trim();
  return withTitle(name, title, 'en');
}
