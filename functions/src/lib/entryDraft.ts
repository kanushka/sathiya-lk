// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { windowOf, type DayIndex, type EntryDraft, type Lesson, type SchoolContext } from '@sathiya/core';
import { docId, docIdList, int, invalid, obj, optDocId, optStr } from './guards';

export function parseDraft(v: unknown): EntryDraft {
  const e = obj(v, 'entry');
  const classIds = docIdList(e.classIds, 'classIds');
  if (!classIds.length) invalid('entry needs at least one class');
  if (!Array.isArray(e.lessons) || !e.lessons.length || e.lessons.length > 30) invalid('entry needs 1–30 lessons');
  const lessons: Lesson[] = (e.lessons as unknown[]).map((l) => {
    const x = obj(l, 'lesson');
    return { subjectId: docId(x.subjectId, 'subjectId'), teacherId: x.teacherId === null ? null : docId(x.teacherId, 'teacherId') };
  });
  const teachers = lessons.flatMap((l) => (l.teacherId === null ? [] : [l.teacherId]));
  if (new Set(teachers).size !== teachers.length) invalid('A teacher can take only one lesson of an entry');
  const draft: EntryDraft = { day: int(e.day, 'day', 0, 4) as DayIndex, period: int(e.period, 'period', 1, 30), classIds, lessons };
  const id = optDocId(e.id, 'id');
  const groupKey = optStr(e.groupKey, 'groupKey');
  if (id !== undefined) draft.id = id;
  if (groupKey !== undefined) draft.groupKey = groupKey;
  return draft;
}

export function validateDraft(ctx: SchoolContext, draft: EntryDraft): void {
  const classes = draft.classIds.map((id) => ctx.classes.find((c) => c.id === id) ?? invalid(`Unknown class ${id}`));
  const first = classes[0]!;
  if (classes.some((c) => c.gradeId !== first.gradeId)) invalid('All classes in a block must be in the same grade');
  if (classes.some((c) => c.templateId !== first.templateId)) invalid('All classes in a block must use the same period template');
  const template = ctx.templates.find((t) => t.id === first.templateId) ?? invalid(`Class ${first.name} has no period template`);
  if (!windowOf(template, draft.day, draft.period)) invalid(`Period ${draft.period} does not exist on that day for ${first.name}`);
  for (const l of draft.lessons) {
    if (!ctx.subjects.some((s) => s.id === l.subjectId)) invalid(`Unknown subject ${l.subjectId}`);
    if (l.teacherId !== null && !ctx.teachers.some((t) => t.id === l.teacherId)) invalid(`Unknown teacher ${l.teacherId}`);
  }
}
