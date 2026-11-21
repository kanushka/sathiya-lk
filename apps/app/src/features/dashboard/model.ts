// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  classProgress,
  effectivePlan,
  findConflicts,
  pickName,
  teacherDayLoad,
  warnings,
  weekCapacity,
  type DayIndex,
  type Entry,
  type Lang,
  type SchoolClass,
  type SchoolContext,
  type Warning,
} from '@sathiya/core';

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
        const rows = classProgress(cls.id, entries, effectivePlan(cls, grade));
        const needed = rows.reduce((n, r) => n + r.needed, 0);
        const placed = rows.reduce((n, r) => n + Math.min(r.placed, r.needed), 0);
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
    const used = entries.filter((e) => e.classIds.includes(cls.id)).length;
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
        params: { teacher: teacher.name, n: teacherDayLoad(teacher.id, w.day, entries), max: teacher.maxPerDay, day: w.day },
      });
    } else if (w.kind === 'over-target') {
      const cls = ctx.classes.find((c) => c.id === w.refId);
      const grade = cls && gradeOf(ctx, cls);
      if (!cls || !grade) continue;
      const row = classProgress(cls.id, entries, effectivePlan(cls, grade)).find((r) => r.key === w.planKey);
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
        to: classLink(cls.id),
        day: e.day,
        params: { class: cls.name, group: groupName, period: e.period, day: e.day },
      });
    }
  }
  return out;
}
