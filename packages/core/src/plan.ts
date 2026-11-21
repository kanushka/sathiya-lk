// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Entry, Grade, PlanItem, SchoolClass } from './types';

export function effectivePlan(cls: SchoolClass, grade: Grade): PlanItem[] {
  return cls.planOverride ?? grade.plan;
}

export function planKey(item: PlanItem): string {
  return item.kind === 'subject' ? `subject:${item.subjectId}` : `group:${item.key}`;
}

export function entryPlanKey(e: Entry, plan: PlanItem[]): string | null {
  if (e.groupKey !== undefined && plan.some((p) => p.kind === 'group' && p.key === e.groupKey)) return `group:${e.groupKey}`;
  const subjectId = e.lessons[0]?.subjectId;
  if (subjectId !== undefined && plan.some((p) => p.kind === 'subject' && p.subjectId === subjectId)) return `subject:${subjectId}`;
  return null;
}
