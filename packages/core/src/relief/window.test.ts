// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { defaultTemplate, primaryTemplate } from '../fixtures';
import type { SnapshotCell, TeacherSnapshot } from '../publish';
import { toMinutes } from '../time';
import type { DayIndex, Leave } from '../types';
import { leaveWindow, lessonsForLeave, reliefSlots } from './window';

const rows = defaultTemplate.rows;
const m = (t: string) => toMinutes(t);

const cell = (period: number, start: string, end: string, entryId: string | undefined, classIds: string[] = ['c1']): SnapshotCell => ({
  day: 1, period, start, end, title: '6B', sub: 'Maths', color: '', isGroup: false, ...(entryId ? { entryId } : {}), classIds, subjectId: 'maths',
});
const snap = (cells: SnapshotCell[], teacherId = 't1'): TeacherSnapshot => ({
  teacherId, name: teacherId, staffId: teacherId, rows: { 0: rows, 1: rows, 2: rows, 3: rows, 4: rows } as Record<DayIndex, typeof rows>, cells, yearLabel: '2026', schoolName: { nameEn: 'S' },
});
const cells = [cell(1, '07:45', '08:30', 'a'), cell(2, '08:30', '09:10', 'b'), cell(4, '09:50', '10:30', 'c'), cell(5, '10:50', '11:30', 'd'), cell(8, '12:50', '13:30', 'e')];

describe('leaveWindow', () => {
  it.each([
    ['full', m('07:45'), m('13:30')],
    ['morning', m('07:45'), m('10:50')],
    ['afternoon', m('10:30'), m('13:30')],
    ['late', m('07:45'), m('08:45')],
    ['early', m('12:30'), m('13:30')],
  ] as const)('%s', (type, start, end) => {
    expect(leaveWindow(type, rows)).toEqual({ start, end });
  });

  it('splits at the midpoint with no interval row', () => {
    const periods = rows.filter((r) => r.type === 'period');
    expect(leaveWindow('morning', periods)).toEqual({ start: m('07:45'), end: 637 });
    expect(leaveWindow('afternoon', periods)).toEqual({ start: 637, end: m('13:30') });
  });

  it('ignores activity rows and picks the longest interval, first on ties', () => {
    const custom = [
      { type: 'activity' as const, start: '07:30', end: '07:45' },
      { type: 'period' as const, start: '07:45', end: '08:30' },
      { type: 'interval' as const, start: '08:30', end: '08:40' },
      { type: 'period' as const, start: '08:40', end: '09:20' },
      { type: 'interval' as const, start: '09:20', end: '09:40' },
      { type: 'interval' as const, start: '09:40', end: '10:00' },
      { type: 'period' as const, start: '10:00', end: '10:40' },
    ];
    expect(leaveWindow('full', custom)).toEqual({ start: m('07:45'), end: m('10:40') });
    expect(leaveWindow('morning', custom)).toEqual({ start: m('07:45'), end: m('09:40') });
  });
});

describe('lessonsForLeave', () => {
  const s = snap(cells);
  const ids = (t: Parameters<typeof lessonsForLeave>[2]) => lessonsForLeave(s, 1, t).map((c) => c.entryId);
  it('morning picks lessons ending before the interval', () => expect(ids('morning')).toEqual(['a', 'b', 'c']));
  it('afternoon picks lessons from the interval end', () => expect(ids('afternoon')).toEqual(['d', 'e']));
  it('late picks the first hour', () => expect(ids('late')).toEqual(['a', 'b']));
  it('early picks the last hour', () => expect(ids('early')).toEqual(['e']));
  it('full picks all', () => expect(ids('full')).toEqual(['a', 'b', 'c', 'd', 'e']));
  it('ignores other days', () => expect(lessonsForLeave(s, 2, 'full')).toEqual([]));

  it('lessons across templates use their own times', () => {
    const primary = primaryTemplate.rows.find((r) => r.type === 'period')!;
    const mixed = snap([cell(1, primary.start, primary.end, 'p'), cell(5, '10:50', '11:30', 'd')]);
    expect(lessonsForLeave(mixed, 1, 'afternoon').map((c) => c.entryId)).toEqual(['d']);
    expect(lessonsForLeave(mixed, 1, 'late').map((c) => c.entryId)).toEqual(['p']);
  });

  it('primary-template cells follow interval edges', () => {
    const mixed = snap([cell(1, '07:45', '08:20', 'p1'), cell(6, '10:40', '11:05', 'p6'), cell(7, '11:05', '11:30', 'p7')]);
    const ids = (t: Parameters<typeof lessonsForLeave>[2]) => lessonsForLeave(mixed, 1, t).map((c) => c.entryId);
    expect(ids('morning')).toEqual(['p1']);
    expect(ids('afternoon')).toEqual(['p7']);
    expect(ids('full')).toEqual(['p1', 'p6', 'p7']);
  });

  it('without an interval row splits at the midpoint', () => {
    const periods = rows.filter((r) => r.type === 'period');
    const s2 = { ...snap([cell(3, '09:10', '09:50', 'm1'), cell(5, '10:30', '11:00', 'straddle'), cell(6, '10:50', '11:30', 'x'), cell(7, '10:37', '11:30', 'y'), cell(8, '10:50', '11:30', 'z')]), rows: { 0: periods, 1: periods, 2: periods, 3: periods, 4: periods } };
    expect(lessonsForLeave(s2, 1, 'morning').map((c) => c.entryId)).toEqual(['m1']);
    expect(lessonsForLeave(s2, 1, 'afternoon').map((c) => c.entryId)).toEqual(['x', 'y', 'z']);
  });
});

describe('reliefSlots', () => {
  it('keys by entryId, copies fields, sorts by start then class, skips cells without entryId', () => {
    const a = snap([cell(2, '08:30', '09:10', 'b', ['c2']), cell(1, '07:45', '08:30', undefined), cell(2, '08:30', '09:10', 'z', ['c1'])], 't1');
    const b = snap([cell(1, '07:45', '08:30', 'x', ['c9'])], 't2');
    const leaves: Leave[] = [{ teacherId: 't1', type: 'full', entryIds: ['b', 'z'] }, { teacherId: 't2', type: 'late', entryIds: ['x'] }, { teacherId: 'ghost', type: 'full', entryIds: ['q'] }];
    const slots = reliefSlots(leaves, new Map([['t1', a], ['t2', b]]), 1);
    expect(slots.map((r) => r.entryId)).toEqual(['x', 'z', 'b']);
    expect(slots[0]).toEqual({ entryId: 'x', absentTeacherId: 't2', day: 1, period: 1, start: '07:45', end: '08:30', classIds: ['c9'], subjectId: 'maths', reliefTeacherId: null });
  });

  it('follows ticks: a ticked lesson outside the window gets a slot, an unticked in-window one does not', () => {
    const s = snap(cells, 't1');
    const late: Leave[] = [{ teacherId: 't1', type: 'late', entryIds: ['b', 'e'] }];
    expect(reliefSlots(late, new Map([['t1', s]]), 1).map((r) => r.entryId)).toEqual(['b', 'e']);
  });
});
