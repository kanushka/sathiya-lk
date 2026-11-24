// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { defaultTemplate } from '../fixtures';
import type { SnapshotCell, TeacherSnapshot } from '../publish';
import type { DayIndex, Leave, Relief, Teacher } from '../types';
import { candidatesFor, suggestRelief, validateRelief, type ReliefCtx } from './suggest';
import { reliefSlots } from './window';

const rows = defaultTemplate.rows;
const DAY: DayIndex = 1;

const teacher = (id: string, o: Partial<Teacher> = {}): Teacher => ({ id, staffId: id, name: id, isPrimary: false, subjectIds: [], grades: [6, 7], maxPerDay: 8, ...o });
const cell = (entryId: string, start: string, end: string, o: Partial<SnapshotCell> = {}): SnapshotCell => ({
  day: DAY, period: 1, start, end, title: '', sub: '', color: '', isGroup: false, entryId, classIds: ['c6a'], subjectId: 'maths', ...o,
});
const snap = (teacherId: string, cells: SnapshotCell[]): TeacherSnapshot => ({
  teacherId, name: teacherId, staffId: teacherId, rows: { 0: rows, 1: rows, 2: rows, 3: rows, 4: rows } as Record<DayIndex, typeof rows>, cells, yearLabel: '2026', schoolName: { nameEn: 'S' },
});
const slot = (entryId: string, absent: string, start: string, end: string, o: Partial<Relief> = {}): Relief => ({
  entryId, absentTeacherId: absent, day: DAY, period: 1, start, end, classIds: ['c6a'], subjectId: 'maths', reliefTeacherId: null, ...o,
});

const gradeOfClass = new Map([['c6a', 6], ['c6b', 6], ['c1a', 1]]);
const absSnap = snap('abs', [cell('e1', '07:45', '08:30'), cell('e2', '08:30', '09:10')]);
const absLeave: Leave = { teacherId: 'abs', type: 'full', entryIds: ['e1', 'e2'] };

function mkCtx(teachers: Teacher[], snaps: TeacherSnapshot[] = [], o: Partial<ReliefCtx> = {}): ReliefCtx {
  return { teachers: [teacher('abs'), ...teachers], snaps: new Map([absSnap, ...snaps].map((s) => [s.teacherId, s])), gradeOfClass, day: DAY, leaves: [absLeave], counts: {}, ...o };
}
const ids = (s: Relief, ctx: ReliefCtx, others: Relief[] = []) => candidatesFor(s, others, ctx).map((c) => c.teacherId);
const s1 = slot('e1', 'abs', '07:45', '08:30');

describe('candidatesFor ranking', () => {
  it('(1) teaches the class first', () => {
    const ctx = mkCtx([teacher('A'), teacher('B')], [snap('B', [cell('x', '07:45', '08:30', { day: 3, subjectId: 'art' })])], { counts: { B: 5 } });
    const c = candidatesFor(s1, [], ctx);
    expect(c.map((x) => x.teacherId)).toEqual(['B', 'A']);
    expect(c[0]).toMatchObject({ teachesClass: true, teachesSubject: false, yearCount: 5 });
  });

  it('(1) teaches the subject first', () => {
    const ctx = mkCtx([teacher('A'), teacher('B')], [snap('B', [cell('x', '07:45', '08:30', { day: 3, classIds: ['c6b'] })])], { counts: { B: 5 } });
    const c = candidatesFor(s1, [], ctx);
    expect(c.map((x) => x.teacherId)).toEqual(['B', 'A']);
    expect(c[0]).toMatchObject({ teachesClass: false, teachesSubject: true });
  });

  it('empty subjectId never counts as teaching the subject', () => {
    const ctx = mkCtx([teacher('A'), teacher('B')], [snap('B', [cell('x', '07:45', '08:30', { day: 3, classIds: ['c6b'], subjectId: '' })])], { counts: { B: 5 } });
    expect(ids({ ...s1, subjectId: '' }, ctx)).toEqual(['A', 'B']);
  });

  it('(2) fewest reliefs this year', () => {
    const ctx = mkCtx([teacher('A'), teacher('B')], [], { counts: { A: 3, B: 1 } });
    expect(ids(s1, ctx)).toEqual(['B', 'A']);
  });

  it('(2) year count includes in-run picks', () => {
    const ctx = mkCtx([teacher('A'), teacher('B')], [], { counts: { B: 1 } });
    const other = slot('o', 'abs2', '12:50', '13:30', { reliefTeacherId: 'A', classIds: ['c6b'] });
    const c = candidatesFor(s1, [other, { ...other, entryId: 'o2', start: '12:10', end: '12:50' }], ctx);
    expect(c.map((x) => x.teacherId)).toEqual(['B', 'A']);
    expect(c[1]).toMatchObject({ yearCount: 2, todayCount: 2 });
  });

  it('(3) fewest periods today', () => {
    const ctx = mkCtx([teacher('A'), teacher('B')], [
      snap('A', [cell('a1', '09:50', '10:30', { classIds: ['c1a'], subjectId: 'x' }), cell('a2', '10:50', '11:30', { classIds: ['c1a'], subjectId: 'x' })]),
      snap('B', [cell('b1', '09:50', '10:30', { classIds: ['c1a'], subjectId: 'x' })]),
    ]);
    expect(ids(s1, ctx)).toEqual(['B', 'A']);
  });

  it('(4) no lessons today last', () => {
    const ctx = mkCtx([teacher('A'), teacher('B')], [snap('B', [cell('b1', '09:50', '10:30', { classIds: ['c1a'], subjectId: 'x' })])], { counts: { B: 1 } });
    const other = slot('o', 'abs2', '12:50', '13:30', { reliefTeacherId: 'A', classIds: ['c6b'], subjectId: 'y' });
    const c = candidatesFor(s1, [other], ctx);
    expect(c.map((x) => x.teacherId)).toEqual(['B', 'A']);
    expect(c[1]).toMatchObject({ noLessonsToday: true, todayCount: 1, yearCount: 1 });
    expect(c[0]).toMatchObject({ noLessonsToday: false, todayCount: 1, yearCount: 1 });
  });

  it('(5) name, falling back to nameSi', () => {
    const ctx = mkCtx([teacher('t1', { name: 'Bandara' }), teacher('t2', { name: 'Amal' }), teacher('t3', { name: '', nameSi: 'Aaa' })]);
    expect(ids(s1, ctx)).toEqual(['t3', 't2', 't1']);
  });
});

describe('candidatesFor eligibility', () => {
  it('never offers the absent teacher', () => {
    const ctx = mkCtx([teacher('A')], [], { leaves: [] });
    expect(ids(slot('z', 'abs', '12:50', '13:30'), ctx)).toEqual(['A']);
  });

  it('excludes primary teachers from grade 6', () => {
    const ctx = mkCtx([teacher('P', { isPrimary: true, grades: [1, 2, 3, 4, 5] }), teacher('A')]);
    expect(ids(s1, ctx)).toEqual(['A']);
  });

  it('requires every class grade and excludes unknown class grades', () => {
    const ctx = mkCtx([teacher('A', { grades: [6] }), teacher('B', { grades: [1, 6] })]);
    expect(ids({ ...s1, classIds: ['c6a', 'c1a'] }, ctx)).toEqual(['B']);
    expect(ids({ ...s1, classIds: ['ghost'] }, ctx)).toEqual([]);
  });

  it('excludes teacher on leave in window even if their lesson is unticked', () => {
    const ctx = mkCtx([teacher('L'), teacher('A')], [snap('L', [cell('l1', '08:30', '09:10', { classIds: ['c6b'] })])], {
      leaves: [absLeave, { teacherId: 'L', type: 'late', entryIds: [] }],
    });
    expect(ids(s1, ctx)).toEqual(['A']);
    expect(ids(slot('e9', 'abs', '09:50', '10:30'), ctx)).toContain('L');
  });

  it('excludes teachers busy at that time, by lesson or by relief', () => {
    const ctx = mkCtx([teacher('A'), teacher('B'), teacher('C')], [snap('A', [cell('a1', '08:00', '08:40', { classIds: ['c6b'] })])]);
    const other = slot('o', 'abs2', '08:20', '09:00', { reliefTeacherId: 'B', classIds: ['c6b'] });
    expect(ids(s1, ctx, [other])).toEqual(['C']);
  });

  it('treats touching edges as free', () => {
    const ctx = mkCtx([teacher('A')], [snap('A', [cell('a1', '08:30', '09:10', { classIds: ['c6b'] })])]);
    expect(ids(s1, ctx)).toEqual(['A']);
  });

  it('excludes over maxPerDay', () => {
    const two = [cell('a1', '09:50', '10:30', { classIds: ['c6b'] }), cell('a2', '10:50', '11:30', { classIds: ['c6b'] })];
    expect(ids(s1, mkCtx([teacher('A', { maxPerDay: 2 })], [snap('A', two)]))).toEqual([]);
    expect(ids(s1, mkCtx([teacher('A', { maxPerDay: 3 })], [snap('A', two)]))).toEqual(['A']);
    const other = slot('o', 'abs2', '12:50', '13:30', { reliefTeacherId: 'A', classIds: ['c6b'] });
    expect(ids(s1, mkCtx([teacher('A', { maxPerDay: 3 })], [snap('A', two)]), [other])).toEqual([]);
  });
});

describe('suggestRelief', () => {
  it('never double-books one candidate', () => {
    const abs2Snap = snap('abs2', [cell('f1', '07:45', '08:30', { classIds: ['c6b'] })]);
    const ctx = mkCtx([teacher('abs2'), teacher('F')], [abs2Snap], { leaves: [absLeave, { teacherId: 'abs2', type: 'full', entryIds: ['f1'] }] });
    const out = suggestRelief([slot('e1', 'abs', '07:45', '08:30'), slot('f1', 'abs2', '08:00', '08:40', { classIds: ['c6b'] })], ctx);
    expect(out.map((r) => r.reliefTeacherId)).toEqual(['F', null]);
  });

  it('spreads load using in-run counts', () => {
    const ctx = mkCtx([teacher('F1'), teacher('F2')]);
    const out = suggestRelief(reliefSlots([absLeave], ctx.snaps, DAY), ctx);
    expect(out.map((r) => [r.entryId, r.reliefTeacherId])).toEqual([['e1', 'F1'], ['e2', 'F2']]);
  });

  it('keeps manual picks, fills in start order, returns input order', () => {
    const ctx = mkCtx([teacher('F1'), teacher('F2'), teacher('F3')]);
    const late = slot('e2', 'abs', '08:30', '09:10');
    const early = slot('e1', 'abs', '07:45', '08:30');
    const manual = slot('e3', 'abs', '09:10', '09:50', { reliefTeacherId: 'F1' });
    const out = suggestRelief([late, early, manual], ctx);
    expect(out.map((r) => [r.entryId, r.reliefTeacherId])).toEqual([['e2', 'F3'], ['e1', 'F2'], ['e3', 'F1']]);
  });
});

describe('validateRelief', () => {
  const doc = (reliefs: Relief[], leaves: Leave[] = [absLeave]) => ({ leaves, reliefs });
  const r1 = (who: string | null) => slot('e1', 'abs', '07:45', '08:30', { reliefTeacherId: who });

  it('returns [] for a suggested doc', () => {
    const ctx = mkCtx([teacher('F1'), teacher('F2')]);
    const reliefs = suggestRelief(reliefSlots([absLeave], ctx.snaps, DAY), ctx);
    expect(reliefs.every((r) => r.reliefTeacherId)).toBe(true);
    expect(validateRelief(doc(reliefs), ctx)).toEqual([]);
  });

  it('allows uncovered slots', () => {
    expect(validateRelief(doc([r1(null)]), mkCtx([]))).toEqual([]);
  });

  it('rejects relief by a teacher on leave', () => {
    const leaves = [absLeave, { teacherId: 'L', type: 'late' as const, entryIds: [] }];
    const ctx = mkCtx([teacher('L')], [snap('L', [cell('l1', '12:50', '13:30', { classIds: ['c6b'] })])]);
    expect(validateRelief(doc([r1('L')], leaves), ctx)).toEqual([{ code: 'on-leave', entryId: 'e1', teacherId: 'L' }]);
  });

  it('rejects the absent teacher relieving their own lesson', () => {
    expect(validateRelief(doc([r1('abs')]), mkCtx([]))).toEqual([{ code: 'on-leave', entryId: 'e1', teacherId: 'abs' }]);
  });

  it('busy', () => {
    const ctx = mkCtx([teacher('A')], [snap('A', [cell('a1', '08:00', '08:40', { classIds: ['c6b'] })])]);
    expect(validateRelief(doc([r1('A')]), ctx)).toEqual([{ code: 'busy', entryId: 'e1', teacherId: 'A' }]);
  });

  it('over-limit', () => {
    const ctx = mkCtx([teacher('A', { maxPerDay: 1 })]);
    const reliefs = [r1('A'), slot('e2', 'abs', '08:30', '09:10', { reliefTeacherId: 'A' })];
    expect(validateRelief(doc(reliefs), ctx)).toEqual([
      { code: 'over-limit', entryId: 'e1', teacherId: 'A' },
      { code: 'over-limit', entryId: 'e2', teacherId: 'A' },
    ]);
  });

  it('wrong-grade', () => {
    const ctx = mkCtx([teacher('P', { isPrimary: true, grades: [1, 2] })]);
    expect(validateRelief(doc([r1('P')]), ctx)).toEqual([{ code: 'wrong-grade', entryId: 'e1', teacherId: 'P' }]);
  });

  it('double-booked', () => {
    const abs2Snap = snap('abs2', [cell('f1', '08:00', '08:40', { classIds: ['c6b'] })]);
    const leaves = [absLeave, { teacherId: 'abs2', type: 'full' as const, entryIds: ['f1'] }];
    const ctx = mkCtx([teacher('abs2'), teacher('A')], [abs2Snap]);
    const reliefs = [r1('A'), slot('f1', 'abs2', '08:00', '08:40', { reliefTeacherId: 'A', classIds: ['c6b'] })];
    expect(validateRelief(doc(reliefs, leaves), ctx)).toEqual([
      { code: 'double-booked', entryId: 'e1', teacherId: 'A' },
      { code: 'double-booked', entryId: 'f1', teacherId: 'A' },
    ]);
  });

  it('unknown-teacher', () => {
    expect(validateRelief(doc([r1('ghost')]), mkCtx([]))).toEqual([{ code: 'unknown-teacher', entryId: 'e1', teacherId: 'ghost' }]);
  });

  it('not-on-leave-lesson: relief for a lesson not on leave', () => {
    const leaves = [{ ...absLeave, entryIds: ['e2'] }];
    expect(validateRelief(doc([r1(null)], leaves), mkCtx([]))).toEqual([{ code: 'not-on-leave-lesson', entryId: 'e1', teacherId: 'abs' }]);
    expect(validateRelief(doc([r1(null)], []), mkCtx([]))).toEqual([{ code: 'not-on-leave-lesson', entryId: 'e1', teacherId: 'abs' }]);
  });

  it('not-on-leave-lesson: leave lists a lesson the teacher does not have today', () => {
    const leaves = [{ ...absLeave, entryIds: ['e1', 'nope'] }];
    expect(validateRelief(doc([r1(null)], leaves), mkCtx([]))).toEqual([{ code: 'not-on-leave-lesson', entryId: 'nope', teacherId: 'abs' }]);
    const offDay = mkCtx([], [snap('abs', [cell('e1', '07:45', '08:30'), cell('e5', '07:45', '08:30', { day: 2 })])]);
    expect(validateRelief(doc([], [{ ...absLeave, entryIds: ['e5'] }]), offDay)).toEqual([{ code: 'not-on-leave-lesson', entryId: 'e5', teacherId: 'abs' }]);
  });
});
