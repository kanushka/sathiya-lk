// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Grade, PlanItem, SchoolContext, StaffingMode } from './types';

const isEnglish = (s: { nameEn: string; nameSi?: string }): boolean =>
  /\benglish\b/i.test(s.nameEn) || /ඉංග්‍රීසි|ඉංග්‍රිසි/.test(s.nameSi ?? '');

export function staffingFor(grade: Grade, ctx: SchoolContext): { mode: StaffingMode; specialistSubjectIds: string[] } {
  if (grade.staffing) return { mode: grade.staffing.mode, specialistSubjectIds: grade.staffing.specialistSubjectIds ?? [] };
  if (grade.number <= 2) return { mode: 'classTeacherAll', specialistSubjectIds: [] };
  if (grade.number <= 5) {
    return { mode: 'classTeacherPlusSpecialists', specialistSubjectIds: ctx.subjects.filter(isEnglish).map((s) => s.id) };
  }
  return { mode: 'subjectTeachers', specialistSubjectIds: [] };
}

export const isMinutes = (item: PlanItem): boolean => item.unit === 'minutes';
