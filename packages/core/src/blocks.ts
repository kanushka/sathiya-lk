// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { findConflicts } from './clash';
import { findClass, gradeOf } from './lookup';
import { effectivePlan } from './plan';
import type { DayIndex, Entry, SchoolClass, SchoolContext } from './types';

export function joinableClasses(args: { ctx: SchoolContext; entries: Entry[]; baseClassId: string; day: DayIndex; period: number; editingEntryId?: string }): SchoolClass[] {
  const { ctx, entries, baseClassId, day, period, editingEntryId } = args;
  const base = findClass(ctx, baseClassId);
  if (!base) return [];
  return ctx.classes
    .filter((c) => c.id !== base.id && c.gradeId === base.gradeId && c.templateId === base.templateId)
    .filter((c) => findConflicts({ day, period, classIds: [c.id], lessons: [], ...(editingEntryId === undefined ? {} : { id: editingEntryId }) }, entries, ctx).length === 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function blockMates(args: { ctx: SchoolContext; baseClassId: string; item: { groupKey: string } | { subjectId: string } }): SchoolClass[] {
  const { ctx, baseClassId, item } = args;
  const base = findClass(ctx, baseClassId);
  if (!base) return [];
  return ctx.classes
    .filter((c) => c.id !== base.id && c.gradeId === base.gradeId && c.templateId === base.templateId)
    .filter((c) => {
      const grade = gradeOf(ctx, c);
      if (!grade) return false;
      return effectivePlan(c, grade).some((p) =>
        'groupKey' in item ? p.kind === 'group' && p.key === item.groupKey : p.kind === 'subject' && p.subjectId === item.subjectId,
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
