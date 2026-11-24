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
    expect(remapEntries(before, after, [entry('a', 0, 1), entry('b', 0, 3)], ['c1'])).toEqual({ moves: [], blocked: [] });
  });

  it('renumbers entries when a period is inserted before them', () => {
    const after = tpl([p('07:05', '07:45'), ...before.rows]);
    expect(remapEntries(before, after, [entry('a', 0, 2), entry('b', 0, 3)], ['c1'])).toEqual({
      moves: [
        { entryId: 'a', period: 3 },
        { entryId: 'b', period: 4 },
      ],
      blocked: [],
    });
  });

  it('blocks entries whose period became an activity', () => {
    const after = tpl([act('07:45', '08:25'), p('08:25', '09:05'), p('09:05', '09:45')]);
    const e = entry('a', 0, 1);
    expect(remapEntries(before, after, [e, entry('b', 0, 2)], ['c1'])).toEqual({ moves: [{ entryId: 'b', period: 1 }], blocked: [e] });
  });

  it('no moves when nothing shifted', () => {
    const after = tpl([p('07:45', '08:20'), p('08:25', '09:05'), p('09:05', '09:45')]);
    expect(remapEntries(before, after, [entry('a', 0, 1), entry('b', 3, 3)], ['c1'])).toEqual({ moves: [], blocked: [] });
  });

  it('ignores entries of other classes and entries already outside the old template', () => {
    const after = tpl([act('07:45', '08:25'), p('08:25', '09:05')]);
    expect(remapEntries(before, after, [entry('x', 0, 2, ['c2']), entry('o', 0, 9)], ['c1'])).toEqual({ moves: [], blocked: [] });
  });

  it('uses the entry day for per-day templates', () => {
    const pd = (fri: TemplateRow[]): PeriodTemplate => ({ ...before, mode: 'perDay', days: { 0: before.rows, 1: before.rows, 2: before.rows, 3: before.rows, 4: fri } });
    const b = pd(before.rows);
    const a = pd([act('07:45', '08:25'), p('08:25', '09:05'), p('09:05', '09:45')]);
    expect(remapEntries(b, a, [entry('mon', 0, 1), entry('fri', 4, 2)], ['c1'])).toEqual({ moves: [{ entryId: 'fri', period: 1 }], blocked: [] });
  });
});
