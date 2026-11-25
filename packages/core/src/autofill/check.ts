// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { isExemptPlacement, teacherDayLoad, teachesSubject } from '../availability';
import { findConflicts, withTeacherIds } from '../clash';
import { DAYS, findClass, gradeOf, templateOf } from '../lookup';
import { classPlacement } from '../progress';
import { effectivePlan, entryPlanKey, planKey } from '../plan';
import { isMinutes, staffingFor } from '../staffing';
import { rowsFor, slotMinutes, toMinutes, windowOf } from '../time';
import type { DayIndex, Entry, EntryDraft, PlanItem, SchoolClass, SchoolContext } from '../types';

export type HardRule = 'clash' | 'max-per-day' | 'over-target' | 'per-day' | 'first-slot' | 'group-first' | 'staffing' | 'off-template';
export interface HardViolation { rule: HardRule; draftIndex: number }

const MAX_SUBJECTS_PER_CLASS = 2;

function activityMinutesOn(cls: SchoolClass, ctx: SchoolContext, day: DayIndex, subjectId: string): number {
  const tpl = templateOf(ctx, cls);
  if (!tpl) return 0;
  return rowsFor(tpl, day).reduce((n, r) => (r.type === 'activity' && r.subjectId === subjectId ? n + toMinutes(r.end) - toMinutes(r.start) : n), 0);
}

function onlyGroupQualified(cls: SchoolClass, plan: PlanItem[], ctx: SchoolContext, gradeNumber: number): boolean {
  const teacher = ctx.teachers.find((t) => t.id === cls.classTeacherId);
  if (!teacher) return false;
  return !plan.some((i) => i.kind === 'subject' && teachesSubject(teacher, i.subjectId, gradeNumber));
}

export function checkHard(ctx: SchoolContext, kept: Entry[], drafts: EntryDraft[]): HardViolation[] {
  const out: HardViolation[] = [];
  const seen = new Set<string>();
  const add = (rule: HardRule, draftIndex: number): void => {
    const k = `${rule}|${draftIndex}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ rule, draftIndex });
  };

  const draftEntries: Entry[] = drafts.map((d, i) => ({ ...withTeacherIds(d), id: `__draft${i}` }));
  const all = [...kept, ...draftEntries];
  const touched = new Set(drafts.flatMap((d) => d.classIds));
  const touchedClasses = ctx.classes.filter((c) => touched.has(c.id));

  draftEntries.forEach((d, i) => {
    if (findConflicts(d, [...kept, ...draftEntries.slice(0, i)], ctx).length > 0) add('clash', i);

    if (d.groupKey !== undefined && d.period === 1) add('group-first', i);

    for (const classId of d.classIds) {
      const cls = findClass(ctx, classId);
      const tpl = cls && templateOf(ctx, cls);
      if (!tpl || windowOf(tpl, d.day, d.period) === null) add('off-template', i);
    }

    for (const teacherId of d.teacherIds) {
      const teacher = ctx.teachers.find((t) => t.id === teacherId);
      if (!teacher || isExemptPlacement(teacherId, d.classIds, ctx)) continue;
      if (teacherDayLoad(teacherId, d.day, all, ctx) > teacher.maxPerDay) add('max-per-day', i);
    }
  });

  for (const cls of touchedClasses) {
    const grade = gradeOf(ctx, cls);
    const tpl = templateOf(ctx, cls);
    if (!grade || !tpl) continue;
    const plan = effectivePlan(cls, grade);
    const { mode, specialistSubjectIds } = staffingFor(grade, ctx);
    const classDrafts = draftEntries.map((d, i) => ({ d, i })).filter(({ d }) => d.classIds.includes(cls.id));
    const keyOf = (e: Entry): string | null => entryPlanKey(e, plan);

    const placement = classPlacement(cls, all, ctx);
    for (const row of placement.rows) {
      if (row.placed > row.needed) for (const { d, i } of classDrafts) if (keyOf(d) === row.key) add('over-target', i);
    }

    for (const item of plan) {
      if (!isMinutes(item) || item.perDay === undefined) continue;
      const key = planKey(item);
      for (const day of DAYS) {
        const draftsToday = classDrafts.filter(({ d }) => d.day === day && keyOf(d) === key);
        if (draftsToday.length === 0) continue;
        const slots = all
          .filter((e) => e.day === day && e.classIds.includes(cls.id) && keyOf(e) === key)
          .reduce((n, e) => n + slotMinutes(tpl, e.day, e.period), 0);
        const credit = item.kind === 'subject' ? activityMinutesOn(cls, ctx, day, item.subjectId) : 0;
        if (slots + credit !== item.perDay) for (const { i } of draftsToday) add('per-day', i);
      }
    }

    const ctId = cls.classTeacherId;
    const freeFirst = mode === 'subjectTeachers' && onlyGroupQualified(cls, plan, ctx, grade.number);
    for (const { d, i } of classDrafts) {
      if (d.period === 1 && windowOf(tpl, d.day, 1) !== null && ctId !== undefined && !freeFirst && !d.teacherIds.includes(ctId)) add('first-slot', i);

      if (d.groupKey !== undefined) continue;
      const subjectId = d.lessons[0]?.subjectId;
      if (mode === 'classTeacherAll') {
        if (ctId !== undefined && d.teacherIds.some((t) => t !== ctId)) add('staffing', i);
      } else if (mode === 'classTeacherPlusSpecialists' && ctId !== undefined && subjectId !== undefined) {
        const special = specialistSubjectIds.includes(subjectId);
        const byCt = d.teacherIds.includes(ctId);
        if (special ? byCt : d.teacherIds.some((t) => t !== ctId)) add('staffing', i);
      }
    }

    if (mode === 'subjectTeachers') {
      const subjectsBy = new Map<string, Set<string>>();
      for (const e of all) {
        if (!e.classIds.includes(cls.id) || e.groupKey !== undefined) continue;
        for (const l of e.lessons) {
          if (l.teacherId === null) continue;
          if (!subjectsBy.has(l.teacherId)) subjectsBy.set(l.teacherId, new Set());
          subjectsBy.get(l.teacherId)!.add(l.subjectId);
        }
      }
      for (const { d, i } of classDrafts) {
        if (d.groupKey !== undefined) continue;
        if (d.teacherIds.some((t) => (subjectsBy.get(t)?.size ?? 0) > MAX_SUBJECTS_PER_CLASS)) add('staffing', i);
      }
    }
  }

  return out;
}
