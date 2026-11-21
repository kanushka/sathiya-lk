import { describe, expect, it } from 'vitest';
import { bestOverlapPeriod, overlaps, periodsFor, rowsFor, toMinutes, windowOf } from './time';
import type { PeriodTemplate, TemplateRow } from './types';

const r = (type: 'period' | 'interval', start: string, end: string): TemplateRow => ({ type, start, end });

const schoolDefault: PeriodTemplate = {
  id: 't1',
  name: 'School default',
  isDefault: true,
  mode: 'same',
  rows: [
    r('period', '07:45', '08:30'),
    r('period', '08:30', '09:10'),
    r('period', '09:10', '09:50'),
    r('period', '09:50', '10:30'),
    r('interval', '10:30', '10:50'),
    r('period', '10:50', '11:30'),
    r('period', '11:30', '12:10'),
    r('period', '12:10', '12:50'),
    r('period', '12:50', '13:30'),
  ],
};

const fridayRows = [r('period', '07:45', '08:25'), r('period', '08:25', '09:05')];
const perDay: PeriodTemplate = {
  ...schoolDefault,
  id: 't2',
  mode: 'perDay',
  days: {
    0: schoolDefault.rows,
    1: schoolDefault.rows,
    2: schoolDefault.rows,
    3: schoolDefault.rows,
    4: fridayRows,
  },
};

describe('toMinutes', () => {
  it('parses HH:MM', () => {
    expect(toMinutes('07:45')).toBe(465);
    expect(toMinutes('13:30')).toBe(810);
  });
  it('accepts H:MM', () => {
    expect(toMinutes('7:45')).toBe(465);
  });
});

describe('overlaps', () => {
  it('detects overlap', () => {
    expect(overlaps({ start: 550, end: 590 }, { start: 540, end: 580 })).toBe(true);
  });
  it('touching windows do not overlap', () => {
    expect(overlaps({ start: 0, end: 10 }, { start: 10, end: 20 })).toBe(false);
  });
});

describe('periodsFor', () => {
  it('numbers 8 periods skipping the interval', () => {
    const p = periodsFor(schoolDefault, 0);
    expect(p).toHaveLength(8);
    expect(p[4]).toEqual({ period: 5, start: '10:50', end: '11:30' });
  });
  it('perDay uses Friday rows on day 4', () => {
    expect(periodsFor(perDay, 4)).toHaveLength(2);
    expect(periodsFor(perDay, 0)).toHaveLength(8);
  });
});

describe('rowsFor', () => {
  it('same mode returns rows', () => {
    expect(rowsFor(schoolDefault, 3)).toBe(schoolDefault.rows);
  });
  it('perDay falls back to rows when day missing', () => {
    const t: PeriodTemplate = { ...perDay, days: undefined };
    expect(rowsFor(t, 4)).toBe(t.rows);
  });
});

describe('windowOf', () => {
  it('returns minute window', () => {
    expect(windowOf(schoolDefault, 0, 5)).toEqual({ start: 650, end: 690 });
  });
  it('returns null for missing period', () => {
    expect(windowOf(schoolDefault, 0, 9)).toBeNull();
    expect(windowOf(schoolDefault, 0, 0)).toBeNull();
  });
});

describe('bestOverlapPeriod', () => {
  const t: PeriodTemplate = { id: 't', name: 't', isDefault: true, mode: 'same', rows: [r('period', '07:45', '08:30'), r('period', '08:30', '09:10'), r('interval', '09:10', '09:30'), r('period', '09:30', '10:10')] };

  it('picks the period with the largest overlap, first on ties', () => {
    expect(bestOverlapPeriod(t, 0, { start: toMinutes('08:20'), end: toMinutes('09:00') })).toBe(2);
    expect(bestOverlapPeriod(t, 0, { start: toMinutes('08:10'), end: toMinutes('08:50') })).toBe(1);
    expect(bestOverlapPeriod(t, 0, { start: toMinutes('09:05'), end: toMinutes('09:40') })).toBe(3);
  });

  it('returns null without overlap', () => {
    expect(bestOverlapPeriod(t, 0, { start: toMinutes('09:10'), end: toMinutes('09:30') })).toBeNull();
  });
});
