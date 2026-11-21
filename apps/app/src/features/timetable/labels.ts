import { pickName, type Entry, type Lang, type PlanItem, type SchoolContext, type Subject, type TeacherOption } from '@sathiya/core';
import type { TFunction } from 'i18next';
import type { CellView } from './Cell';

export function subjectShort(s: Subject, lang: Lang): string {
  return lang === 'si' ? pickName(s, lang) : s.short;
}

export function planItemColor(item: PlanItem, ctx: SchoolContext): string {
  const id = item.kind === 'subject' ? item.subjectId : item.optionSubjectIds[0];
  return ctx.subjects.find((s) => s.id === id)?.color ?? '#E9E9E9';
}

export function planItemName(item: PlanItem, ctx: SchoolContext, lang: Lang): string {
  if (item.kind === 'group') return pickName(item, lang);
  const s = ctx.subjects.find((x) => x.id === item.subjectId);
  return s ? pickName(s, lang) : item.subjectId;
}

export function classNames(ctx: SchoolContext, ids: string[]): string {
  return ids
    .map((id) => ctx.classes.find((c) => c.id === id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join('+');
}

export function teacherReason(t: TFunction, o: TeacherOption, ctx: SchoolContext, lang: Lang, grade: number | string): string {
  if (o.reason === 'busy') {
    const s = ctx.subjects.find((x) => x.id === o.busyWith?.subjectId);
    return t('block.busy', { classes: classNames(ctx, o.busyWith?.classIds ?? []), subject: s ? pickName(s, lang) : '' }).trim();
  }
  if (o.reason === 'limit') return t('block.limit', { load: o.loadToday, max: o.teacher.maxPerDay });
  return t('block.notQualified', { grade });
}

export function teachesAtAll(o: TeacherOption, subjectId: string): boolean {
  return o.reason !== 'not-qualified' || o.teacher.subjectIds.includes(subjectId);
}

export function classCellView(e: Entry, ctx: SchoolContext, lang: Lang, t: TFunction, plan: PlanItem[] = []): CellView {
  const teacherName = (id: string | null | undefined) => (id ? ctx.teachers.find((x) => x.id === id)?.name : undefined) ?? t('cell.noTeacher');
  const joined = e.classIds.length > 1 ? classNames(ctx, e.classIds) : null;
  if (e.groupKey !== undefined) {
    const group = plan
      .concat(ctx.grades.flatMap((g) => g.plan))
      .concat(ctx.classes.flatMap((c) => c.planOverride ?? []))
      .find((p): p is Extract<PlanItem, { kind: 'group' }> => p.kind === 'group' && p.key === e.groupKey);
    const first = ctx.subjects.find((s) => s.id === e.lessons[0]?.subjectId);
    return {
      title: group ? pickName(group, lang) : e.groupKey,
      sub: joined ? t('cell.joined', { classes: joined }) : t('cell.groupTeachers', { count: e.lessons.length }),
      color: (group && planItemColor(group, ctx)) ?? first?.color ?? '#E9E9E9',
      isGroup: true,
    };
  }
  const lesson = e.lessons[0];
  const s = ctx.subjects.find((x) => x.id === lesson?.subjectId);
  const teacher = teacherName(lesson?.teacherId);
  return {
    title: s ? subjectShort(s, lang) : (lesson?.subjectId ?? ''),
    sub: joined ? t('cell.combined', { classes: joined, teacher }) : teacher,
    color: s?.color ?? '#E9E9E9',
    isGroup: false,
  };
}
