// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { fillWithClassTeacher } from './fill';
import { C, ctx, entries, entries6B, entry, mahasen, S, T } from './fixtures';
import type { Entry } from './types';

describe('fillWithClassTeacher', () => {
  it('fills the 4 empty 6B slots with Perera, Science twice first', () => {
    expect(fillWithClassTeacher({ ctx, entries: entries6B, classId: C.c6b })).toEqual([
      { day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.science, teacherId: T.perera }] },
      { day: 3, period: 7, classIds: [C.c6b], lessons: [{ subjectId: S.science, teacherId: T.perera }] },
      { day: 4, period: 5, classIds: [C.c6b], lessons: [{ subjectId: S.health, teacherId: T.perera }] },
      { day: 4, period: 6, classIds: [C.c6b], lessons: [{ subjectId: S.pts, teacherId: T.perera }] },
    ]);
  });

  it('skips slots where the class teacher is busy elsewhere', () => {
    const drafts = fillWithClassTeacher({ ctx, entries, classId: C.c6b });
    expect(drafts.map((d) => [d.day, d.period, d.lessons[0]?.subjectId])).toEqual([
      [3, 7, S.science],
      [4, 5, S.science],
      [4, 6, S.health],
    ]);
  });

  it('stops at the teacher daily limit, counting drafts already produced', () => {
    const busyThu: Entry[] = [2, 3, 4, 5, 6, 7, 8].map((p) => entry(`x-${p}`, 3, p, [C.c6a], [[S.maths, T.perera]]));
    const sixB = entries6B.filter((e) => !(e.day === 3 && e.period === 1));
    const drafts = fillWithClassTeacher({ ctx, entries: [...sixB, ...busyThu], classId: C.c6b });
    expect(drafts.filter((d) => d.day === 3)).toEqual([]);
    const sixBOnly = entries6B.filter((e) => e.day !== 0);
    const monday = fillWithClassTeacher({ ctx, entries: sixBOnly, classId: C.c6b }).filter((d) => d.day === 0);
    expect(monday.map((d) => d.period)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('does not count a lesson outside the class template as placed', () => {
    const orphan = entry('o', 4, 8, [C.c6c], [[S.science, T.dissanayake]]);
    const without = fillWithClassTeacher({ ctx, entries: [], classId: C.c6c });
    const withOrphan = fillWithClassTeacher({ ctx, entries: [orphan], classId: C.c6c });
    const science = (ds: typeof without) => ds.filter((d) => d.lessons[0]?.subjectId === S.science).length;
    expect(science(withOrphan)).toBe(science(without));
  });

  it('leaves slots empty once no subject item needs more', () => {
    const drafts = fillWithClassTeacher({ ctx, entries: [], classId: C.c6b });
    const plan = ctx.grades.find((g) => g.id === 'g-6')!.plan;
    const subjectNeed = plan.reduce((n, p) => (p.kind === 'subject' ? n + p.perWeek : n), 0);
    expect(drafts.length).toBeLessThanOrEqual(subjectNeed);
    expect(drafts.every((d) => d.lessons[0]?.teacherId === T.perera)).toBe(true);
    expect(drafts.some((d) => d.lessons[0]?.subjectId === S.buddhism)).toBe(false);
  });

  it('returns [] without a class teacher', () => {
    const noTeacher = { ...ctx, classes: ctx.classes.map((c) => (c.id === C.c6b ? { ...c, classTeacherId: undefined } : c)) };
    expect(fillWithClassTeacher({ ctx: noTeacher, entries: entries6B, classId: C.c6b })).toEqual([]);
    expect(fillWithClassTeacher({ ctx, entries: entries6B, classId: 'nope' })).toEqual([]);
  });

  it('ignores the daily limit for a classTeacherAll class teacher in their own class', () => {
    const plan = [{ kind: 'subject' as const, subjectId: mahasen.S.maths, perWeek: 20 }];
    const c = {
      ...mahasen.ctx,
      teachers: mahasen.ctx.teachers.map((t) => (t.id === 'mh-t-1a' ? { ...t, maxPerDay: 1 } : t)),
      classes: mahasen.ctx.classes.map((k) => (k.id === 'mh-c-1a' ? { ...k, planOverride: plan } : k)),
    };
    const drafts = fillWithClassTeacher({ ctx: c, entries: [], classId: 'mh-c-1a' });
    expect(drafts.filter((d) => d.day === 0).length).toBeGreaterThan(1);
  });
});
