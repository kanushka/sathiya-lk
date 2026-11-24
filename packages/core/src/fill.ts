// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { teacherDayLoad } from './availability';
import { findConflicts, withTeacherIds } from './clash';
import { DAYS, findClass, gradeOf, templateOf } from './lookup';
import { classPlacement } from './progress';
import { periodsFor } from './time';
import type { Entry, EntryDraft, SchoolContext } from './types';

export function fillWithClassTeacher(args: { ctx: SchoolContext; entries: Entry[]; classId: string }): EntryDraft[] {
  const { ctx, classId } = args;
  const cls = findClass(ctx, classId);
  const teacherId = cls?.classTeacherId;
  const teacher = ctx.teachers.find((t) => t.id === teacherId);
  const grade = cls && gradeOf(ctx, cls);
  const template = cls && templateOf(ctx, cls);
  if (!cls || !teacherId || !teacher || !grade || !template) return [];
  const remaining = classPlacement(cls, args.entries, ctx).rows.flatMap((r) =>
    r.item.kind === 'subject' && r.unit === 'periods' ? [{ subjectId: r.item.subjectId, need: r.needed - r.placed }] : [],
  );
  const all: Entry[] = [...args.entries];
  const drafts: EntryDraft[] = [];
  for (const day of DAYS) {
    for (const { period } of periodsFor(template, day)) {
      const probe: EntryDraft = { day, period, classIds: [classId], lessons: [{ subjectId: '', teacherId }] };
      if (findConflicts(probe, all, ctx).length > 0) continue;
      if (teacherDayLoad(teacherId, day, all) >= teacher.maxPerDay) continue;
      const pick = remaining.reduce<(typeof remaining)[number] | undefined>((best, r) => (r.need > 0 && (!best || r.need > best.need) ? r : best), undefined);
      if (!pick) continue;
      pick.need -= 1;
      const draft: EntryDraft = { day, period, classIds: [classId], lessons: [{ subjectId: pick.subjectId, teacherId }] };
      drafts.push(draft);
      all.push({ ...withTeacherIds(draft), id: `fill-draft-${drafts.length}` });
    }
  }
  return drafts;
}
