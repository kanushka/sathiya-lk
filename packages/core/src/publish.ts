import { findClass, gradeOf, templateOf } from './lookup';
import { effectivePlan } from './plan';
import { periodsFor, rowsFor, toMinutes } from './time';
import type { Bilingual, DayIndex, Entry, Hhmm, PeriodTemplate, SchoolClass, SchoolContext, Subject, TemplateRow, Year } from './types';

export interface SnapshotCell { day: DayIndex; period: number; start: Hhmm; end: Hhmm; title: string; titleSi?: string; sub: string; color: string; isGroup: boolean }
export interface ClassSnapshot { classId: string; className: string; gradeNumber: number; classTeacher?: string; rows: Record<DayIndex, TemplateRow[]>; cells: SnapshotCell[]; yearLabel: string; schoolName: Bilingual }
export interface TeacherSnapshot { teacherId: string; name: string; staffId: string; rows: Record<DayIndex, TemplateRow[]>; cells: SnapshotCell[]; yearLabel: string; schoolName: Bilingual }

function weekRows(t: PeriodTemplate | undefined): Record<DayIndex, TemplateRow[]> {
  const get = (d: DayIndex): TemplateRow[] => (t ? rowsFor(t, d) : []);
  return { 0: get(0), 1: get(1), 2: get(2), 3: get(3), 4: get(4) };
}

function entrySlot(ctx: SchoolContext, e: Entry): { start: Hhmm; end: Hhmm } | null {
  const cls = e.classIds[0] === undefined ? undefined : findClass(ctx, e.classIds[0]);
  const template = cls && templateOf(ctx, cls);
  return (template && periodsFor(template, e.day).find((p) => p.period === e.period)) ?? null;
}

function defaultPeriod(template: PeriodTemplate, day: DayIndex, slot: { start: Hhmm; end: Hhmm }): number | null {
  const start = toMinutes(slot.start);
  const end = toMinutes(slot.end);
  let best: number | null = null;
  let bestOverlap = 0;
  for (const p of periodsFor(template, day)) {
    const overlap = Math.min(end, toMinutes(p.end)) - Math.max(start, toMinutes(p.start));
    if (overlap > bestOverlap) {
      best = p.period;
      bestOverlap = overlap;
    }
  }
  return best;
}

const byDayStart = (a: SnapshotCell, b: SnapshotCell): number => a.day - b.day || toMinutes(a.start) - toMinutes(b.start);

function withSi<T extends object>(base: T, nameSi: string | undefined): T & { titleSi?: string } {
  return nameSi ? { ...base, titleSi: nameSi } : base;
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
    return withSi({ ...base, title: group?.nameEn ?? e.groupKey, sub: others.length ? `Group · ${others.join('+')}` : 'Group', color }, group?.nameSi);
  }
  const lesson = e.lessons[0];
  const subject = lesson && subjects.get(lesson.subjectId);
  const teacher = lesson?.teacherId != null ? ctx.teachers.find((t) => t.id === lesson.teacherId) : undefined;
  return withSi({ ...base, title: subject?.short ?? '', sub: teacher?.name ?? '', color: subject?.color ?? '' }, subject?.nameSi);
}

export function buildSnapshots(ctx: SchoolContext, entries: Entry[], year: Year): { classes: ClassSnapshot[]; teachers: TeacherSnapshot[] } {
  const schoolName: Bilingual = ctx.school.nameSi === undefined ? { nameEn: ctx.school.nameEn } : { nameEn: ctx.school.nameEn, nameSi: ctx.school.nameSi };
  const subjects = new Map(ctx.subjects.map((s) => [s.id, s]));
  const slotted = entries.flatMap((e) => {
    const slot = entrySlot(ctx, e);
    return slot ? [{ e, slot }] : [];
  });

  const classes = ctx.classes.map((cls): ClassSnapshot => {
    const classTeacher = ctx.teachers.find((t) => t.id === cls.classTeacherId)?.name;
    const cells = slotted.filter(({ e }) => e.classIds.includes(cls.id)).map(({ e, slot }) => classCell(ctx, cls, e, slot, subjects)).sort(byDayStart);
    const snap: ClassSnapshot = { classId: cls.id, className: cls.name, gradeNumber: gradeOf(ctx, cls)?.number ?? 0, rows: weekRows(templateOf(ctx, cls)), cells, yearLabel: year.label, schoolName };
    return classTeacher === undefined ? snap : { ...snap, classTeacher };
  });

  const defaultTemplate = ctx.templates.find((t) => t.isDefault);
  const teacherRows = weekRows(defaultTemplate);
  const teachers = ctx.teachers.map((teacher): TeacherSnapshot => {
    const cells: SnapshotCell[] = [];
    for (const { e, slot } of slotted) {
      const lesson = e.lessons.find((l) => l.teacherId === teacher.id);
      if (!lesson || !defaultTemplate) continue;
      const period = defaultPeriod(defaultTemplate, e.day, slot);
      if (period === null) continue;
      const subject = subjects.get(lesson.subjectId);
      const title = e.classIds.map((id) => findClass(ctx, id)?.name ?? id).join('+');
      cells.push({ day: e.day, period, start: slot.start, end: slot.end, title, sub: subject?.nameEn ?? '', color: subject?.color ?? '', isGroup: e.groupKey !== undefined });
    }
    cells.sort(byDayStart);
    return { teacherId: teacher.id, name: teacher.name, staffId: teacher.staffId, rows: teacherRows, cells, yearLabel: year.label, schoolName };
  });

  return { classes, teachers };
}

