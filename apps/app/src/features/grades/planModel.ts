// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { PlanItem } from '@sathiya/core';

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
