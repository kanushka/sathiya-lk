// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  classPlacement,
  effectivePlan,
  findConflicts,
  pickName,
  teacherDisplayName,
  teacherDayLoad,
  warnings,
  weekCapacity,
  windowOf,
  type DayIndex,
  type Entry,
  type Lang,
  type SchoolClass,
  type SchoolContext,
  type Warning,
} from '@sathiya/core';
import { OUTSIDE_TEMPLATE_ID } from '../timetable/paths';

const gradeOf = (ctx: SchoolContext, cls: SchoolClass) => ctx.grades.find((g) => g.id === cls.gradeId);
const templateOf = (ctx: SchoolContext, cls: SchoolClass) => ctx.templates.find((t) => t.id === cls.templateId);

export type ChipStatus = 'complete' | 'partial' | 'empty';

export interface ClassChip {
  id: string;
  name: string;
  placed: number;
  needed: number;
  status: ChipStatus;
}

export interface GradeGroup {
  gradeId: string;
  number: number;
  classes: ClassChip[];
}

export interface DashboardStats {
  classCount: number;
  classesComplete: number;
  emptySlots: number;
  clashes: number;
  overLimit: number;
}

export interface AttentionItem {
  key: string;
  kind: Warning['kind'];
  severity: 'high' | 'medium';
  to: string;
  day?: DayIndex;
  params: Record<string, string | number>;
}

export function classChips(ctx: SchoolContext, entries: Entry[]): GradeGroup[] {
  const groups: GradeGroup[] = [];
  for (const grade of [...ctx.grades].sort((a, b) => a.number - b.number)) {
    const classes: ClassChip[] = ctx.classes
      .filter((c) => c.gradeId === grade.id)
      .map((cls) => {
        const { placed, needed } = classPlacement(cls, entries, ctx);
        const status: ChipStatus = placed === 0 ? 'empty' : placed >= needed ? 'complete' : 'partial';
        return { id: cls.id, name: cls.name, placed, needed, status };
      });
    if (classes.length > 0) groups.push({ gradeId: grade.id, number: grade.number, classes });
  }
  return groups;
}

export function dashboardStats(ctx: SchoolContext, entries: Entry[]): DashboardStats {
  const chips = classChips(ctx, entries).flatMap((g) => g.classes);

  let emptySlots = 0;
  for (const cls of ctx.classes) {
    const template = templateOf(ctx, cls);
    if (!template) continue;
    const used = entries.filter((e) => e.classIds.includes(cls.id) && windowOf(template, e.day, e.period) !== null).length;
    emptySlots += Math.max(0, weekCapacity(template) - used);
  }

  const seen = new Set<string>();
  for (const e of entries) {
    for (const c of findConflicts(e, entries, ctx)) seen.add(`${[e.id, c.entryId].sort().join('|')}|${c.kind}|${c.id}`);
  }

  const over = new Set(warnings(entries, ctx).filter((w) => w.kind === 'over-limit').map((w) => w.refId));

  return {
    classCount: chips.length,
    classesComplete: chips.filter((c) => c.status === 'complete').length,
    emptySlots,
    clashes: seen.size,
    overLimit: over.size,
  };
}

const classLink = (id: string) => `/timetable/class?c=${encodeURIComponent(id)}`;
const orphanLink = (id: string) => `/timetable/class/${encodeURIComponent(id)}#${OUTSIDE_TEMPLATE_ID}`;

export function attentionItems(ctx: SchoolContext, entries: Entry[], lang: Lang): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const w of warnings(entries, ctx)) {
    if (w.kind === 'over-limit') {
      const teacher = ctx.teachers.find((t) => t.id === w.refId);
      if (!teacher || w.day === undefined) continue;
      out.push({
        key: `${w.kind}:${w.refId}:${w.day}`,
        kind: w.kind,
        severity: 'high',
        to: `/timetable/teacher?t=${encodeURIComponent(teacher.id)}`,
        day: w.day,
        params: { teacher: teacherDisplayName(teacher, lang), n: teacherDayLoad(teacher.id, w.day, entries), max: teacher.maxPerDay, day: w.day },
      });
    } else if (w.kind === 'over-target') {
      const cls = ctx.classes.find((c) => c.id === w.refId);
      if (!cls) continue;
      const row = classPlacement(cls, entries, ctx).rows.find((r) => r.key === w.planKey);
      if (!row) continue;
      const item = row.item;
      const subject =
        item.kind === 'group'
          ? pickName(item, lang)
          : pickName(ctx.subjects.find((s) => s.id === item.subjectId) ?? { nameEn: '' }, lang);
      out.push({
        key: `${w.kind}:${w.refId}:${w.planKey ?? ''}`,
        kind: w.kind,
        severity: 'medium',
        to: classLink(cls.id),
        params: { class: cls.name, subject, placed: row.placed, needed: row.needed, extra: row.placed - row.needed },
      });
    } else {
      const e = entries.find((x) => x.id === w.refId);
      const cls = e && ctx.classes.find((c) => c.id === e.classIds[0]);
      if (!e || !cls) continue;
      const grade = gradeOf(ctx, cls);
      const group = grade && effectivePlan(cls, grade).find((p) => p.kind === 'group' && p.key === e.groupKey);
      const groupName = group && group.kind === 'group' ? pickName(group, lang) : (e.groupKey ?? '');
      out.push({
        key: `${w.kind}:${w.refId}`,
        kind: w.kind,
        severity: w.kind === 'orphaned' ? 'high' : 'medium',
        to: w.kind === 'orphaned' ? orphanLink(cls.id) : classLink(cls.id),
        day: e.day,
        params: { class: cls.name, group: groupName, period: e.period, day: e.day },
      });
    }
  }
  return out;
}

export interface PublishProblems {
  incomplete: number;
  clashes: number;
  overLimit: number;
  overTarget: number;
  orphaned: number;
  groupNoTeacher: number;
  total: number;
}

export function publishProblems(ctx: SchoolContext, entries: Entry[]): PublishProblems {
  const stats = dashboardStats(ctx, entries);
  const items = attentionItems(ctx, entries, 'en');
  const count = (kind: Warning['kind']) => items.filter((i) => i.kind === kind).length;
  const counts = {
    incomplete: stats.classCount - stats.classesComplete,
    clashes: stats.clashes,
    overLimit: stats.overLimit,
    overTarget: count('over-target'),
    orphaned: count('orphaned'),
    groupNoTeacher: count('group-no-teacher'),
  };
  return { ...counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}
