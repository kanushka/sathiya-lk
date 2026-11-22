// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Bilingual, Lang, Teacher, TeacherTitle } from './types';

export function pickName(x: Bilingual, lang: Lang): string {
  if (lang === 'si' && x.nameSi && x.nameSi.trim() !== '') return x.nameSi;
  return x.nameEn;
}

export const TEACHER_TITLE_LABELS: Record<Lang, Record<TeacherTitle, string>> = {
  en: { Mr: 'Mr.', Mrs: 'Mrs.', Miss: 'Miss', Ms: 'Ms.', Dr: 'Dr.', Rev: 'Rev.', 'Ven.': 'Ven.', Thero: 'Thero' },
  si: { Mr: 'මහතා', Mrs: 'මහත්මිය', Miss: 'මෙනවිය', Ms: 'මිය', Dr: 'ආචාර්ය', Rev: 'පූජ්‍ය', 'Ven.': 'පූජ්‍ය', Thero: 'හිමි' },
};

// Sinhala honorifics for laypeople follow the name; clergy and doctoral titles precede it.
const TITLE_AFTER: Record<Lang, ReadonlySet<TeacherTitle>> = {
  en: new Set<TeacherTitle>(['Thero']),
  si: new Set<TeacherTitle>(['Mr', 'Mrs', 'Miss', 'Ms', 'Thero']),
};

const PREFIX = /^(mrs|mr|miss|ms|dr|rev|ven)\.?\s+(\S.*)$/i;
const PREFIX_TITLE: Record<string, TeacherTitle> = { mrs: 'Mrs', mr: 'Mr', miss: 'Miss', ms: 'Ms', dr: 'Dr', rev: 'Rev', ven: 'Ven.' };

export function splitTitle(name: string): { title?: TeacherTitle; name: string } {
  const m = PREFIX.exec(name.trim());
  const title = m?.[1] ? PREFIX_TITLE[m[1].toLowerCase()] : undefined;
  return m?.[2] && title ? { title, name: m[2] } : { name };
}

export function teacherDisplayName(teacher: Pick<Teacher, 'name' | 'title'>, lang: Lang = 'en'): string {
  const split = splitTitle(teacher.name);
  const title = teacher.title ?? split.title;
  const name = split.title === undefined || split.title === title ? split.name : teacher.name.trim();
  if (!title) return name;
  const label = TEACHER_TITLE_LABELS[lang][title];
  return TITLE_AFTER[lang].has(title) ? `${name} ${label}` : `${label} ${name}`;
}
