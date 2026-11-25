// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { mahasen } from '../fixtures';
import { rng } from './rng';
import { classSlots } from './slots';

const cls = (l: string) => `mh-c-1${l}`;

describe('classSlots', () => {
  it('marks first period after activities', () => {
    const slots = classSlots(mahasen.ctx, cls('a'));
    const monday = slots.filter((s) => s.day === 0);
    expect(monday).toHaveLength(7);
    expect(monday[0]).toMatchObject({ classId: cls('a'), period: 1, start: 8 * 60 + 15, end: 9 * 60 + 15, minutes: 60, first: true });
    expect(monday.filter((s) => s.first)).toHaveLength(1);
  });

  it('nextPeriod stops at interval', () => {
    const monday = classSlots(mahasen.ctx, cls('a')).filter((s) => s.day === 0);
    expect(monday[0]!.nextPeriod).toBe(2);
    expect(monday[3]!.nextPeriod).toBeNull();
    expect(monday[6]!.nextPeriod).toBeNull();
  });

  it('is empty for unknown class and ordered by day then period', () => {
    expect(classSlots(mahasen.ctx, 'nope')).toEqual([]);
    const slots = classSlots(mahasen.ctx, cls('b'));
    expect(slots.map((s) => s.day * 100 + s.period)).toEqual([...slots.map((s) => s.day * 100 + s.period)].sort((a, b) => a - b));
  });
});

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = rng(42);
    const b = rng(42);
    const xs = [a(), a(), a()];
    expect(xs).toEqual([b(), b(), b()]);
    expect(rng(43)()).not.toBe(xs[0]);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
});
