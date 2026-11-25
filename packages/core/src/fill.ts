// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { withTeacherIds } from './clash';
import { findClass, gradeOf, templateOf } from './lookup';
import { singleSpec, suggestPins } from './pin';
import { classPlacement } from './progress';
import { staffingFor } from './staffing';
import type { Entry, EntryDraft, SchoolContext } from './types';

export type FillSkip = 'not-primary' | 'no-subjects' | 'specialists-only' | 'all-placed' | 'no-room';
export interface FillPlan { drafts: EntryDraft[]; skip?: FillSkip; subjectIds: string[] }

export function fillWithClassTeacher(args: { ctx: SchoolContext; entries: Entry[]; classId: string }): FillPlan {
  const { ctx, classId } = args;
  const cls = findClass(ctx, classId);
  const teacherId = cls?.classTeacherId;
  const teacher = ctx.teachers.find((t) => t.id === teacherId);
  const grade = cls && gradeOf(ctx, cls);
  if (!cls || !teacherId || !teacher || !grade || !templateOf(ctx, cls)) return { drafts: [], subjectIds: [] };
  const staffing = staffingFor(grade, ctx);
  if (staffing.mode === 'subjectTeachers') return { drafts: [], skip: 'not-primary', subjectIds: [] };
  const rows = classPlacement(cls, args.entries, ctx).rows.flatMap((r) =>
    r.item.kind === 'subject' && r.unit === 'periods' ? [{ subjectId: r.item.subjectId, need: r.needed - r.placed }] : [],
  );
  const isSpecialist = (id: string) => staffing.specialistSubjectIds.includes(id);
  const eligible = rows.filter((r) => !isSpecialist(r.subjectId));
  const subjectIds = eligible.map((r) => r.subjectId);
  const specialistsLeft = rows.some((r) => isSpecialist(r.subjectId) && r.need > 0);
  if (eligible.length === 0) return { drafts: [], skip: specialistsLeft ? 'specialists-only' : 'no-subjects', subjectIds };
  const remaining = eligible.filter((r) => r.need > 0).sort((a, b) => b.need - a.need);
  if (remaining.length === 0) return { drafts: [], skip: specialistsLeft ? 'specialists-only' : 'all-placed', subjectIds };
  const all: Entry[] = [...args.entries];
  const drafts: EntryDraft[] = [];
  for (const r of remaining) {
    const spec = singleSpec(classId, r.subjectId, teacherId);
    for (const { day, period } of suggestPins({ ctx, entries: all, spec, count: r.need })) {
      const draft: EntryDraft = { day, period, classIds: [classId], lessons: [{ subjectId: r.subjectId, teacherId }] };
      drafts.push(draft);
      all.push({ ...withTeacherIds(draft), id: `fill-draft-${drafts.length}` });
    }
  }
  drafts.sort((a, b) => a.day - b.day || a.period - b.period);
  return drafts.length > 0 ? { drafts, subjectIds } : { drafts, skip: 'no-room', subjectIds };
}
