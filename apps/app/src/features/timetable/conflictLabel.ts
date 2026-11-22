// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName, teacherDisplayName, type BusyDetail, type Lang, type PlanItem, type SchoolContext } from '@sathiya/core';
import type { TFunction } from 'i18next';

export function classNames(ctx: SchoolContext, ids: string[]): string {
  return ids
    .map((id) => ctx.classes.find((c) => c.id === id)?.name ?? id)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .join('+');
}

function groupName(ctx: SchoolContext, key: string, lang: Lang): string | undefined {
  const group = ctx.grades
    .flatMap((g) => g.plan)
    .concat(ctx.classes.flatMap((c) => c.planOverride ?? []))
    .find((p): p is Extract<PlanItem, { kind: 'group' }> => p.kind === 'group' && p.key === key);
  return group && pickName(group, lang);
}

export function busyLabel(t: TFunction, b: Omit<BusyDetail, 'entryId'>, ctx: SchoolContext, lang: Lang): string {
  const classes = classNames(ctx, b.classIds);
  const s = ctx.subjects.find((x) => x.id === b.subjectId);
  const subjectName = s ? pickName(s, lang) : b.subjectId;
  if (b.kind === 'teacher') return t('busy.teaching', { classes, subject: subjectName });
  const subject = (b.groupKey !== undefined && groupName(ctx, b.groupKey, lang)) || subjectName;
  const teacher = b.teacherId === null ? undefined : ctx.teachers.find((x) => x.id === b.teacherId);
  return teacher
    ? t('busy.classWithTeacher', { classes, subject, teacher: teacherDisplayName(teacher, lang) })
    : t('busy.class', { classes, subject });
}
