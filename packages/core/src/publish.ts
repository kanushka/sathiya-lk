// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { findClass, gradeOf, templateOf } from './lookup';
import { teacherDisplayName } from './names';
import { effectivePlan } from './plan';
import { bestOverlapPeriod, periodsFor, rowsFor, toMinutes } from './time';
import type { Bilingual, DayIndex, Entry, Hhmm, PeriodTemplate, SchoolClass, SchoolContext, Subject, Teacher, TemplateRow, Year } from './types';

export interface SnapshotCell { day: DayIndex; period: number; start: Hhmm; end: Hhmm; title: string; titleSi?: string; sub: string; subSi?: string; otherClasses?: string[]; color: string; isGroup: boolean }
export interface ClassSnapshot { classId: string; className: string; gradeNumber: number; classTeacher?: string; classTeacherSi?: string; rows: Record<DayIndex, TemplateRow[]>; cells: SnapshotCell[]; yearLabel: string; schoolName: Bilingual }
export interface TeacherSnapshot { teacherId: string; name: string; nameSi?: string; staffId: string; rows: Record<DayIndex, TemplateRow[]>; cells: SnapshotCell[]; yearLabel: string; schoolName: Bilingual }

function weekRows(t: PeriodTemplate | undefined): Record<DayIndex, TemplateRow[]> {
  const get = (d: DayIndex): TemplateRow[] => (t ? rowsFor(t, d) : []);
  return { 0: get(0), 1: get(1), 2: get(2), 3: get(3), 4: get(4) };
}

function entrySlot(ctx: SchoolContext, e: Entry): { start: Hhmm; end: Hhmm } | null {
  const cls = e.classIds[0] === undefined ? undefined : findClass(ctx, e.classIds[0]);
  const template = cls && templateOf(ctx, cls);
  return (template && periodsFor(template, e.day).find((p) => p.period === e.period)) ?? null;
}

function teacherRowPeriod(t: PeriodTemplate, day: DayIndex, window: { start: number; end: number }): number | null {
  const best = bestOverlapPeriod(t, day, window);
  if (best !== null) return best;
  let nearest: number | null = null;
  let gap = Infinity;
  for (const p of periodsFor(t, day)) {
    const d = Math.max(toMinutes(p.start) - window.end, window.start - toMinutes(p.end));
    if (d < gap) {
      nearest = p.period;
      gap = d;
    }
  }
  return nearest;
}

function displayNames(teacher: Teacher): { en: string; si?: string } {
  const en = teacherDisplayName(teacher, 'en');
  const si = teacherDisplayName(teacher, 'si');
  return si === en ? { en } : { en, si };
}

const byDayStart = (a: SnapshotCell, b: SnapshotCell): number => a.day - b.day || toMinutes(a.start) - toMinutes(b.start);

function withSi<T extends object>(base: T, nameSi: string | undefined): T & { titleSi?: string } {
  const si = nameSi?.trim();
  return si ? { ...base, titleSi: si } : base;
}

function classCell(ctx: SchoolContext, cls: SchoolClass, e: Entry, slot: { start: Hhmm; end: Hhmm }, subjects: Map<string, Subject>): SnapshotCell {
  const base = { day: e.day, period: e.period, start: slot.start, end: slot.end, isGroup: e.groupKey !== undefined };
  if (e.groupKey !== undefined) {
    const grade = gradeOf(ctx, cls);
    const item = grade && effectivePlan(cls, grade).find((p) => p.kind === 'group' && p.key === e.groupKey);
    const group = item?.kind === 'group' ? item : undefined;
    const others = e.classIds.filter((id) => id !== cls.id).map((id) => findClass(ctx, id)?.name ?? id);
    const firstOption = group?.optionSubjectIds[0] ?? e.lessons[0]?.subjectId;
    const color = (firstOption !== undefined ? subjects.get(firstOption)?.color : undefined) ?? '';
    return withSi({ ...base, title: group?.nameEn ?? e.groupKey, sub: others.length ? `Group · ${others.join('+')}` : 'Group', otherClasses: others, color }, group?.nameSi);
  }
  const lesson = e.lessons[0];
  const subject = lesson && subjects.get(lesson.subjectId);
  const teacher = lesson?.teacherId != null ? ctx.teachers.find((t) => t.id === lesson.teacherId) : undefined;
  const names = teacher && displayNames(teacher);
  const others = e.classIds.filter((id) => id !== cls.id).map((id) => findClass(ctx, id)?.name ?? id);
  return withSi({ ...base, title: subject?.short ?? '', sub: names?.en ?? '', ...(names?.si ? { subSi: names.si } : {}), ...(others.length ? { otherClasses: others } : {}), color: subject?.color ?? '' }, subject?.nameSi);
}

export function buildSnapshots(ctx: SchoolContext, entries: Entry[], year: Year): { classes: ClassSnapshot[]; teachers: TeacherSnapshot[] } {
  const schoolName: Bilingual = ctx.school.nameSi === undefined ? { nameEn: ctx.school.nameEn } : { nameEn: ctx.school.nameEn, nameSi: ctx.school.nameSi };
  const subjects = new Map(ctx.subjects.map((s) => [s.id, s]));
  const slotted = entries.flatMap((e) => {
    const slot = entrySlot(ctx, e);
    return slot ? [{ e, slot }] : [];
  });

  const classes = ctx.classes.map((cls): ClassSnapshot => {
    const ct = ctx.teachers.find((t) => t.id === cls.classTeacherId);
    const names = ct && displayNames(ct);
    const cells = slotted.filter(({ e }) => e.classIds.includes(cls.id)).map(({ e, slot }) => classCell(ctx, cls, e, slot, subjects)).sort(byDayStart);
    const snap: ClassSnapshot = { classId: cls.id, className: cls.name, gradeNumber: gradeOf(ctx, cls)?.number ?? 0, rows: weekRows(templateOf(ctx, cls)), cells, yearLabel: year.label, schoolName };
    return names === undefined ? snap : { ...snap, classTeacher: names.en, ...(names.si ? { classTeacherSi: names.si } : {}) };
  });

  const defaultTemplate = ctx.templates.find((t) => t.isDefault);
  const teacherRows = weekRows(defaultTemplate);
  const teachers = ctx.teachers.map((teacher): TeacherSnapshot => {
    const cells: SnapshotCell[] = [];
    for (const { e, slot } of slotted) {
      const lesson = e.lessons.find((l) => l.teacherId === teacher.id);
      if (!lesson || !defaultTemplate) continue;
      const period = teacherRowPeriod(defaultTemplate, e.day, { start: toMinutes(slot.start), end: toMinutes(slot.end) });
      if (period === null) continue;
      const subject = subjects.get(lesson.subjectId);
      const title = e.classIds.map((id) => findClass(ctx, id)?.name ?? id).join('+');
      const subSi = subject?.nameSi?.trim();
      cells.push({ day: e.day, period, start: slot.start, end: slot.end, title, sub: subject?.nameEn ?? '', ...(subSi ? { subSi } : {}), color: subject?.color ?? '', isGroup: e.groupKey !== undefined });
    }
    cells.sort(byDayStart);
    const names = displayNames(teacher);
    return { teacherId: teacher.id, name: names.en, ...(names.si ? { nameSi: names.si } : {}), staffId: teacher.staffId, rows: teacherRows, cells, yearLabel: year.label, schoolName };
  });

  return { classes, teachers };
}

