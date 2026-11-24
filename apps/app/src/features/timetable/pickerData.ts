// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { classPlacement, formatAmount, formatAmountPair, type Entry, type Lang, type PlanItem, type SchoolContext, type Subject, type Teacher } from '@sathiya/core';
import type { TFunction } from 'i18next';
import { useMemo } from 'react';
import { planItemName } from './labels';

export type GroupItem = Extract<PlanItem, { kind: 'group' }>;

export interface PickItem {
  item: PlanItem;
  key: string;
  name: string;
  placed: number;
  needed: number;
  unit: 'periods' | 'minutes';
}

export function pickNeed(t: TFunction, p: Pick<PickItem, 'placed' | 'needed' | 'unit'>, lang: Lang): string {
  return p.placed < p.needed
    ? t(p.unit === 'minutes' ? 'picker.needsTime' : 'picker.needs', { amount: formatAmount(p.needed - p.placed, p.unit, lang) })
    : t('picker.done', { progress: formatAmountPair(p.placed, p.needed, p.unit, lang) });
}

export function usePickItems(ctx: SchoolContext, classId: string, entries: Entry[], lang: Lang): PickItem[] {
  return useMemo(() => {
    const cls = ctx.classes.find((c) => c.id === classId);
    if (!cls) return [];
    const rows = classPlacement(cls, entries, ctx).rows.map((r) => ({
      item: r.item,
      key: r.key,
      name: planItemName(r.item, ctx, lang),
      placed: r.placed,
      needed: r.needed,
      unit: r.unit,
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

export function teacherSubjects(teacher: Teacher, ctx: SchoolContext): Subject[] {
  if (!teacher.isPrimary) return teacher.subjectIds.map((id) => ctx.subjects.find((s) => s.id === id)).filter((s): s is Subject => !!s);
  const ids = new Set<string>();
  const grades = ctx.grades.filter((g) => teacher.grades.includes(g.number));
  const plans = grades.map((g) => g.plan).concat(ctx.classes.filter((c) => grades.some((g) => g.id === c.gradeId)).map((c) => c.planOverride ?? []));
  for (const item of plans.flat()) {
    if (item.kind === 'subject') ids.add(item.subjectId);
    else item.optionSubjectIds.forEach((id) => ids.add(id));
  }
  return ctx.subjects.filter((s) => ids.has(s.id));
}
