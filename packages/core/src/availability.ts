// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { findConflicts } from './clash';
import { findClass, gradeOf, templateOf } from './lookup';
import { effectivePlan } from './plan';
import { bestOverlapPeriod, periodsFor, toMinutes } from './time';
import type { DayIndex, Entry, PeriodTemplate, PlanItem, SchoolClass, SchoolContext, Teacher } from './types';

export type UnavailableReason = 'busy' | 'limit' | 'not-qualified';
export interface TeacherOption { teacher: Teacher; loadToday: number; reason?: UnavailableReason; busyWith?: { classIds: string[]; subjectId: string } }
export interface BusyDetail { kind: 'teacher' | 'class'; entryId: string; classIds: string[]; subjectId: string; teacherId: string | null; groupKey?: string }
export interface TeacherClassOption { cls: SchoolClass; item: PlanItem; subjectId: string; preferred: boolean; template: PeriodTemplate }
export interface ClassOption { cls: SchoolClass; period: number; free: boolean; busy?: BusyDetail }

export function busyDetail(e: Entry, kind: BusyDetail['kind'], teacherId: string): BusyDetail {
  if (kind === 'teacher') {
    const lesson = e.lessons.find((l) => l.teacherId === teacherId);
    return { kind, entryId: e.id, classIds: e.classIds, subjectId: lesson?.subjectId ?? '', teacherId };
  }
  const first = e.lessons[0];
  if (e.groupKey !== undefined) return { kind, entryId: e.id, classIds: e.classIds, subjectId: first?.subjectId ?? '', teacherId: null, groupKey: e.groupKey };
  return { kind, entryId: e.id, classIds: e.classIds, subjectId: first?.subjectId ?? '', teacherId: first?.teacherId ?? null };
}

export function preferredTeacherFor(args: { entries: Entry[]; classId: string; subjectId: string; excludeEntryId?: string }): string | null {
  const { classId, subjectId, excludeEntryId } = args;
  const stats = new Map<string, { count: number; first: number }>();
  for (const e of args.entries) {
    if (e.id === excludeEntryId || !e.classIds.includes(classId)) continue;
    const order = e.day * 100 + e.period;
    for (const l of e.lessons) {
      if (l.subjectId !== subjectId || l.teacherId === null) continue;
      const s = stats.get(l.teacherId) ?? { count: 0, first: order };
      stats.set(l.teacherId, { count: s.count + 1, first: Math.min(s.first, order) });
    }
  }
  let best: string | null = null;
  let bestStat = { count: 0, first: Infinity };
  for (const [id, s] of stats) {
    if (s.count > bestStat.count || (s.count === bestStat.count && s.first < bestStat.first)) {
      best = id;
      bestStat = s;
    }
  }
  return best;
}

export function teachesSubject(t: Teacher, subjectId: string, grade: number): boolean {
  if (!t.grades.includes(grade)) return false;
  return t.isPrimary || t.subjectIds.includes(subjectId);
}

export function teacherDayLoad(teacherId: string, day: DayIndex, entries: Entry[]): number {
  return entries.filter((e) => e.day === day && e.lessons.some((l) => l.teacherId === teacherId)).length;
}

export function teacherOptionsForSlot(args: { ctx: SchoolContext; entries: Entry[]; classIds: string[]; day: DayIndex; period: number; subjectId: string; editingEntryId?: string }): { available: TeacherOption[]; unavailable: TeacherOption[] } {
  const { ctx, classIds, day, period, subjectId, editingEntryId } = args;
  const entries = args.entries.filter((e) => e.id !== editingEntryId);
  const firstClass = classIds[0] === undefined ? undefined : findClass(ctx, classIds[0]);
  const grade = firstClass && gradeOf(ctx, firstClass)?.number;
  const conflicts = findConflicts(
    { day, period, classIds, lessons: ctx.teachers.map((t) => ({ subjectId, teacherId: t.id })) },
    entries,
    ctx,
  );
  const available: TeacherOption[] = [];
  const unavailable: TeacherOption[] = [];
  for (const teacher of ctx.teachers) {
    const loadToday = teacherDayLoad(teacher.id, day, entries);
    if (grade === undefined || !teachesSubject(teacher, subjectId, grade)) {
      unavailable.push({ teacher, loadToday, reason: 'not-qualified' });
      continue;
    }
    const clash = conflicts.find((c) => c.kind === 'teacher' && c.id === teacher.id);
    const busyEntry = clash && entries.find((e) => e.id === clash.entryId);
    if (busyEntry) {
      const lesson = busyEntry.lessons.find((l) => l.teacherId === teacher.id);
      unavailable.push({ teacher, loadToday, reason: 'busy', busyWith: { classIds: busyEntry.classIds, subjectId: lesson?.subjectId ?? '' } });
    } else if (loadToday >= teacher.maxPerDay) {
      unavailable.push({ teacher, loadToday, reason: 'limit' });
    } else {
      available.push({ teacher, loadToday });
    }
  }
  available.sort((a, b) => a.loadToday - b.loadToday || a.teacher.name.localeCompare(b.teacher.name));
  return { available, unavailable };
}

export function matchClassPeriod(cls: SchoolClass, ctx: SchoolContext, day: DayIndex, window: { start: number; end: number }): number | null {
  const template = templateOf(ctx, cls);
  return template ? bestOverlapPeriod(template, day, window) : null;
}

export function classOptionsForTeacherSlot(args: { ctx: SchoolContext; entries: Entry[]; teacherId: string; day: DayIndex; defaultPeriod: number; subjectId: string; editingEntryId?: string }): ClassOption[] {
  const { ctx, teacherId, day, defaultPeriod, subjectId, editingEntryId } = args;
  const entries = args.entries.filter((e) => e.id !== editingEntryId);
  const teacher = ctx.teachers.find((t) => t.id === teacherId);
  const defaultTemplate = ctx.templates.find((t) => t.isDefault);
  if (!teacher || !defaultTemplate) return [];
  const row = periodsFor(defaultTemplate, day).find((p) => p.period === defaultPeriod);
  if (!row) return [];
  const window = { start: toMinutes(row.start), end: toMinutes(row.end) };
  const out: Array<ClassOption & { gradeNumber: number }> = [];
  for (const cls of ctx.classes) {
    const grade = gradeOf(ctx, cls);
    if (!grade || !teachesSubject(teacher, subjectId, grade.number)) continue;
    const inPlan = effectivePlan(cls, grade).some((p) => (p.kind === 'subject' ? p.subjectId === subjectId : p.optionSubjectIds.includes(subjectId)));
    if (!inPlan) continue;
    const period = matchClassPeriod(cls, ctx, day, window);
    if (period === null) continue;
    const conflicts = findConflicts({ day, period, classIds: [cls.id], lessons: [{ subjectId, teacherId }] }, entries, ctx);
    const entryOf = (id: string) => entries.find((e) => e.id === id);
    const classHit = conflicts.map((c) => (c.kind === 'class' ? entryOf(c.entryId) : undefined)).find((e) => e !== undefined);
    const teacherHit = conflicts.map((c) => (c.kind === 'teacher' ? entryOf(c.entryId) : undefined)).find((e) => e !== undefined);
    const busy = classHit
      ? busyDetail(classHit, classHit.lessons.some((l) => l.teacherId === teacherId) ? 'teacher' : 'class', teacherId)
      : teacherHit && busyDetail(teacherHit, 'teacher', teacherId);
    out.push({ cls, period, free: conflicts.length === 0, ...(busy ? { busy } : {}), gradeNumber: grade.number });
  }
  out.sort((a, b) => a.gradeNumber - b.gradeNumber || a.cls.name.localeCompare(b.cls.name));
  return out.map(({ gradeNumber: _, ...o }) => o);
}

export function teacherClassOptions(args: { ctx: SchoolContext; entries: Entry[]; teacherId: string; subjectId: string }): TeacherClassOption[] {
  const { ctx, entries, teacherId, subjectId } = args;
  const teacher = ctx.teachers.find((t) => t.id === teacherId);
  if (!teacher) return [];
  const out: Array<TeacherClassOption & { gradeNumber: number }> = [];
  for (const cls of ctx.classes) {
    const grade = gradeOf(ctx, cls);
    const template = templateOf(ctx, cls);
    if (!grade || !template || !teachesSubject(teacher, subjectId, grade.number)) continue;
    const plan = effectivePlan(cls, grade);
    const item = plan.find((p) => p.kind === 'subject' && p.subjectId === subjectId) ?? plan.find((p) => p.kind === 'group' && p.optionSubjectIds.includes(subjectId));
    if (!item) continue;
    out.push({ cls, item, subjectId, preferred: preferredTeacherFor({ entries, classId: cls.id, subjectId }) === teacherId, template, gradeNumber: grade.number });
  }
  out.sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.gradeNumber - b.gradeNumber || a.cls.name.localeCompare(b.cls.name, undefined, { numeric: true }));
  return out.map(({ gradeNumber: _, ...o }) => o);
}
