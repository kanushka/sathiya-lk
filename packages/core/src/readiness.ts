// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { teachesSubject } from './availability';
import { DAYS, gradeOf, templateOf } from './lookup';
import { effectivePlan, planKey } from './plan';
import { activityCredit } from './progress';
import { isMinutes, staffingFor } from './staffing';
import { periodsFor, rowsFor, toMinutes } from './time';
import type { DayIndex, Entry, PeriodTemplate, PlanItem, SchoolClass, SchoolContext } from './types';

export type ReadinessCode =
  | 'grade-no-classes' | 'class-no-teacher' | 'class-no-template' | 'plan-empty' | 'plan-zero-target'
  | 'teacher-no-subjects' | 'teacher-no-grades' | 'teacher-no-max'
  | 'plan-exceeds-template' | 'per-day-unbuildable' | 'no-qualified-teacher'
  | 'no-specialist' | 'class-teacher-no-daily-subject' | 'class-teacher-wrong-grade'
  | 'capacity-short' | 'min-per-week-unreachable';

export interface ReadinessIssue {
  code: ReadinessCode;
  ref: { kind: 'grade' | 'class' | 'teacher' | 'subject' | 'school'; id: string };
  params: Record<string, string | number>;
}

const CODE_ORDER: ReadinessCode[] = [
  'grade-no-classes', 'class-no-teacher', 'class-no-template', 'plan-empty', 'plan-zero-target',
  'teacher-no-subjects', 'teacher-no-grades', 'teacher-no-max',
  'plan-exceeds-template', 'per-day-unbuildable', 'no-qualified-teacher',
  'no-specialist', 'class-teacher-no-daily-subject', 'class-teacher-wrong-grade',
  'capacity-short', 'min-per-week-unreachable',
];
// A teacher may hold no lessons (principal, librarian), so these only flag possibly forgotten setup.
const WARNING_CODES = new Set<ReadinessCode>(['teacher-no-subjects', 'teacher-no-grades', 'capacity-short', 'min-per-week-unreachable']);

const slotLengths = (t: PeriodTemplate, day: DayIndex): number[] =>
  periodsFor(t, day).map((p) => toMinutes(p.end) - toMinutes(p.start));

function reachable(lengths: number[], target: number): boolean {
  let sums = new Set<number>([0]);
  for (const len of lengths) {
    const next = new Set(sums);
    for (const s of sums) if (s + len <= target) next.add(s + len);
    sums = next;
  }
  return sums.has(target);
}

function dayCredit(t: PeriodTemplate, day: DayIndex, subjectId: string): number {
  return rowsFor(t, day)
    .filter((r) => r.type === 'activity' && r.subjectId === subjectId)
    .reduce((n, r) => n + toMinutes(r.end) - toMinutes(r.start), 0);
}

const optionIds = (item: PlanItem): string[] => (item.kind === 'subject' ? [item.subjectId] : item.optionSubjectIds);

export function readiness(ctx: SchoolContext, _entries: Entry[]): { blocking: ReadinessIssue[]; warnings: ReadinessIssue[] } {
  const issues: ReadinessIssue[] = [];
  const add = (code: ReadinessCode, kind: ReadinessIssue['ref']['kind'], id: string, params: ReadinessIssue['params'] = {}): void => {
    issues.push({ code, ref: { kind, id }, params });
  };
  const hasTeacher = (id: string | undefined): boolean => id !== undefined && ctx.teachers.some((t) => t.id === id);

  for (const number of ctx.school.grades) {
    const grade = ctx.grades.find((g) => g.number === number);
    if (!grade || !ctx.classes.some((c) => c.gradeId === grade.id)) add('grade-no-classes', 'grade', grade?.id ?? String(number), { grade: number });
  }

  for (const t of ctx.teachers) {
    if (!t.isPrimary && t.subjectIds.length === 0) add('teacher-no-subjects', 'teacher', t.id);
    if (t.grades.length === 0) add('teacher-no-grades', 'teacher', t.id);
    if (!(t.maxPerDay > 0)) add('teacher-no-max', 'teacher', t.id);
  }

  const demand = new Map<string, { needed: number; grades: Set<number> }>();
  const addDemand = (subjectId: string, perWeek: number, gradeNumber: number): void => {
    const d = demand.get(subjectId) ?? { needed: 0, grades: new Set<number>() };
    d.needed += perWeek;
    d.grades.add(gradeNumber);
    demand.set(subjectId, d);
  };
  let lessonDemand = 0;
  const seenGroups = new Set<string>();

  const classes: SchoolClass[] = [...ctx.classes];
  for (const cls of classes) {
    const grade = gradeOf(ctx, cls);
    const template = templateOf(ctx, cls);
    if (!hasTeacher(cls.classTeacherId)) add('class-no-teacher', 'class', cls.id);
    if (!template) add('class-no-template', 'class', cls.id);
    if (!grade) continue;

    const plan = effectivePlan(cls, grade);
    if (plan.length === 0) add('plan-empty', 'class', cls.id);
    for (const item of plan) {
      if (!(item.perWeek > 0)) add('plan-zero-target', 'class', cls.id, { classId: cls.id, planKey: planKey(item) });
    }

    const { mode, specialistSubjectIds } = staffingFor(grade, ctx);
    const qualified = (subjectId: string) => ctx.teachers.filter((t) => teachesSubject(t, subjectId, grade.number));
    const checked = new Set<string>();
    const needsQualified = (subjectId: string): void => {
      if (checked.has(subjectId)) return;
      checked.add(subjectId);
      if (qualified(subjectId).length === 0) add('no-qualified-teacher', 'class', cls.id, { classId: cls.id, subjectId, grade: grade.number });
    };

    for (const item of plan) {
      if (item.kind === 'group') {
        for (const id of item.optionSubjectIds) needsQualified(id);
        const blockKey = `${grade.id}|${cls.templateId}|${item.key}`;
        if (!isMinutes(item) && !seenGroups.has(blockKey)) {
          seenGroups.add(blockKey);
          lessonDemand += item.perWeek * item.optionSubjectIds.length;
          for (const id of item.optionSubjectIds) addDemand(id, item.perWeek, grade.number);
        }
        continue;
      }
      const specialist = mode === 'classTeacherPlusSpecialists' && specialistSubjectIds.includes(item.subjectId);
      if (!isMinutes(item)) lessonDemand += item.perWeek;
      if (specialist) {
        if (!isMinutes(item)) addDemand(item.subjectId, item.perWeek, grade.number);
      } else if (mode === 'subjectTeachers') {
        needsQualified(item.subjectId);
        if (!isMinutes(item)) addDemand(item.subjectId, item.perWeek, grade.number);
      }
      if (specialist && !qualified(item.subjectId).some((t) => t.id !== cls.classTeacherId)) {
        add('no-specialist', 'class', cls.id, { classId: cls.id, subjectId: item.subjectId });
      }
    }

    if (mode !== 'subjectTeachers' && cls.classTeacherId !== undefined && hasTeacher(cls.classTeacherId)) {
      const ct = ctx.teachers.find((t) => t.id === cls.classTeacherId)!;
      if (!ct.grades.includes(grade.number)) add('class-teacher-wrong-grade', 'class', cls.id, { classId: cls.id, teacherId: ct.id, grade: grade.number });
    }

    if (mode === 'subjectTeachers' && hasTeacher(cls.classTeacherId)) {
      const teacher = ctx.teachers.find((t) => t.id === cls.classTeacherId)!;
      const daily = plan.filter((item) => item.kind === 'subject' && (isMinutes(item) ? item.perDay !== undefined : item.perWeek >= 5));
      const subjectItems = plan.filter((item) => item.kind === 'subject');
      const onlyGroups =
        !subjectItems.some((item) => item.kind === 'subject' && teachesSubject(teacher, item.subjectId, grade.number)) &&
        plan.some((item) => item.kind === 'group' && item.optionSubjectIds.some((id) => teachesSubject(teacher, id, grade.number)));
      if (!onlyGroups && !daily.some((item) => item.kind === 'subject' && teachesSubject(teacher, item.subjectId, grade.number))) {
        add('class-teacher-no-daily-subject', 'class', cls.id, { classId: cls.id, teacherId: teacher.id });
      }
    }

    if (!template) continue;
    const slotCount = DAYS.reduce<number>((n, d) => n + periodsFor(template, d).length, 0);
    const slotMins = DAYS.reduce<number>((n, d) => n + slotLengths(template, d).reduce((a, b) => a + b, 0), 0);
    const periodsNeeded = plan.filter((i) => !isMinutes(i)).reduce((n, i) => n + Math.max(0, i.perWeek - activityCredit(template, i)), 0);
    const minutesNeeded = plan.filter(isMinutes).reduce((n, i) => n + Math.max(0, i.perWeek - activityCredit(template, i)), 0);
    if (periodsNeeded > slotCount) add('plan-exceeds-template', 'class', cls.id, { classId: cls.id, unit: 'periods', needed: periodsNeeded, available: slotCount });
    if (minutesNeeded > slotMins) add('plan-exceeds-template', 'class', cls.id, { classId: cls.id, unit: 'minutes', needed: minutesNeeded, available: slotMins });

    for (const item of plan) {
      if (item.kind !== 'subject' || !isMinutes(item) || item.perDay === undefined) continue;
      for (const day of DAYS) {
        const lengths = slotLengths(template, day);
        if (lengths.length === 0) continue;
        const remaining = item.perDay - dayCredit(template, day, item.subjectId);
        if (remaining > 0 && !reachable(lengths, remaining)) {
          add('per-day-unbuildable', 'class', cls.id, { classId: cls.id, planKey: planKey(item), day, minutes: remaining });
        }
      }
    }
  }

  for (const [subjectId, d] of demand) {
    const capacity = ctx.teachers
      .filter((t) => [...d.grades].some((g) => teachesSubject(t, subjectId, g)))
      .reduce((n, t) => n + t.maxPerDay * DAYS.length, 0);
    if (d.needed > capacity) add('capacity-short', 'subject', subjectId, { subjectId, needed: d.needed, capacity });
  }

  const minNeeded = ctx.teachers.reduce((n, t) => n + (t.minPerWeek ?? 0), 0);
  if (minNeeded > lessonDemand) add('min-per-week-unreachable', 'school', '', { needed: minNeeded, available: lessonDemand });

  const order = (i: ReadinessIssue): number => CODE_ORDER.indexOf(i.code);
  const sorted = issues
    .map((issue, idx) => ({ issue, idx }))
    .sort((a, b) => order(a.issue) - order(b.issue) || (a.issue.ref.id < b.issue.ref.id ? -1 : a.issue.ref.id > b.issue.ref.id ? 1 : 0) || a.idx - b.idx)
    .map((x) => x.issue);
  return { blocking: sorted.filter((i) => !WARNING_CODES.has(i.code)), warnings: sorted.filter((i) => WARNING_CODES.has(i.code)) };
}
