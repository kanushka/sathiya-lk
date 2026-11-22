// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { DAYS, gradeOf, templateOf } from './lookup';
import { effectivePlan, entryPlanKey, planKey } from './plan';
import { periodsFor, windowOf } from './time';
import type { Entry, PeriodTemplate, PlanItem, SchoolClass, SchoolContext } from './types';

export interface ProgressRow { key: string; item: PlanItem; placed: number; needed: number }

export function classProgress(classId: string, entries: Entry[], plan: PlanItem[]): ProgressRow[] {
  const placed = new Map<string, number>();
  for (const e of entries) {
    if (!e.classIds.includes(classId)) continue;
    const key = entryPlanKey(e, plan);
    if (key !== null) placed.set(key, (placed.get(key) ?? 0) + 1);
  }
  return plan.map((item) => {
    const key = planKey(item);
    return { key, item, placed: placed.get(key) ?? 0, needed: item.perWeek };
  });
}

export interface ClassPlacement { rows: ProgressRow[]; placed: number; needed: number }

export function classPlacement(cls: SchoolClass, entries: Entry[], ctx: SchoolContext): ClassPlacement {
  const grade = gradeOf(ctx, cls);
  const template = templateOf(ctx, cls);
  const inTemplate = template ? entries.filter((e) => e.classIds.includes(cls.id) && windowOf(template, e.day, e.period) !== null) : [];
  const rows = grade ? classProgress(cls.id, inTemplate, effectivePlan(cls, grade)) : [];
  return {
    rows,
    placed: rows.reduce((n, r) => n + Math.min(r.placed, r.needed), 0),
    needed: rows.reduce((n, r) => n + r.needed, 0),
  };
}

export function weekCapacity(t: PeriodTemplate): number {
  return DAYS.reduce<number>((n, day) => n + periodsFor(t, day).length, 0);
}
