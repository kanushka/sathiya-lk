// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { fillWithClassTeacher } from './fill';
import { C, ctx, entries, entries6B, entry, G, mahasen, S, T } from './fixtures';
import type { Entry, PlanItem, SchoolContext } from './types';

const withGrade1 = (patch: { number?: number; plan?: PlanItem[] }): SchoolContext => ({
  ...ctx,
  grades: ctx.grades.map((g) => (g.id === G.g1 ? { ...g, ...patch } : g)),
});

describe('fillWithClassTeacher', () => {
  it('is not offered for subject-teacher grades', () => {
    const res = fillWithClassTeacher({ ctx, entries: entries6B, classId: C.c6b });
    expect(res).toEqual({ drafts: [], skip: 'not-primary', subjectIds: [] });
  });

  it('fills every remaining subject with the class teacher in Grades 1–2', () => {
    const { drafts, skip } = fillWithClassTeacher({ ctx, entries, classId: C.c1a });
    expect(skip).toBeUndefined();
    expect(drafts.every((d) => d.lessons[0]?.teacherId === T.wickramasinghe)).toBe(true);
    expect(new Set(drafts.map((d) => d.lessons[0]?.subjectId))).toContain(S.english);
  });

  it('leaves specialist subjects (English) out in Grades 3–5', () => {
    const { drafts } = fillWithClassTeacher({ ctx: withGrade1({ number: 3 }), entries: [], classId: C.c1a });
    expect(drafts.length).toBeGreaterThan(0);
    expect(drafts.some((d) => d.lessons[0]?.subjectId === S.english)).toBe(false);
  });

  it('places no more than each subject still needs and never a group', () => {
    const { drafts } = fillWithClassTeacher({ ctx, entries: [], classId: C.c1a });
    const count = (s: string) => drafts.filter((d) => d.lessons[0]?.subjectId === s).length;
    expect(count(S.maths)).toBeLessThanOrEqual(7);
    expect(count(S.sinhala)).toBeLessThanOrEqual(8);
    expect(drafts.some((d) => d.lessons[0]?.subjectId === S.buddhism)).toBe(false);
  });

  it('spreads a subject across days instead of stacking one day', () => {
    const { drafts } = fillWithClassTeacher({ ctx, entries: [], classId: C.c1a });
    const english = drafts.filter((d) => d.lessons[0]?.subjectId === S.english);
    expect(english).toHaveLength(3);
    expect(new Set(english.map((d) => d.day)).size).toBe(3);
  });

  it('skips with all-placed when every fillable subject is already full', () => {
    const plan: PlanItem[] = [{ kind: 'subject', subjectId: S.maths, perWeek: 1 }];
    const res = fillWithClassTeacher({ ctx: withGrade1({ plan }), entries, classId: C.c1a });
    expect(res.drafts).toEqual([]);
    expect(res.skip).toBe('all-placed');
    expect(res.subjectIds).toEqual([S.maths]);
  });

  it('skips with nothing-to-fill when only specialist subjects are left', () => {
    const plan: PlanItem[] = [{ kind: 'subject', subjectId: S.english, perWeek: 3 }];
    const res = fillWithClassTeacher({ ctx: withGrade1({ number: 4, plan }), entries: [], classId: C.c1a });
    expect(res.skip).toBe('nothing-to-fill');
  });

  it('skips slots where the class teacher is busy elsewhere', () => {
    const busy: Entry[] = [entry('x', 2, 1, [C.c6a], [[S.maths, T.wickramasinghe]])];
    const { drafts } = fillWithClassTeacher({ ctx, entries: busy, classId: C.c1a });
    expect(drafts.some((d) => d.day === 2 && d.period === 1)).toBe(false);
  });

  it('returns no drafts without a class teacher', () => {
    const noTeacher = { ...ctx, classes: ctx.classes.map((c) => (c.id === C.c1a ? { ...c, classTeacherId: undefined } : c)) };
    expect(fillWithClassTeacher({ ctx: noTeacher, entries: [], classId: C.c1a }).drafts).toEqual([]);
    expect(fillWithClassTeacher({ ctx, entries: [], classId: 'nope' }).drafts).toEqual([]);
  });

  it('ignores the daily limit for a Grade 1–2 class teacher in their own class', () => {
    const plan = [{ kind: 'subject' as const, subjectId: mahasen.S.maths, perWeek: 20 }];
    const c = {
      ...mahasen.ctx,
      teachers: mahasen.ctx.teachers.map((t) => (t.id === 'mh-t-1a' ? { ...t, maxPerDay: 1 } : t)),
      classes: mahasen.ctx.classes.map((k) => (k.id === 'mh-c-1a' ? { ...k, planOverride: plan } : k)),
    };
    const { drafts } = fillWithClassTeacher({ ctx: c, entries: [], classId: 'mh-c-1a' });
    expect(drafts.filter((d) => d.day === 0).length).toBeGreaterThan(1);
  });
});
