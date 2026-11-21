import { findConflicts } from './clash';
import { findClass, gradeOf, templateOf } from './lookup';
import { effectivePlan } from './plan';
import { bestOverlapPeriod, periodsFor, toMinutes } from './time';
import type { DayIndex, Entry, SchoolClass, SchoolContext, Teacher } from './types';

export type UnavailableReason = 'busy' | 'limit' | 'not-qualified';
export interface TeacherOption { teacher: Teacher; loadToday: number; reason?: UnavailableReason; busyWith?: { classIds: string[]; subjectId: string } }
export interface ClassOption { cls: SchoolClass; period: number; free: boolean }

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
    const free = findConflicts({ day, period, classIds: [cls.id], lessons: [{ subjectId, teacherId }] }, entries, ctx).length === 0;
    out.push({ cls, period, free, gradeNumber: grade.number });
  }
  out.sort((a, b) => a.gradeNumber - b.gradeNumber || a.cls.name.localeCompare(b.cls.name));
  return out.map(({ cls, period, free }) => ({ cls, period, free }));
}
