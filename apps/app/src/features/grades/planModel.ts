// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { weekCapacity, type PeriodTemplate, type PlanItem } from '@sathiya/core';

export function newGroupKey(plan: PlanItem[]): string {
  const used = new Set(plan.flatMap((p) => (p.kind === 'group' ? [p.key] : [])));
  let key: string;
  do key = `grp-${Math.random().toString(36).slice(2, 8)}`;
  while (used.has(key));
  return key;
}

export function planTotal(plan: PlanItem[]): number {
  return plan.reduce((n, p) => n + (Number.isFinite(p.perWeek) ? p.perWeek : 0), 0);
}

export function nextClassName(gradeNumber: number, existing: string[]): string {
  let max = -1;
  for (const name of existing) {
    const m = new RegExp(`^${gradeNumber}([A-Z])$`).exec(name);
    if (m) max = Math.max(max, m[1]!.charCodeAt(0) - 65);
  }
  return `${gradeNumber}${String.fromCharCode(65 + max + 1)}`;
}

export interface PlanCapacity {
  min: number;
  max: number;
}

export function planCapacity(templates: PeriodTemplate[]): PlanCapacity {
  if (templates.length === 0) return { min: 0, max: 0 };
  const sizes = templates.map(weekCapacity);
  return { min: Math.min(...sizes), max: Math.max(...sizes) };
}

export type PlanFit = 'under' | 'exact' | 'mixed' | 'over';

export function planFit(total: number, { min, max }: PlanCapacity): PlanFit {
  if (total > max) return 'over';
  if (total < min) return 'under';
  return min === max ? 'exact' : 'mixed';
}
