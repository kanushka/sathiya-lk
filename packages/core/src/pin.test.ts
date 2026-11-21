// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, ctx, entries6B, entry, S, T } from './fixtures';
import { pinProgress, pinSlots, suggestPins } from './pin';
import type { Entry } from './types';

const target = { ctx, classId: C.c6a, subjectId: S.sinhala, teacherId: T.ranasinghe };
const cellAt = (slots: ReturnType<typeof pinSlots>, day: number, period: number) => slots.find((s) => s.day === day && s.period === period)?.cell;

describe('pinSlots', () => {
  it('covers every period of the class template', () => {
    expect(pinSlots({ ...target, entries: [] })).toHaveLength(40);
    expect(pinSlots({ ...target, classId: C.c6c, entries: [] })).toHaveLength(39);
  });

  it('marks own matching lessons pinned, other class lessons taken', () => {
    const mine = entry('m', 0, 2, [C.c6a], [[S.sinhala, T.ranasinghe]]);
    const other = entry('o', 0, 3, [C.c6a], [[S.sinhala, T.rSilva]]);
    const slots = pinSlots({ ...target, entries: [mine, other] });
    expect(cellAt(slots, 0, 2)).toEqual({ kind: 'pinned', entry: mine });
    expect(cellAt(slots, 0, 3)).toEqual({ kind: 'taken', entry: other });
  });

  it('treats a group or multi-class lesson of the same subject and teacher as taken', () => {
    const joined = entry('j', 1, 1, [C.c6a, C.c6b], [[S.sinhala, T.ranasinghe]]);
    expect(cellAt(pinSlots({ ...target, entries: [joined] }), 1, 1)).toEqual({ kind: 'taken', entry: joined });
  });

  it('marks slots where the teacher teaches elsewhere busy with the detail', () => {
    const elsewhere = entry('x', 2, 4, [C.c6b], [[S.sinhala, T.ranasinghe]]);
    expect(cellAt(pinSlots({ ...target, entries: [elsewhere] }), 2, 4)).toEqual({
      kind: 'busy',
      busy: { kind: 'teacher', entryId: 'x', classIds: [C.c6b], subjectId: S.sinhala, teacherId: T.ranasinghe },
    });
  });

  it('reports free slots with day load, limit and whether the subject is already on that day', () => {
    const es: Entry[] = [
      entry('a', 3, 1, [C.c6a], [[S.sinhala, T.rSilva]]),
      ...[1, 2, 3, 4, 5, 6, 7].map((p) => entry(`l${p}`, 4, p, [C.c12a], [[S.sinhala, T.ranasinghe]])),
    ];
    const slots = pinSlots({ ...target, entries: es });
    expect(cellAt(slots, 0, 1)).toEqual({ kind: 'free', load: 0, max: 7, limit: false, subjectThatDay: false });
    expect(cellAt(slots, 3, 2)).toEqual({ kind: 'free', load: 0, max: 7, limit: false, subjectThatDay: true });
    expect(cellAt(slots, 4, 8)).toEqual({ kind: 'free', load: 7, max: 7, limit: true, subjectThatDay: false });
  });
});

describe('suggestPins', () => {
  it('spreads picks one per day before doubling up, earliest free period first', () => {
    expect(suggestPins({ ...target, entries: [], count: 3 })).toEqual([
      { day: 0, period: 1 },
      { day: 1, period: 1 },
      { day: 2, period: 1 },
    ]);
    expect(suggestPins({ ...target, entries: [], count: 6 }).map((s) => s.day)).toEqual([0, 1, 2, 3, 4, 0]);
  });

  it('puts days that already have the subject last and skips busy, taken and at-limit slots', () => {
    const es: Entry[] = [
      entry('mon', 0, 1, [C.c6a], [[S.sinhala, T.ranasinghe]]),
      entry('tue', 1, 1, [C.c6a], [[S.maths, T.bandara]]),
      entry('busy', 1, 2, [C.c6b], [[S.sinhala, T.ranasinghe]]),
      ...[1, 2, 3, 4, 5, 6, 7].map((p) => entry(`l${p}`, 2, p, [C.c12a], [[S.sinhala, T.ranasinghe]])),
    ];
    expect(suggestPins({ ...target, entries: es, count: 4 })).toEqual([
      { day: 1, period: 3 },
      { day: 3, period: 1 },
      { day: 4, period: 1 },
      { day: 0, period: 2 },
    ]);
  });

  it('stops at the teacher daily limit while suggesting', () => {
    const tight = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.ranasinghe ? { ...t, maxPerDay: 1 } : t)) };
    const picks = suggestPins({ ...target, ctx: tight, entries: [], count: 8 });
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((p) => p.day)).size).toBe(5);
  });

  it('treats a clock-time overlap in another template as busy and never suggests it', () => {
    const primary = entry('p', 0, 5, [C.c1a], [[S.sinhala, T.ranasinghe]]);
    const slots = pinSlots({ ...target, entries: [primary] });
    expect(cellAt(slots, 0, 5)).toEqual({ kind: 'busy', busy: expect.objectContaining({ kind: 'teacher', entryId: 'p', classIds: [C.c1a] }) });
    expect(cellAt(slots, 0, 6)?.kind).toBe('free');
    const mondayOnly = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.ranasinghe ? { ...t, maxPerDay: 10 } : t)) };
    const busyElse = [1, 2, 3, 4].flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry(`b${d}${p}`, d as 1 | 2 | 3 | 4, p, [C.c12a], [[S.sinhala, T.ranasinghe]])));
    const picks = suggestPins({ ...target, ctx: mondayOnly, entries: [primary, ...busyElse], count: 8 });
    expect(picks.map((p) => p.period)).toEqual([1, 2, 3, 4, 6, 7, 8]);
  });

  it('only suggests periods that exist on a Short Friday', () => {
    const roomy = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.ranasinghe ? { ...t, maxPerDay: 10 } : t)) };
    const busyElse = [0, 1, 2, 3].flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry(`b${d}${p}`, d as 0 | 1 | 2 | 3, p, [C.c12a], [[S.sinhala, T.ranasinghe]])));
    const picks = suggestPins({ ...target, ctx: roomy, classId: C.c6c, entries: busyElse, count: 8 });
    expect(picks).toEqual([1, 2, 3, 4, 5, 6, 7].map((period) => ({ day: 4, period })));
  });

  it('returns nothing for a zero count', () => {
    expect(suggestPins({ ...target, entries: [], count: 0 })).toEqual([]);
  });
});

describe('pinProgress', () => {
  it('counts placed lessons of the subject against the plan, with left and over', () => {
    expect(pinProgress({ ctx, entries: entries6B, classId: C.c6b, subjectId: S.sinhala })).toEqual({ placed: 5, needed: 5, left: 0, over: 0 });
    const extra = [...entries6B, entry('x1', 2, 4, [C.c6b], [[S.sinhala, T.ranasinghe]]), entry('x2', 3, 7, [C.c6b], [[S.sinhala, T.rSilva]])];
    expect(pinProgress({ ctx, entries: extra, classId: C.c6b, subjectId: S.sinhala })).toEqual({ placed: 7, needed: 5, left: 0, over: 2 });
    expect(pinProgress({ ctx, entries: [], classId: C.c6b, subjectId: S.science })).toEqual({ placed: 0, needed: 5, left: 5, over: 0 });
  });
});
