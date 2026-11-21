import { describe, expect, it } from 'vitest';
import { entryWindow, findConflicts, withTeacherIds } from './clash';
import { C, ctx, entries, entries6B, entry, S, T } from './fixtures';
import type { EntryDraft } from './types';

const draft = (d: Partial<EntryDraft> & Pick<EntryDraft, 'day' | 'period' | 'classIds' | 'lessons'>): EntryDraft => ({ ...d });

describe('entryWindow', () => {
  it('uses the template of the first class', () => {
    expect(entryWindow(draft({ day: 0, period: 3, classIds: [C.c6a], lessons: [] }), ctx)).toEqual({ start: 550, end: 590 });
    expect(entryWindow(draft({ day: 0, period: 3, classIds: [C.c1a], lessons: [] }), ctx)).toEqual({ start: 540, end: 580 });
  });

  it('respects per-day templates', () => {
    expect(entryWindow(draft({ day: 3, period: 8, classIds: [C.c6c], lessons: [] }), ctx)).toEqual({ start: 770, end: 810 });
    expect(entryWindow(draft({ day: 4, period: 8, classIds: [C.c6c], lessons: [] }), ctx)).toBeNull();
  });

  it('returns null for unknown class, template or period', () => {
    expect(entryWindow(draft({ day: 0, period: 1, classIds: ['nope'], lessons: [] }), ctx)).toBeNull();
    expect(entryWindow(draft({ day: 0, period: 1, classIds: [], lessons: [] }), ctx)).toBeNull();
    expect(entryWindow(draft({ day: 0, period: 7, classIds: [C.c1a], lessons: [] }), ctx)).toBeNull();
    const broken = { ...ctx, classes: [{ id: 'x', gradeId: 'g-6', name: 'X', templateId: 'missing' }] };
    expect(entryWindow(draft({ day: 0, period: 1, classIds: ['x'], lessons: [] }), broken)).toBeNull();
  });
});

describe('withTeacherIds', () => {
  it('collects unique non-null teacher ids in lesson order', () => {
    const d = draft({
      day: 0,
      period: 1,
      classIds: [C.c6b],
      lessons: [
        { subjectId: S.music, teacherId: T.fernando },
        { subjectId: S.dancing, teacherId: null },
        { subjectId: S.art, teacherId: T.dissanayake },
        { subjectId: S.music, teacherId: T.fernando },
      ],
    });
    expect(withTeacherIds(d).teacherIds).toEqual([T.fernando, T.dissanayake]);
    expect(withTeacherIds(d).lessons).toBe(d.lessons);
  });
});

describe('findConflicts', () => {
  const sixA_P3 = entry('x-6a', 1, 3, [C.c6a], [[S.maths, T.perera]]);

  it('flags a teacher whose windows overlap across different templates', () => {
    const d = draft({ day: 1, period: 3, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(d, [sixA_P3], ctx)).toEqual([{ kind: 'teacher', id: T.perera, entryId: 'x-6a' }]);
  });

  it('flags overlap even when period numbers differ', () => {
    const d = draft({ day: 1, period: 4, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(d, [sixA_P3], ctx)).toEqual([{ kind: 'teacher', id: T.perera, entryId: 'x-6a' }]);
  });

  it('ignores the same period number when windows do not overlap', () => {
    const p6 = draft({ day: 1, period: 6, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    const p7 = entry('x-6a-p7', 1, 7, [C.c6a], [[S.maths, T.perera]]);
    expect(findConflicts(p6, [p7], ctx)).toEqual([]);
    const p6default = entry('x-6a-p6', 1, 6, [C.c6a], [[S.maths, T.perera]]);
    expect(findConflicts(p6, [p6default], ctx)).toEqual([]);
    const p5primary = entry('x-1a-p5', 1, 5, [C.c1a], [[S.maths, T.perera]]);
    const p5default = draft({ day: 1, period: 5, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(p5default, [p5primary], ctx)).toEqual([{ kind: 'teacher', id: T.perera, entryId: 'x-1a-p5' }]);
  });

  it('treats touching windows as not overlapping', () => {
    const p2 = draft({ day: 1, period: 2, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(p2, [sixA_P3], ctx)).toEqual([]);
  });

  it('ignores a different day', () => {
    const d = draft({ day: 2, period: 3, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(d, [sixA_P3], ctx)).toEqual([]);
  });

  it('flags the same class twice', () => {
    const d = draft({ day: 1, period: 3, classIds: [C.c6a], lessons: [{ subjectId: S.science, teacherId: T.gunasekara }] });
    expect(findConflicts(d, [sixA_P3], ctx)).toEqual([{ kind: 'class', id: C.c6a, entryId: 'x-6a' }]);
  });

  it('reports teacher before class without duplicates', () => {
    const d = draft({
      day: 1,
      period: 3,
      classIds: [C.c6a, C.c6a],
      lessons: [
        { subjectId: S.maths, teacherId: T.perera },
        { subjectId: S.science, teacherId: T.perera },
      ],
    });
    expect(findConflicts(d, [sixA_P3], ctx)).toEqual([
      { kind: 'teacher', id: T.perera, entryId: 'x-6a' },
      { kind: 'class', id: C.c6a, entryId: 'x-6a' },
    ]);
  });

  it('excludes the entry being edited', () => {
    const d = draft({ id: 'x-6a', day: 1, period: 3, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(d, [sixA_P3], ctx)).toEqual([]);
  });

  it('conflicts once per clashing teacher in a group entry', () => {
    const religion = entry('x-rel', 0, 4, [C.c6a, C.c6b], [
      [S.buddhism, T.ananda],
      [S.catholicism, T.mSilva],
      [S.islam, T.rizan],
    ], 'religion');
    const d = draft({
      day: 0,
      period: 4,
      classIds: [C.c6c],
      groupKey: 'religion',
      lessons: [
        { subjectId: S.buddhism, teacherId: T.ananda },
        { subjectId: S.catholicism, teacherId: T.mSilva },
        { subjectId: S.islam, teacherId: T.rizan },
      ],
    });
    expect(findConflicts(d, [religion], ctx)).toEqual([
      { kind: 'teacher', id: T.ananda, entryId: 'x-rel' },
      { kind: 'teacher', id: T.mSilva, entryId: 'x-rel' },
      { kind: 'teacher', id: T.rizan, entryId: 'x-rel' },
    ]);
  });

  it('uses lessons rather than stored teacherIds and ignores null teachers', () => {
    const stale = { ...sixA_P3, teacherIds: [] };
    const d = draft({ day: 1, period: 3, classIds: [C.c1a], lessons: [{ subjectId: S.maths, teacherId: T.perera }, { subjectId: S.art, teacherId: null }] });
    expect(findConflicts(d, [stale], ctx)).toEqual([{ kind: 'teacher', id: T.perera, entryId: 'x-6a' }]);
    const unassigned = entry('x-null', 1, 3, [C.c6c], [[S.art, null]]);
    expect(findConflicts(d, [unassigned], ctx)).toEqual([]);
  });

  it('returns [] for a draft with no window and skips existing entries with no window', () => {
    const noWindow = draft({ day: 1, period: 9, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(noWindow, [sixA_P3], ctx)).toEqual([]);
    const orphan = entry('x-orphan', 1, 7, [C.c1a], [[S.maths, T.perera]]);
    const d = draft({ day: 1, period: 7, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(d, [orphan], ctx)).toEqual([]);
  });

  it('keeps existing-entries order', () => {
    const a = entry('a', 1, 3, [C.c6b], [[S.maths, T.perera]]);
    const b = entry('b', 1, 3, [C.c6a], [[S.science, T.gunasekara]]);
    const d = draft({ day: 1, period: 3, classIds: [C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect(findConflicts(d, [a, b], ctx)).toEqual([
      { kind: 'teacher', id: T.perera, entryId: 'a' },
      { kind: 'class', id: C.c6a, entryId: 'b' },
    ]);
  });
});

describe('fixtures', () => {
  it('6B grid matches the canvas', () => {
    const sixB = entries6B.filter((e) => e.classIds.includes(C.c6b));
    expect(sixB).toHaveLength(36);
    expect(new Set(sixB.map((e) => `${e.day}-${e.period}`)).size).toBe(36);
    const count = (subjectId: string) => sixB.filter((e) => e.lessons.some((l) => l.subjectId === subjectId)).length;
    expect(count(S.maths)).toBe(6);
    expect(count(S.science)).toBe(3);
    expect(sixB.filter((e) => e.groupKey === 'religion')).toHaveLength(3);
    expect(sixB.filter((e) => e.groupKey === 'aesthetic')).toHaveLength(3);
    const wedP3 = sixB.find((e) => e.day === 2 && e.period === 3);
    expect(wedP3?.lessons).toEqual([{ subjectId: S.maths, teacherId: T.perera }]);
  });

  it('every entry has teacherIds consistent with lessons and ids are unique', () => {
    for (const e of entries) expect(e.teacherIds).toEqual(withTeacherIds(e).teacherIds);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
  });

  it('every entry references existing classes, subjects and teachers', () => {
    const classIds = new Set(ctx.classes.map((c) => c.id));
    const subjectIds = new Set(ctx.subjects.map((s) => s.id));
    const teacherIds = new Set(ctx.teachers.map((t) => t.id));
    for (const e of entries) {
      for (const c of e.classIds) expect(classIds).toContain(c);
      for (const l of e.lessons) {
        expect(subjectIds).toContain(l.subjectId);
        if (l.teacherId) expect(teacherIds).toContain(l.teacherId);
      }
      expect(entryWindow(e, ctx)).not.toBeNull();
    }
  });

  it('plans fill their templates', () => {
    const total = (gradeId: string) => ctx.grades.find((g) => g.id === gradeId)?.plan.reduce((n, p) => n + p.perWeek, 0);
    expect(total('g-6')).toBe(40);
    expect(total('g-1')).toBe(30);
  });

  it('is clash-free', () => {
    for (const e of entries) expect(findConflicts(e, entries, ctx)).toEqual([]);
  });
});
