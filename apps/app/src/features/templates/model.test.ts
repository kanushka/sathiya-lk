// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { TemplateRow } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { appendRow, dayStart, hasGaps, insertRow, moveRow, removeRow, rowMinutes, setDayStart, setRowMinutes, toPerDay, validateTemplate } from './model';

const p = (start: string, end: string): TemplateRow => ({ type: 'period', start, end });

describe('validateTemplate', () => {
  it('accepts ascending non-overlapping rows', () => {
    expect(validateTemplate({ name: 'A', mode: 'same', rows: [p('08:00', '08:40'), p('08:40', '09:20')] })).toEqual([]);
  });

  it('rejects a blank or malformed time as empty', () => {
    expect(validateTemplate({ name: 'A', mode: 'same', rows: [p('', '08:40')] })).toEqual([{ code: 'empty', day: null, row: 0 }]);
    expect(validateTemplate({ name: 'A', mode: 'same', rows: [p('08:00', '8:4')] })).toEqual([{ code: 'empty', day: null, row: 0 }]);
  });

  it('rejects overlapping rows', () => {
    const errs = validateTemplate({ name: 'A', mode: 'same', rows: [p('08:00', '08:40'), p('08:30', '09:10')] });
    expect(errs).toEqual([{ code: 'overlap', day: null, row: 1 }]);
  });

  it('rejects rows out of order', () => {
    const errs = validateTemplate({ name: 'A', mode: 'same', rows: [p('09:00', '09:40'), p('08:00', '08:40')] });
    expect(errs.map((e) => e.code)).toEqual(['overlap']);
  });

  it('rejects start not before end', () => {
    const errs = validateTemplate({ name: 'A', mode: 'same', rows: [p('08:40', '08:40')] });
    expect(errs).toEqual([{ code: 'order', day: null, row: 0 }]);
  });

  it('requires a name and at least one period', () => {
    const errs = validateTemplate({ name: ' ', mode: 'same', rows: [{ type: 'interval', start: '10:00', end: '10:20' }] });
    expect(errs.map((e) => e.code).sort()).toEqual(['name', 'noPeriod']);
  });

  it('validates every day in per-day mode', () => {
    const good = [p('08:00', '08:40')];
    const bad = [p('08:00', '08:40'), p('08:10', '08:50')];
    const errs = validateTemplate({ name: 'A', mode: 'perDay', rows: good, days: { 0: good, 1: good, 2: good, 3: bad, 4: good } });
    expect(errs).toEqual([{ code: 'overlap', day: 3, row: 1 }]);
  });
});

describe('activity rows', () => {
  const act = (nameEn?: string, nameSi?: string): TemplateRow => ({ type: 'activity', start: '07:30', end: '07:45', ...(nameEn !== undefined ? { nameEn } : {}), ...(nameSi !== undefined ? { nameSi } : {}) });

  it('needs an English or Sinhala name', () => {
    const rows = [act(), p('07:45', '08:25')];
    expect(validateTemplate({ name: 'A', mode: 'same', rows })).toEqual([{ code: 'activityName', day: null, row: 0 }]);
    expect(validateTemplate({ name: 'A', mode: 'same', rows: [act(' '), p('07:45', '08:25')] })).toHaveLength(1);
    expect(validateTemplate({ name: 'A', mode: 'same', rows: [act('Assembly'), p('07:45', '08:25')] })).toEqual([]);
    expect(validateTemplate({ name: 'A', mode: 'same', rows: [act(undefined, 'රැස්වීම'), p('07:45', '08:25')] })).toEqual([]);
  });

  it('appendRow adds a 20 minute activity after the last row', () => {
    expect(appendRow([p('08:00', '08:40')], 'activity')).toEqual([p('08:00', '08:40'), { type: 'activity', start: '08:40', end: '09:00' }]);
  });
});

describe('toPerDay', () => {
  it('copies rows to all five days independently', () => {
    const rows = [p('08:00', '08:40')];
    const days = toPerDay(rows);
    expect(Object.keys(days)).toEqual(['0', '1', '2', '3', '4']);
    expect(days[4]).toEqual(rows);
    expect(days[4]).not.toBe(days[0]);
  });
});

describe('duration editing', () => {
  const i = (start: string, end: string): TemplateRow => ({ type: 'interval', start, end });
  const day = [p('07:45', '08:30'), p('08:30', '09:10'), i('09:10', '09:30'), p('09:30', '10:10')];

  it('reads minutes and day start from times', () => {
    expect(day.map(rowMinutes)).toEqual([45, 40, 20, 40]);
    expect(dayStart(day)).toBe('07:45');
    expect(dayStart([])).toBe('07:45');
    expect(rowMinutes(p('', ''))).toBe(40);
  });

  it('changing minutes shifts every later row', () => {
    expect(setRowMinutes(day, 0, 50)).toEqual([p('07:45', '08:35'), p('08:35', '09:15'), i('09:15', '09:35'), p('09:35', '10:15')]);
  });

  it('clamps minutes to 5..240', () => {
    expect(rowMinutes(setRowMinutes(day, 1, 0)[1]!)).toBe(5);
    expect(rowMinutes(setRowMinutes(day, 1, 999)[1]!)).toBe(240);
  });

  it('moving the day start keeps every length', () => {
    expect(setDayStart(day, '07:30').map((r) => [r.start, r.end])).toEqual([['07:30', '08:15'], ['08:15', '08:55'], ['08:55', '09:15'], ['09:15', '09:55']]);
  });

  it('moves a row and recomputes times', () => {
    expect(moveRow(day, 2, 1)).toEqual([p('07:45', '08:30'), i('08:30', '08:50'), p('08:50', '09:30'), p('09:30', '10:10')]);
    expect(moveRow(day, 0, -1)).toEqual(day);
  });

  it('inserts a default-length row between rows', () => {
    expect(insertRow(day, 1, 'interval').slice(0, 3)).toEqual([p('07:45', '08:30'), i('08:30', '08:50'), p('08:50', '09:30')]);
  });

  it('removes a row and closes the gap', () => {
    expect(removeRow(day, 2)).toEqual([p('07:45', '08:30'), p('08:30', '09:10'), p('09:10', '09:50')]);
  });

  it('turns an empty gap into an interval on the next edit, keeping clock times', () => {
    const gappy = [p('07:45', '08:30'), p('08:40', '09:20')];
    expect(hasGaps(gappy)).toBe(true);
    expect(setDayStart(gappy, '07:45')).toEqual([p('07:45', '08:30'), i('08:30', '08:40'), p('08:40', '09:20')]);
    expect(hasGaps(day)).toBe(false);
  });
});
