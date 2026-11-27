// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Grade, PlanItem, SchoolContext, StaffingMode } from './types';

const isEnglish = (s: { nameEn: string; nameSi?: string }): boolean =>
  /\benglish\b/i.test(s.nameEn) || /ඉංග්‍රීසි|ඉංග්‍රිසි/.test(s.nameSi ?? '');

export function defaultSpecialistIds(ctx: SchoolContext): string[] {
  return ctx.subjects.filter(isEnglish).map((s) => s.id);
}

export const PRIMARY_GRADE_MAX = 5;

export const defaultPrimaryGrades = (schoolGrades: readonly number[]): number[] =>
  [...schoolGrades].filter((g) => g <= PRIMARY_GRADE_MAX).sort((a, b) => a - b);

export function staffingFor(grade: Grade, ctx: SchoolContext): { mode: StaffingMode; specialistSubjectIds: string[] } {
  if (grade.staffing) return { mode: grade.staffing.mode, specialistSubjectIds: grade.staffing.specialistSubjectIds ?? [] };
  if (grade.number <= 2) return { mode: 'classTeacherAll', specialistSubjectIds: [] };
  if (grade.number <= PRIMARY_GRADE_MAX) {
    return { mode: 'classTeacherPlusSpecialists', specialistSubjectIds: defaultSpecialistIds(ctx) };
  }
  return { mode: 'subjectTeachers', specialistSubjectIds: [] };
}

export const isMinutes = (item: PlanItem): boolean => item.unit === 'minutes';
