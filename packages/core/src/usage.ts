// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { teacherDayLoad } from './availability';
import { DAYS, gradeOf, templateOf } from './lookup';
import { pickName } from './names';
import { effectivePlan } from './plan';
import { classPlacement } from './progress';
import { windowOf } from './time';
import type { DayIndex, Entry, PlanItem, SchoolContext } from './types';

export interface Warning { kind: 'over-limit' | 'over-target' | 'group-no-teacher' | 'orphaned'; refId: string; classId?: string; day?: DayIndex; detail: string; planKey?: string }

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;

function itemName(item: PlanItem, ctx: SchoolContext): string {
  if (item.kind === 'group') return pickName(item, 'en');
  const subject = ctx.subjects.find((s) => s.id === item.subjectId);
  return (subject && pickName(subject, 'en')) || item.subjectId;
}

export function usageCount(kind: 'teacher' | 'subject' | 'class' | 'template', id: string, ctx: SchoolContext, entries: Entry[]): number {
  switch (kind) {
    case 'teacher':
      return entries.filter((e) => e.lessons.some((l) => l.teacherId === id)).length;
    case 'subject':
      return entries.filter((e) => e.lessons.some((l) => l.subjectId === id)).length;
    case 'class':
      return entries.filter((e) => e.classIds.includes(id)).length;
    case 'template':
      return ctx.classes.filter((c) => c.templateId === id).length;
  }
}

export function orphanedClassIds(e: Entry, ctx: SchoolContext): string[] {
  return e.classIds.filter((id) => {
    const cls = ctx.classes.find((c) => c.id === id);
    const template = cls && templateOf(ctx, cls);
    return !template || windowOf(template, e.day, e.period) === null;
  });
}

export function orphanedEntries(entries: Entry[], ctx: SchoolContext): Entry[] {
  return entries.filter((e) => orphanedClassIds(e, ctx).length > 0);
}

export function warnings(entries: Entry[], ctx: SchoolContext): Warning[] {
  const out: Warning[] = [];
  for (const t of ctx.teachers) {
    for (const day of DAYS) {
      const load = teacherDayLoad(t.id, day, entries, ctx);
      if (load > t.maxPerDay) out.push({ kind: 'over-limit', refId: t.id, day, detail: `${load} periods on ${DAY_NAMES[day]}, limit ${t.maxPerDay}` });
    }
  }
  for (const cls of ctx.classes) {
    for (const row of classPlacement(cls, entries, ctx).rows) {
      if (row.placed <= row.needed) continue;
      out.push({ kind: 'over-target', refId: cls.id, detail: `${itemName(row.item, ctx)} ${row.placed}/${row.needed}`, planKey: row.key });
    }
  }
  for (const e of entries) {
    if (e.groupKey === undefined || !e.lessons.some((l) => l.teacherId === null)) continue;
    const cls = ctx.classes.find((c) => c.id === e.classIds[0]);
    const grade = cls && gradeOf(ctx, cls);
    const group = cls && grade ? effectivePlan(cls, grade).find((p) => p.kind === 'group' && p.key === e.groupKey) : undefined;
    const name = group ? itemName(group, ctx) : e.groupKey;
    out.push({ kind: 'group-no-teacher', refId: e.id, day: e.day, detail: `${name} has an option without a teacher` });
  }
  for (const e of entries) {
    for (const classId of orphanedClassIds(e, ctx)) {
      out.push({ kind: 'orphaned', refId: e.id, classId, day: e.day, detail: `${DAY_NAMES[e.day]} P${e.period} is outside the class template` });
    }
  }
  return out;
}
