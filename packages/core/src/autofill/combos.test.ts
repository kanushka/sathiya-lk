// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { combos } from './combos';
import type { Slot } from './slots';

function day(durations: number[], breaksAfter: number[] = [], from = 480): Slot[] {
  let t = from;
  return durations.map((minutes, i) => {
    const start = t;
    t += minutes + (breaksAfter.includes(i + 1) ? 10 : 0);
    return { classId: 'c', day: 0, period: i + 1, start, end: start + minutes, minutes, first: i === 0, nextPeriod: i + 1 < durations.length && !breaksAfter.includes(i + 1) ? i + 2 : null };
  });
}

const periods = (r: Slot[][]) => r.map((c) => c.map((s) => s.period));

describe('combos', () => {
  it('prefers 30+10 adjacent over 10+10+10+10', () => {
    const slots = day([10, 10, 30, 10, 10]);
    const r = combos(slots, 40);
    expect(periods(r)[0]).toEqual([2, 3]);
    expect(r.every((c) => c.reduce((a, s) => a + s.minutes, 0) === 40)).toBe(true);
  });

  it('returns empty when unbuildable', () => {
    expect(combos(day([30, 30]), 45)).toEqual([]);
    expect(combos(day([30, 30]), 0)).toEqual([]);
    expect(combos(day([30, 30]), -5)).toEqual([]);
  });

  it('respects limit', () => {
    const slots = day([10, 10, 10, 10, 10, 10, 10, 10]);
    expect(combos(slots, 30)).toHaveLength(20);
    expect(combos(slots, 30, 3)).toHaveLength(3);
  });

  it('returns only exact sums on a Mahasen Grade 1 day', () => {
    const slots = day([60, 15, 30, 10, 55, 10, 20], [4]);
    const r = combos(slots, 190);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.reduce((a, s) => a + s.minutes, 0) === 190)).toBe(true);
    expect(periods(r)).toEqual([
      [1, 2, 3, 5, 6, 7],
      [1, 2, 3, 4, 5, 7],
    ]);
  });

  it('orders deterministically regardless of input order', () => {
    const slots = day([10, 10, 10, 10, 20], [2]);
    const a = periods(combos(slots, 30));
    const b = periods(combos([...slots].reverse(), 30));
    expect(b).toEqual(a);
    expect(a[0]).toEqual([4, 5]);
  });
});

describe('combos performance', () => {
  it('stays fast on a 32-slot uneven template', () => {
    const slots = day(Array.from({ length: 32 }, (_, i) => 10 + (i % 2) * 5));
    const started = Date.now();
    const r = combos(slots, 200);
    expect(Date.now() - started).toBeLessThan(1000);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.reduce((a, s) => a + s.minutes, 0) === 200)).toBe(true);
  });
});
