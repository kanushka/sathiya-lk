// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { effectivePlan, type Entry, type SchoolContext } from '@sathiya/core';
import type { BlockEditorProps } from './BlockEditor';
import type { GroupItem } from './SlotPicker';

export type BlockState = Pick<BlockEditorProps, 'baseClassId' | 'day' | 'period' | 'mode' | 'entry' | 'preset'>;

export function blockKey(b: BlockState): string {
  const m = b.mode.kind === 'group' ? b.mode.item.key : b.mode.subjectId;
  return `${b.baseClassId}-${b.day}-${b.period}-${b.mode.kind}-${m}-${b.entry?.id ?? ''}-${b.preset?.teacherId ?? ''}`;
}

export function isBlock(e: Entry): boolean {
  return e.groupKey !== undefined || e.classIds.length > 1;
}

export function blockStateFor(e: Entry, ctx: SchoolContext, baseClassId: string = e.classIds[0] ?? ''): BlockState {
  if (e.groupKey === undefined) {
    return { baseClassId, day: e.day, period: e.period, mode: { kind: 'combined', subjectId: e.lessons[0]?.subjectId ?? '' }, entry: e };
  }
  const cls = ctx.classes.find((c) => c.id === baseClassId);
  const grade = cls && ctx.grades.find((g) => g.id === cls.gradeId);
  const plan = cls && grade ? effectivePlan(cls, grade) : [];
  const item = plan.find((p): p is GroupItem => p.kind === 'group' && p.key === e.groupKey) ?? {
    kind: 'group' as const,
    key: e.groupKey,
    nameEn: e.groupKey,
    optionSubjectIds: e.lessons.map((l) => l.subjectId),
    perWeek: 0,
  };
  return { baseClassId, day: e.day, period: e.period, mode: { kind: 'group', item }, entry: e };
}
