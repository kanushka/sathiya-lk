// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { remapEntries } from './remap';
import type { Entry, PeriodTemplate, TemplateRow } from './types';

const p = (start: string, end: string): TemplateRow => ({ type: 'period', start, end });
const act = (start: string, end: string): TemplateRow => ({ type: 'activity', start, end, nameEn: 'Assembly' });
const tpl = (rows: TemplateRow[]): PeriodTemplate => ({ id: 't', name: 'T', isDefault: false, mode: 'same', rows });
const entry = (id: string, day: Entry['day'], period: number, classIds = ['c1']): Entry => ({ id, day, period, classIds, lessons: [], teacherIds: [] });

const before = tpl([p('07:45', '08:25'), p('08:25', '09:05'), p('09:05', '09:45')]);

describe('remapEntries', () => {
  it('keeps clock time when an activity row is inserted before periods', () => {
    const after = tpl([act('07:15', '07:45'), ...before.rows]);
    expect(remapEntries(before, after, [entry('a', 0, 1), entry('b', 0, 3)], ['c1'])).toEqual({ moves: [], blocked: [], orphaned: [] });
  });

  it('renumbers entries when a period is inserted before them', () => {
    const after = tpl([p('07:05', '07:45'), ...before.rows]);
    expect(remapEntries(before, after, [entry('a', 0, 2), entry('b', 0, 3)], ['c1'])).toEqual({
      moves: [
        { entryId: 'a', period: 3 },
        { entryId: 'b', period: 4 },
      ],
      blocked: [],
      orphaned: [],
    });
  });

  it('blocks entries whose period became an activity', () => {
    const after = tpl([act('07:45', '08:25'), p('08:25', '09:05'), p('09:05', '09:45')]);
    const e = entry('a', 0, 1);
    expect(remapEntries(before, after, [e, entry('b', 0, 2)], ['c1'])).toEqual({ moves: [{ entryId: 'b', period: 1 }], blocked: [e], orphaned: [] });
  });

  it('no moves when nothing shifted', () => {
    const after = tpl([p('07:45', '08:20'), p('08:25', '09:05'), p('09:05', '09:45')]);
    expect(remapEntries(before, after, [entry('a', 0, 1), entry('b', 3, 3)], ['c1'])).toEqual({ moves: [], blocked: [], orphaned: [] });
  });

  it('ignores entries of other classes and entries already outside the old template', () => {
    const after = tpl([act('07:45', '08:25'), p('08:25', '09:05')]);
    expect(remapEntries(before, after, [entry('x', 0, 2, ['c2']), entry('o', 0, 9)], ['c1'])).toEqual({ moves: [], blocked: [], orphaned: [] });
  });

  it('uses the entry day for per-day templates', () => {
    const pd = (fri: TemplateRow[]): PeriodTemplate => ({ ...before, mode: 'perDay', days: { 0: before.rows, 1: before.rows, 2: before.rows, 3: before.rows, 4: fri } });
    const b = pd(before.rows);
    const a = pd([act('07:45', '08:25'), p('08:25', '09:05'), p('09:05', '09:45')]);
    expect(remapEntries(b, a, [entry('mon', 0, 1), entry('fri', 4, 2)], ['c1'])).toEqual({ moves: [{ entryId: 'fri', period: 1 }], blocked: [], orphaned: [] });
  });

  it('keeps an entry on its row when the period is retimed', () => {
    const after = tpl([p('07:50', '08:25'), p('08:25', '09:05'), p('09:05', '09:45')]);
    expect(remapEntries(before, after, [entry('a', 0, 1)], ['c1'])).toEqual({ moves: [], blocked: [], orphaned: [] });
  });

  it('moves nothing when the whole day shifts by five minutes', () => {
    const after = tpl([p('07:50', '08:30'), p('08:30', '09:10'), p('09:10', '09:50')]);
    expect(remapEntries(before, after, [entry('a', 0, 1), entry('b', 0, 2), entry('c', 0, 3)], ['c1'])).toEqual({ moves: [], blocked: [], orphaned: [] });
  });

  it('orphans entries of trailing periods that are removed without blocking them', () => {
    const after = tpl(before.rows.slice(0, 2));
    const e = entry('c', 0, 3);
    expect(remapEntries(before, after, [entry('a', 0, 1), e], ['c1'])).toEqual({ moves: [], blocked: [], orphaned: [e] });
  });

  it('blocks entries when a used middle period is removed', () => {
    const after = tpl([before.rows[0]!, before.rows[2]!]);
    const e = entry('b', 0, 2);
    expect(remapEntries(before, after, [entry('a', 0, 1), e], ['c1'])).toEqual({ moves: [], blocked: [e], orphaned: [] });
  });

  it('blocks both entries when two used periods are removed from the middle', () => {
    const four = tpl([...before.rows, p('09:45', '10:25'), p('10:25', '11:05')]);
    const after = tpl([four.rows[0]!, four.rows[3]!, four.rows[4]!]);
    const b = entry('b', 0, 2);
    const c = entry('c', 0, 3);
    expect(remapEntries(four, after, [b, c], ['c1'])).toEqual({ moves: [], blocked: [b, c], orphaned: [] });
  });

  it('blocks an entry whose period became an interval', () => {
    const after = tpl([{ type: 'interval', start: '07:45', end: '08:25' }, p('08:25', '09:05'), p('09:05', '09:45')]);
    const e = entry('a', 0, 1);
    expect(remapEntries(before, after, [e], ['c1'])).toEqual({ moves: [], blocked: [e], orphaned: [] });
  });

  it('blocks when two periods merge into one', () => {
    const after = tpl([p('07:45', '09:05'), p('09:05', '09:45')]);
    const a = entry('a', 0, 1);
    const b = entry('b', 0, 2);
    const other = entry('c', 0, 2, ['c2']);
    expect(remapEntries(before, after, [a, b, entry('d', 1, 2), other], ['c1', 'c2'])).toEqual({
      moves: [{ entryId: 'd', period: 1 }, { entryId: 'c', period: 1 }],
      blocked: [a, b],
      orphaned: [],
    });
  });

  it('blocks merged periods that share a teacher across classes', () => {
    const after = tpl([p('07:45', '09:05'), p('09:05', '09:45')]);
    const a = { ...entry('a', 0, 1, ['c1']), teacherIds: ['t1'] };
    const b = { ...entry('b', 0, 2, ['c2']), teacherIds: ['t1'] };
    expect(remapEntries(before, after, [a, b], ['c1', 'c2']).blocked).toEqual([a, b]);
  });
});
