// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, entry, S, T } from '../fixtures';
import type { DayIndex, Entry } from '../types';
import { compareScore, score } from './score';
import { readyCtx } from './testCtx';

const e = (id: string, day: DayIndex, period: number, subjectId: string, teacherId: string, classId: string = C.c6a): Entry =>
  entry(id, day, period, [classId], [[subjectId, teacherId]]);

describe('score', () => {
  it('samePattern is 1 with no repeated pairs', () => {
    const r = score(readyCtx, [e('a', 0, 2, S.maths, T.bandara)], 0);
    expect(r.soft.samePattern).toBe(1);
    expect(r.tuple).toEqual([0, 0, 0, 0, 0]);
  });

  it('samePattern measures the share of subjects at one start time', () => {
    const entries = [
      e('m0', 0, 2, S.maths, T.bandara),
      e('m1', 1, 2, S.maths, T.bandara),
      e('s0', 0, 3, S.sinhala, T.ranasinghe),
      e('s1', 1, 4, S.sinhala, T.ranasinghe),
    ];
    const r = score(readyCtx, entries, 0);
    expect(r.soft.samePattern).toBe(0.5);
    expect(r.tuple[1]).toBe(1);
  });

  it('counts group blocks as pairs', () => {
    const g = (id: string, day: DayIndex, period: number): Entry =>
      entry(id, day, period, [C.c6a, C.c6b], [[S.buddhism, T.ananda], [S.islam, T.rizan]], 'religion');
    expect(score(readyCtx, [g('a', 0, 2), g('b', 1, 2), g('c', 2, 3)], 0).soft.samePattern).toBe(0);
  });

  it('counts doubles that are not adjacent as split', () => {
    const adjacent = score(readyCtx, [e('a', 0, 2, S.maths, T.bandara), e('b', 0, 3, S.maths, T.bandara)], 0);
    const apart = score(readyCtx, [e('a', 0, 2, S.maths, T.bandara), e('b', 0, 4, S.maths, T.bandara)], 0);
    const overInterval = score(readyCtx, [e('a', 0, 4, S.maths, T.bandara), e('b', 0, 5, S.maths, T.bandara)], 0);
    expect(adjacent.soft.splitDoubles).toBe(0);
    expect(apart.soft.splitDoubles).toBe(1);
    expect(overInterval.soft.splitDoubles).toBe(1);
  });

  it('counts stacked low-frequency period items only', () => {
    const geo = score(readyCtx, [e('a', 0, 2, S.geography, T.herath), e('b', 0, 3, S.geography, T.herath)], 0);
    const maths = score(readyCtx, [e('a', 0, 2, S.maths, T.bandara), e('b', 0, 3, S.maths, T.bandara)], 0);
    expect(geo.soft.stacked).toBe(1);
    expect(maths.soft.stacked).toBe(0);
  });

  it('reports teachers below minPerWeek', () => {
    const ctx = { ...readyCtx, teachers: readyCtx.teachers.map((t) => (t.id === T.bandara ? { ...t, minPerWeek: 5 } : t)) };
    const r = score(ctx, [e('a', 0, 2, S.maths, T.bandara), e('b', 1, 2, S.maths, T.bandara)], 0);
    expect(r.soft.minPerWeekShort).toEqual([{ teacherId: T.bandara, short: 3 }]);
    expect(r.tuple[3]).toBe(3);
  });

  it('prefers fewer unplaced over a better pattern', () => {
    const goodPattern = score(readyCtx, [e('a', 0, 2, S.maths, T.bandara), e('b', 1, 2, S.maths, T.bandara)], 10);
    const worsePattern = score(readyCtx, [e('a', 0, 2, S.maths, T.bandara), e('b', 1, 3, S.maths, T.bandara)], 5);
    expect(goodPattern.tuple[1]).toBeLessThan(worsePattern.tuple[1]);
    expect(compareScore(worsePattern.tuple, goodPattern.tuple)).toBeLessThan(0);
  });
});

describe('compareScore', () => {
  it('orders lexicographically', () => {
    expect(compareScore([0, 9, 9, 9, 9], [1, 0, 0, 0, 0])).toBeLessThan(0);
    expect(compareScore([1, 2, 0, 0, 0], [1, 1, 5, 5, 5])).toBeGreaterThan(0);
    expect(compareScore([1, 1, 1, 1, 1], [1, 1, 1, 1, 1])).toBe(0);
    expect(compareScore([1, 1, 1, 1, 2], [1, 1, 1, 1, 1])).toBeGreaterThan(0);
  });
});
