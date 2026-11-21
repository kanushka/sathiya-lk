// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, Grade, PeriodTemplate, SchoolClass, SchoolContext } from './types';

export const DAYS: DayIndex[] = [0, 1, 2, 3, 4];

export function findClass(ctx: SchoolContext, id: string): SchoolClass | undefined {
  return ctx.classes.find((c) => c.id === id);
}

export function gradeOf(ctx: SchoolContext, cls: SchoolClass): Grade | undefined {
  return ctx.grades.find((g) => g.id === cls.gradeId);
}

export function templateOf(ctx: SchoolContext, cls: SchoolClass): PeriodTemplate | undefined {
  return ctx.templates.find((t) => t.id === cls.templateId);
}
