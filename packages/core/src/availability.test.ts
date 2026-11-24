// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, ctx, entries, entry, mahasen, S, T } from './fixtures';
import { classOptionsForTeacherSlot, matchClassPeriod, preferredTeacherFor, teacherClassOptions, teacherDayLoad, teacherLoad, teacherOptionsForSlot, teachesSubject } from './availability';
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

  it('ignores own-class slots in classTeacherAll grades', () => {
    const own = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => entry(`m-${p}`, 0, p, ['mh-c-1a'], [[mahasen.S.maths, 'mh-t-1a']]));
    expect(teacherDayLoad('mh-t-1a', 0, own, mahasen.ctx)).toBe(0);
    expect(teacherDayLoad('mh-t-1a', 0, own)).toBe(9);
  });

  it('still counts slots in other classes for a classTeacherAll class teacher', () => {
    const other = [entry('m-x', 0, 1, ['mh-c-1b'], [[mahasen.S.maths, 'mh-t-1a']])];
    expect(teacherDayLoad('mh-t-1a', 0, other, mahasen.ctx)).toBe(1);
  });
});

describe('teacherOptionsForSlot own-class exemption', () => {
  it('keeps a classTeacherAll class teacher available in their own class when the day is otherwise full', () => {
    const c = { ...mahasen.ctx, teachers: mahasen.ctx.teachers.map((t) => (t.id === 'mh-t-1a' ? { ...t, maxPerDay: 2 } : t)) };
    const other = [1, 2].map((p) => entry(`o-${p}`, 0, p, ['mh-c-1b'], [[mahasen.S.maths, 'mh-t-1a']]));
    const own = teacherOptionsForSlot({ ctx: c, entries: other, classIds: ['mh-c-1a'], day: 0, period: 3, subjectId: mahasen.S.maths });
    expect([...own.available, ...own.unavailable].find((o) => o.teacher.id === 'mh-t-1a')?.reason).toBeUndefined();
    const elsewhere = teacherOptionsForSlot({ ctx: c, entries: other, classIds: ['mh-c-1c'], day: 0, period: 3, subjectId: mahasen.S.maths });
    expect(elsewhere.unavailable.find((o) => o.teacher.id === 'mh-t-1a')?.reason).toBe('limit');
  });
});

describe('teacherLoad', () => {
  it('sums minutes across templates', () => {
    const es = [
      entry('l-1', 0, 1, ['mh-c-1a'], [[mahasen.S.maths, 'mh-t-1a']]),
      entry('l-2', 0, 2, ['mh-c-1a'], [[mahasen.S.maths, 'mh-t-1a']]),
    ];
    expect(teacherLoad('mh-t-1a', es, mahasen.ctx)).toEqual({ entries: 2, minutes: 60 + 15, timedMinutes: 60 + 15 });
    expect(teacherLoad('mh-t-1b', es, mahasen.ctx)).toEqual({ entries: 0, minutes: 0, timedMinutes: 0 });
  });

  it('uses each entry first class template', () => {
    const es = [
      entry('l-1', 0, 1, ['mh-c-1a'], [[mahasen.S.maths, 'mh-t-1a']]),
      entry('l-2', 0, 1, [C.c6a], [[S.maths, T.perera]]),
    ];
    const both = { ...mahasen.ctx, templates: [...mahasen.ctx.templates, ...ctx.templates], classes: [...mahasen.ctx.classes, ...ctx.classes], grades: [...mahasen.ctx.grades, ...ctx.grades], teachers: [...mahasen.ctx.teachers, ...ctx.teachers], subjects: [...mahasen.ctx.subjects, ...ctx.subjects] };
    const a = teacherLoad('mh-t-1a', es, both);
    const b = teacherLoad(T.perera, es, both);
    expect(a).toEqual({ entries: 1, minutes: 60, timedMinutes: 60 });
    expect(b.entries).toBe(1);
    expect(b.minutes).toBeGreaterThan(0);
    expect(b.timedMinutes).toBe(0);
  });
});

describe('teacherLoad joined blocks', () => {
  it('counts timed minutes the same whichever class is listed first', () => {
    const periodsPlan = [{ kind: 'subject' as const, subjectId: mahasen.S.maths, perWeek: 5 }];
    const c = { ...mahasen.ctx, classes: mahasen.ctx.classes.map((k) => (k.id === 'mh-c-1b' ? { ...k, planOverride: periodsPlan } : k)) };
    const lessons: Array<[string, string]> = [[mahasen.S.maths, 'mh-t-1a']];
    const ab = teacherLoad('mh-t-1a', [entry('l-1', 0, 1, ['mh-c-1a', 'mh-c-1b'], lessons)], c);
    const ba = teacherLoad('mh-t-1a', [entry('l-1', 0, 1, ['mh-c-1b', 'mh-c-1a'], lessons)], c);
    expect(ba.timedMinutes).toBe(ab.timedMinutes);
    expect(ab.timedMinutes).toBeGreaterThan(0);
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
    expect(ids(tie.available)).toEqual([T.perera, T.bandara]);
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

describe('classOptionsForTeacherSlot busy detail', () => {
  const busyOf = (teacherId: string, day: DayIndex, defaultPeriod: number, subjectId: string, classId: string, e: Entry[] = entries) =>
    classOptionsForTeacherSlot({ ctx, entries: e, teacherId, day, defaultPeriod, subjectId }).find((o) => o.cls.id === classId)?.busy;

  it('free classes carry no busy detail', () => {
    expect(busyOf(T.perera, 2, 5, S.maths, C.c6a)).toBeUndefined();
  });

  it('class taken by another lesson: class kind with its subject and teacher', () => {
    const other = entry('x', 2, 5, [C.c6c], [[S.science, T.gunasekara]]);
    expect(busyOf(T.perera, 2, 5, S.maths, C.c6c, [...entries, other])).toEqual({
      kind: 'class',
      entryId: 'x',
      classIds: [C.c6c],
      subjectId: S.science,
      teacherId: T.gunasekara,
    });
  });

  it('class taken by a group block: class kind with the group key and no single teacher', () => {
    expect(busyOf(T.perera, 2, 5, S.maths, C.c6b)).toEqual({
      kind: 'class',
      entryId: 'e-aesthetic-6b-2-5',
      classIds: [C.c6b],
      subjectId: S.music,
      teacherId: null,
      groupKey: 'aesthetic',
    });
  });

  it('teacher teaching elsewhere: teacher kind with the class and subject they teach', () => {
    expect(busyOf(T.perera, 2, 4, S.maths, C.c6c)).toEqual({
      kind: 'teacher',
      entryId: 'e-6a-2-4',
      classIds: [C.c6a],
      subjectId: S.maths,
      teacherId: T.perera,
    });
  });

  it("class taken by the teacher's own lesson reads as the teacher teaching it", () => {
    expect(busyOf(T.perera, 2, 4, S.maths, C.c6a)).toMatchObject({ kind: 'teacher', entryId: 'e-6a-2-4', classIds: [C.c6a] });
  });
});

describe('preferredTeacherFor', () => {
  const sin = (id: string, day: DayIndex, period: number, teacherId: string | null, classIds: string[] = [C.c6a]) => entry(id, day, period, classIds, [[S.sinhala, teacherId]]);

  it('returns null when nobody teaches the subject to the class', () => {
    expect(preferredTeacherFor({ entries, classId: C.c6a, subjectId: S.sinhala })).toBeNull();
    expect(preferredTeacherFor({ entries: [sin('a', 0, 1, null)], classId: C.c6a, subjectId: S.sinhala })).toBeNull();
  });

  it('picks the teacher with the most periods of that subject in that class', () => {
    const e = [sin('a', 0, 1, T.rSilva), sin('b', 1, 1, T.ranasinghe), sin('c', 2, 1, T.ranasinghe), sin('d', 3, 1, T.rSilva, [C.c6b]), sin('e', 4, 1, T.rSilva, [C.c6b])];
    expect(preferredTeacherFor({ entries: e, classId: C.c6a, subjectId: S.sinhala })).toBe(T.ranasinghe);
  });

  it('counts combined lessons and group options for the class', () => {
    const e = [sin('a', 0, 1, T.rSilva), sin('b', 1, 1, T.ranasinghe, [C.c6a, C.c6b]), entry('g', 2, 1, [C.c6a], [[S.sinhala, T.ranasinghe], [S.tamil, T.rajan]], 'lang')];
    expect(preferredTeacherFor({ entries: e, classId: C.c6a, subjectId: S.sinhala })).toBe(T.ranasinghe);
  });

  it('excludes the entry being edited', () => {
    const e = [sin('a', 0, 1, T.rSilva), sin('b', 1, 1, T.ranasinghe), sin('c', 2, 1, T.ranasinghe)];
    expect(preferredTeacherFor({ entries: e, classId: C.c6a, subjectId: S.sinhala })).toBe(T.ranasinghe);
    expect(preferredTeacherFor({ entries: e, classId: C.c6a, subjectId: S.sinhala, excludeEntryId: 'b' })).toBe(T.rSilva);
  });

  it('breaks ties by the earliest lesson in the week', () => {
    const e = [sin('a', 3, 1, T.rSilva), sin('b', 1, 2, T.ranasinghe)];
    expect(preferredTeacherFor({ entries: e, classId: C.c6a, subjectId: S.sinhala })).toBe(T.ranasinghe);
  });
});

describe('teacherClassOptions', () => {
  it('lists qualifying classes with the subject item, preferred first', () => {
    const r = teacherClassOptions({ ctx, entries, teacherId: T.perera, subjectId: S.maths });
    expect(r.map((o) => o.cls.id)).toEqual([C.c6b, C.c6a, C.c6c]);
    expect(r.map((o) => o.preferred)).toEqual([true, false, false]);
    expect(r[0]!.item).toMatchObject({ kind: 'subject', subjectId: S.maths });
    expect(r[0]!.template.id).toBe(r[0]!.cls.templateId);
  });

  it('matches group options and falls back by grade then name without a preference', () => {
    const r = teacherClassOptions({ ctx, entries: [], teacherId: T.ananda, subjectId: S.buddhism });
    expect(r.map((o) => o.cls.id)).toEqual([C.c6a, C.c6b, C.c6c, C.c12a]);
    expect(r[0]!.item).toMatchObject({ kind: 'group', key: 'religion' });
    expect(r.some((o) => o.preferred)).toBe(false);
  });

  it('is empty for an unknown teacher', () => {
    expect(teacherClassOptions({ ctx, entries, teacherId: 'nope', subjectId: S.maths })).toEqual([]);
  });
});
