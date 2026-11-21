// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx, entries, TPL } from '@sathiya/core/fixtures';
import type { TemplateRow } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { newlyOrphaned, toPerDay, validateTemplate } from './model';

const p = (start: string, end: string): TemplateRow => ({ type: 'period', start, end });

describe('validateTemplate', () => {
  it('accepts ascending non-overlapping rows', () => {
    expect(validateTemplate({ name: 'A', mode: 'same', rows: [p('08:00', '08:40'), p('08:40', '09:20')] })).toEqual([]);
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

describe('toPerDay', () => {
  it('copies rows to all five days independently', () => {
    const rows = [p('08:00', '08:40')];
    const days = toPerDay(rows);
    expect(Object.keys(days)).toEqual(['0', '1', '2', '3', '4']);
    expect(days[4]).toEqual(rows);
    expect(days[4]).not.toBe(days[0]);
  });
});

describe('newlyOrphaned', () => {
  it('counts entries orphaned by a shrink', () => {
    const t = ctx.templates.find((x) => x.id === TPL.shortFriday)!;
    const fri = t.days![4].slice(0, -1);
    const shrunk = { ...t, days: { ...t.days!, 4: fri } };
    expect(newlyOrphaned(entries, ctx, shrunk)).toBe(1);
  });

  it('is zero when nothing shrinks', () => {
    const t = ctx.templates.find((x) => x.id === TPL.default)!;
    expect(newlyOrphaned(entries, ctx, t)).toBe(0);
  });
});
