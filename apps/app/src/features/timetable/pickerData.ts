// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { classProgress, effectivePlan, type Entry, type Lang, type PlanItem, type SchoolContext } from '@sathiya/core';
import { useMemo } from 'react';
import { planItemName } from './labels';

export type GroupItem = Extract<PlanItem, { kind: 'group' }>;

export interface PickItem {
  item: PlanItem;
  key: string;
  name: string;
  placed: number;
  needed: number;
}

export function usePickItems(ctx: SchoolContext, classId: string, entries: Entry[], lang: Lang): PickItem[] {
  return useMemo(() => {
    const cls = ctx.classes.find((c) => c.id === classId);
    const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
    if (!cls || !grade) return [];
    const rows = classProgress(classId, entries, effectivePlan(cls, grade)).map((r) => ({
      item: r.item,
      key: r.key,
      name: planItemName(r.item, ctx, lang),
      placed: r.placed,
      needed: r.needed,
    }));
    return [...rows.filter((r) => r.placed < r.needed), ...rows.filter((r) => r.placed >= r.needed)];
  }, [ctx, classId, entries, lang]);
}

export function initials(name: string): string {
  return name
    .replace(/^((Mrs?|Ms|Rev|Ven|Fr|Dr)\.\s*)+/, '')
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
