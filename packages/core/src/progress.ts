// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { DAYS, gradeOf, templateOf } from './lookup';
import { effectivePlan, entryPlanKey, planKey } from './plan';
import { isMinutes } from './staffing';
import { periodsFor, rowsFor, slotMinutes, toMinutes, windowOf } from './time';
import type { Entry, PeriodTemplate, PlanItem, SchoolClass, SchoolContext } from './types';

export interface ProgressRow { key: string; item: PlanItem; placed: number; needed: number; unit: 'periods' | 'minutes' }

export function activityCredit(template: PeriodTemplate, item: PlanItem): number {
  if (item.kind !== 'subject') return 0;
  let credit = 0;
  for (const day of DAYS) {
    for (const row of rowsFor(template, day)) {
      if (row.type !== 'activity' || row.subjectId !== item.subjectId) continue;
      credit += isMinutes(item) ? toMinutes(row.end) - toMinutes(row.start) : 1;
    }
  }
  return credit;
}

export function classProgress(classId: string, entries: Entry[], plan: PlanItem[], template?: PeriodTemplate): ProgressRow[] {
  const byKey = new Map<string, PlanItem>(plan.map((item) => [planKey(item), item]));
  const placed = new Map<string, number>();
  for (const e of entries) {
    if (!e.classIds.includes(classId)) continue;
    const key = entryPlanKey(e, plan);
    if (key === null) continue;
    const amount = isMinutes(byKey.get(key)!) ? (template ? slotMinutes(template, e.day, e.period) : 0) : 1;
    placed.set(key, (placed.get(key) ?? 0) + amount);
  }
  return plan.map((item) => {
    const key = planKey(item);
    const credit = template ? activityCredit(template, item) : 0;
    return { key, item, placed: (placed.get(key) ?? 0) + credit, needed: item.perWeek, unit: isMinutes(item) ? 'minutes' : 'periods' };
  });
}

export interface ClassPlacement { rows: ProgressRow[]; placed: number; needed: number }

export function classPlacement(cls: SchoolClass, entries: Entry[], ctx: SchoolContext): ClassPlacement {
  const grade = gradeOf(ctx, cls);
  const template = templateOf(ctx, cls);
  const inTemplate = template ? entries.filter((e) => e.classIds.includes(cls.id) && windowOf(template, e.day, e.period) !== null) : [];
  const rows = grade ? classProgress(cls.id, inTemplate, effectivePlan(cls, grade), template) : [];
  return {
    rows,
    placed: rows.reduce((n, r) => n + Math.min(r.placed, r.needed), 0),
    needed: rows.reduce((n, r) => n + r.needed, 0),
  };
}

export function weekCapacity(t: PeriodTemplate): number {
  return DAYS.reduce<number>((n, day) => n + periodsFor(t, day).length, 0);
}
