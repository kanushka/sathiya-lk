import { describe, expect, it } from 'vitest';
import { C, ctx, entries, entry, S, T } from './fixtures';
import { classOptionsForTeacherSlot, matchClassPeriod, teacherDayLoad, teacherOptionsForSlot, teachesSubject } from './availability';
import type { DayIndex, Entry, Teacher } from './types';

const teacher = (id: string): Teacher => ctx.teachers.find((t) => t.id === id)!;
const cls = (id: string) => ctx.classes.find((c) => c.id === id)!;
const ids = (opts: Array<{ teacher: Teacher }>) => opts.map((o) => o.teacher.id);
const find = (r: ReturnType<typeof teacherOptionsForSlot>, id: string) => [...r.available, ...r.unavailable].find((o) => o.teacher.id === id);

describe('teachesSubject', () => {
  it('requires subject and grade for subject teachers', () => {
    expect(teachesSubject(teacher(T.perera), S.maths, 6)).toBe(true);
    expect(teachesSubject(teacher(T.perera), S.maths, 9)).toBe(false);
    expect(teachesSubject(teacher(T.perera), S.english, 6)).toBe(false);
    expect(teachesSubject(teacher(T.jayawardena), S.maths, 6)).toBe(false);
  });

  it('a primary teacher qualifies for any subject in their grade', () => {
    expect(teachesSubject(teacher(T.wickramasinghe), S.science, 1)).toBe(true);
    expect(teachesSubject(teacher(T.wickramasinghe), S.maths, 1)).toBe(true);
    expect(teachesSubject(teacher(T.wickramasinghe), S.maths, 2)).toBe(false);
  });
});

describe('teacherDayLoad', () => {
  it('counts entries on the day whose lessons include the teacher', () => {
    expect(teacherDayLoad(T.perera, 2, entries)).toBe(2);
    expect(teacherDayLoad(T.perera, 3, entries)).toBe(2);
    expect(teacherDayLoad(T.ananda, 0, entries)).toBe(1);
    expect(teacherDayLoad(T.herath, 2, entries)).toBe(0);
  });
});

describe('teacherOptionsForSlot', () => {
  const bandaraWed: Entry[] = [1, 2, 3, 5, 6, 7, 8].map((p) => entry(`b-${p}`, 2, p, [C.c6a], [[S.maths, T.bandara]]));

  it('lists every teacher exactly once', () => {
    const r = teacherOptionsForSlot({ ctx, entries, classIds: [C.c6b], day: 2, period: 4, subjectId: S.maths });
    expect([...ids(r.available), ...ids(r.unavailable)].sort()).toEqual(ctx.teachers.map((t) => t.id).sort());
  });

  it('teacher at 7/7 → limit; busy with busyWith; not teaching grade → not-qualified', () => {
    const r = teacherOptionsForSlot({ ctx, entries: [...entries, ...bandaraWed], classIds: [C.c6b], day: 2, period: 4, subjectId: S.maths });
    expect(r.available).toEqual([]);
    expect(find(r, T.bandara)).toEqual({ teacher: teacher(T.bandara), loadToday: 7, reason: 'limit' });
    expect(find(r, T.perera)).toEqual({ teacher: teacher(T.perera), loadToday: 2, reason: 'busy', busyWith: { classIds: [C.c6a], subjectId: S.maths } });
    expect(find(r, T.jayawardena)?.reason).toBe('not-qualified');
    expect(find(r, T.wickramasinghe)?.reason).toBe('not-qualified');
    expect(find(r, T.gunasekara)?.reason).toBe('not-qualified');
  });

  it('not-qualified takes precedence over busy', () => {
    const r = teacherOptionsForSlot({ ctx, entries, classIds: [C.c6b], day: 2, period: 4, subjectId: S.english });
    expect(find(r, T.perera)?.reason).toBe('not-qualified');
    expect(find(r, T.perera)?.busyWith).toBeUndefined();
  });

  it('sorts available by load then name', () => {
    const r = teacherOptionsForSlot({ ctx, entries, classIds: [C.c6b], day: 2, period: 4, subjectId: S.sinhala });
    expect(r.available.map((o) => [o.teacher.id, o.loadToday])).toEqual([
      [T.ranasinghe, 0],
      [T.rSilva, 2],
    ]);
    expect(r.available[0]?.reason).toBeUndefined();
    const tie = teacherOptionsForSlot({ ctx, entries: [], classIds: [C.c6b], day: 2, period: 4, subjectId: S.maths });
    expect(ids(tie.available)).toEqual([T.bandara, T.perera]);
  });

  it('editingEntryId excludes the entry itself from busy and load', () => {
    const before = teacherOptionsForSlot({ ctx, entries, classIds: [C.c6b], day: 2, period: 3, subjectId: S.maths });
    expect(find(before, T.perera)).toMatchObject({ reason: 'busy', loadToday: 2, busyWith: { classIds: [C.c6b], subjectId: S.maths } });
    const editing = teacherOptionsForSlot({ ctx, entries, classIds: [C.c6b], day: 2, period: 3, subjectId: S.maths, editingEntryId: 'e-6b-2-3' });
    expect(find(editing, T.perera)).toEqual({ teacher: teacher(T.perera), loadToday: 1 });
  });

  it('busy is clock-time overlap across templates', () => {
    const in1A = entry('x-1a', 0, 3, [C.c1a], [[S.maths, T.perera]]);
    const r = teacherOptionsForSlot({ ctx, entries: [...entries, in1A], classIds: [C.c6a], day: 0, period: 3, subjectId: S.maths });
    expect(find(r, T.perera)).toMatchObject({ reason: 'busy', busyWith: { classIds: [C.c1a], subjectId: S.maths } });
    const p4 = teacherOptionsForSlot({ ctx, entries: [...entries, in1A], classIds: [C.c6a], day: 0, period: 4, subjectId: S.maths });
    expect(find(p4, T.perera)?.reason).toBeUndefined();
  });

  it('a primary teacher is available for any subject in grade 1', () => {
    const r = teacherOptionsForSlot({ ctx, entries, classIds: [C.c1a], day: 2, period: 1, subjectId: S.science });
    expect(ids(r.available)).toEqual([T.wickramasinghe]);
    expect(find(r, T.kumari)?.reason).toBe('not-qualified');
  });
});

describe('matchClassPeriod', () => {
  it('picks the class period with the largest overlap', () => {
    expect(matchClassPeriod(cls(C.c1a), ctx, 0, { start: 550, end: 590 })).toBe(3);
    expect(matchClassPeriod(cls(C.c6a), ctx, 0, { start: 550, end: 590 })).toBe(3);
  });

  it('breaks ties towards the lower period', () => {
    expect(matchClassPeriod(cls(C.c6a), ctx, 0, { start: 530, end: 570 })).toBe(2);
  });

  it('returns null when nothing overlaps', () => {
    expect(matchClassPeriod(cls(C.c1a), ctx, 0, { start: 770, end: 810 })).toBeNull();
    expect(matchClassPeriod(cls(C.c6c), ctx, 4, { start: 770, end: 810 })).toBeNull();
    expect(matchClassPeriod(cls(C.c6c), ctx, 3, { start: 770, end: 810 })).toBe(8);
  });
});

describe('classOptionsForTeacherSlot', () => {
  const opts = (teacherId: string, day: DayIndex, defaultPeriod: number, subjectId: string, e: Entry[] = entries) =>
    classOptionsForTeacherSlot({ ctx, entries: e, teacherId, day, defaultPeriod, subjectId }).map((o) => [o.cls.id, o.period, o.free]);

  it('excludes 1A when the default row does not overlap any Primary period', () => {
    expect(opts(T.wickramasinghe, 0, 8, S.sinhala)).toEqual([]);
  });

  it('includes 1A with the matched period when it overlaps', () => {
    expect(opts(T.wickramasinghe, 0, 3, S.sinhala)).toEqual([[C.c1a, 3, true]]);
    expect(opts(T.wickramasinghe, 1, 3, S.sinhala)).toEqual([[C.c1a, 3, false]]);
  });

  it('marks classes busy when the class or the teacher is taken', () => {
    expect(opts(T.perera, 2, 5, S.maths)).toEqual([
      [C.c6a, 5, true],
      [C.c6b, 5, false],
      [C.c6c, 5, true],
    ]);
    expect(opts(T.perera, 2, 4, S.maths)).toEqual([
      [C.c6a, 4, false],
      [C.c6b, 4, false],
      [C.c6c, 4, false],
    ]);
  });

  it('includes group options and per-class plan overrides, ordered by grade then name', () => {
    expect(opts(T.ananda, 2, 5, S.buddhism, [])).toEqual([
      [C.c6a, 5, true],
      [C.c6b, 5, true],
      [C.c6c, 5, true],
      [C.c12a, 5, true],
    ]);
  });

  it('excludes classes whose plan lacks the subject or teachers not qualified', () => {
    expect(opts(T.perera, 2, 5, S.english)).toEqual([]);
    expect(opts(T.ananda, 2, 5, S.pali, [])).toEqual([[C.c12a, 5, true]]);
    expect(opts('nope', 2, 5, S.maths)).toEqual([]);
  });

  it('excludes a class with no period on that day', () => {
    expect(opts(T.perera, 4, 8, S.maths, [])).toEqual([
      [C.c6a, 8, true],
      [C.c6b, 8, true],
    ]);
  });

  it('editingEntryId frees the class of the entry being edited', () => {
    expect(opts(T.perera, 2, 3, S.maths)).toContainEqual([C.c6b, 3, false]);
    const editing = classOptionsForTeacherSlot({ ctx, entries, teacherId: T.perera, day: 2, defaultPeriod: 3, subjectId: S.maths, editingEntryId: 'e-6b-2-3' });
    expect(editing.find((o) => o.cls.id === C.c6b)).toMatchObject({ period: 3, free: true });
  });
});
