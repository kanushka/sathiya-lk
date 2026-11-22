// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, ctx, entries, entries6B, entry, S, T } from './fixtures';
import { latestGroupSpec, matchesSpec, pinProgress, pinSlots, singleSpec, specDraft, suggestPins, teacherPinSlots, type PinSpec } from './pin';
import type { Entry } from './types';

const target = { ctx, spec: singleSpec(C.c6a, S.sinhala, T.ranasinghe) };
const cellAt = (slots: ReturnType<typeof pinSlots>, day: number, period: number) => slots.find((s) => s.day === day && s.period === period)?.cell;

describe('pinSlots', () => {
  it('covers every period of the class template', () => {
    expect(pinSlots({ ...target, entries: [] })).toHaveLength(40);
    expect(pinSlots({ ...target, spec: singleSpec(C.c6c, S.sinhala, T.ranasinghe), entries: [] })).toHaveLength(39);
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
      blockers: [{ kind: 'teacher', entryId: 'x', classIds: [C.c6b], subjectId: S.sinhala, teacherId: T.ranasinghe }],
    });
  });

  it('reports free slots with day load, limit and whether the subject is already on that day', () => {
    const es: Entry[] = [
      entry('a', 3, 1, [C.c6a], [[S.sinhala, T.rSilva]]),
      ...[1, 2, 3, 4, 5, 6, 7].map((p) => entry(`l${p}`, 4, p, [C.c12a], [[S.sinhala, T.ranasinghe]])),
    ];
    const slots = pinSlots({ ...target, entries: es });
    expect(cellAt(slots, 0, 1)).toEqual({ kind: 'free', load: 0, max: 7, limit: false, teacherId: T.ranasinghe, subjectThatDay: false });
    expect(cellAt(slots, 3, 2)).toEqual({ kind: 'free', load: 0, max: 7, limit: false, teacherId: T.ranasinghe, subjectThatDay: true });
    expect(cellAt(slots, 4, 8)).toEqual({ kind: 'free', load: 7, max: 7, limit: true, teacherId: T.ranasinghe, subjectThatDay: false });
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
    expect(cellAt(slots, 0, 5)).toEqual({ kind: 'busy', busy: expect.objectContaining({ kind: 'teacher', entryId: 'p', classIds: [C.c1a] }), blockers: [expect.objectContaining({ entryId: 'p' })] });
    expect(cellAt(slots, 0, 6)?.kind).toBe('free');
    const mondayOnly = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.ranasinghe ? { ...t, maxPerDay: 10 } : t)) };
    const busyElse = [1, 2, 3, 4].flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry(`b${d}${p}`, d as 1 | 2 | 3 | 4, p, [C.c12a], [[S.sinhala, T.ranasinghe]])));
    const picks = suggestPins({ ...target, ctx: mondayOnly, entries: [primary, ...busyElse], count: 8 });
    expect(picks.map((p) => p.period)).toEqual([1, 2, 3, 4, 6, 7, 8]);
  });

  it('only suggests periods that exist on a Short Friday', () => {
    const roomy = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.ranasinghe ? { ...t, maxPerDay: 10 } : t)) };
    const busyElse = [0, 1, 2, 3].flatMap((d) => [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry(`b${d}${p}`, d as 0 | 1 | 2 | 3, p, [C.c12a], [[S.sinhala, T.ranasinghe]])));
    const picks = suggestPins({ ...target, ctx: roomy, spec: singleSpec(C.c6c, S.sinhala, T.ranasinghe), entries: busyElse, count: 8 });
    expect(picks).toEqual([1, 2, 3, 4, 5, 6, 7].map((period) => ({ day: 4, period })));
  });

  it('returns nothing for a zero count', () => {
    expect(suggestPins({ ...target, entries: [], count: 0 })).toEqual([]);
  });
});

describe('pinProgress', () => {
  it('counts placed lessons of the subject against the plan, with left and over', () => {
    expect(pinProgress({ ctx, entries: entries6B, spec: singleSpec(C.c6b, S.sinhala, T.ranasinghe) })).toEqual({ placed: 5, needed: 5, left: 0, over: 0 });
    const extra = [...entries6B, entry('x1', 2, 4, [C.c6b], [[S.sinhala, T.ranasinghe]]), entry('x2', 3, 7, [C.c6b], [[S.sinhala, T.rSilva]])];
    expect(pinProgress({ ctx, entries: extra, spec: singleSpec(C.c6b, S.sinhala, T.ranasinghe) })).toEqual({ placed: 7, needed: 5, left: 0, over: 2 });
    expect(pinProgress({ ctx, entries: [], spec: singleSpec(C.c6b, S.science, T.gunasekara) })).toEqual({ placed: 0, needed: 5, left: 5, over: 0 });
  });
});

const groupSpec: PinSpec = {
  classIds: [C.c6a, C.c6b],
  lessons: [
    { subjectId: S.buddhism, teacherId: T.ananda },
    { subjectId: S.catholicism, teacherId: T.mSilva },
    { subjectId: S.islam, teacherId: T.rizan },
  ],
  groupKey: 'religion',
};
const gArgs = { ctx, spec: groupSpec };

describe('matchesSpec', () => {
  it('compares classes and lessons order-insensitively and respects groupKey', () => {
    const e = entry('g', 0, 1, [C.c6b, C.c6a], [[S.islam, T.rizan], [S.buddhism, T.ananda], [S.catholicism, T.mSilva]], 'religion');
    expect(matchesSpec(e, groupSpec)).toBe(true);
    expect(matchesSpec({ ...e, groupKey: undefined }, groupSpec)).toBe(false);
    expect(matchesSpec(entry('g2', 0, 1, [C.c6a], [[S.islam, T.rizan], [S.buddhism, T.ananda], [S.catholicism, T.mSilva]], 'religion'), groupSpec)).toBe(false);
  });

  it('equals the single-lesson match for a single spec', () => {
    const sp = singleSpec(C.c6a, S.sinhala, T.ranasinghe);
    expect(matchesSpec(entry('a', 0, 1, [C.c6a], [[S.sinhala, T.ranasinghe]]), sp)).toBe(true);
    expect(matchesSpec(entry('b', 0, 1, [C.c6a], [[S.sinhala, T.rSilva]]), sp)).toBe(false);
    expect(matchesSpec(entry('c', 0, 1, [C.c6a, C.c6b], [[S.sinhala, T.ranasinghe]]), sp)).toBe(false);
  });
});

describe('pinSlots for a group spec', () => {
  it('is busy with a single teacher blocker when only Rizan teaches elsewhere', () => {
    const e = entry('r', 0, 2, [C.c12a], [[S.islam, T.rizan]]);
    expect(cellAt(pinSlots({ ...gArgs, entries: [e] }), 0, 2)).toEqual({
      kind: 'busy',
      busy: expect.objectContaining({ kind: 'teacher', entryId: 'r', teacherId: T.rizan }),
      blockers: [expect.objectContaining({ kind: 'teacher', entryId: 'r', teacherId: T.rizan })],
    });
  });

  it('lists teacher and class blockers, deduped and teacher first', () => {
    const r = entry('r', 0, 2, [C.c12a], [[S.islam, T.rizan]]);
    const b = entry('b', 0, 2, [C.c6b], [[S.maths, T.perera]]);
    const both = entry('both', 0, 3, [C.c6b], [[S.islam, T.rizan]]);
    const slots = pinSlots({ ...gArgs, entries: [r, b, both] });
    const cell = cellAt(slots, 0, 2);
    expect(cell).toMatchObject({ kind: 'busy' });
    if (cell?.kind !== 'busy') throw new Error('expected busy');
    expect(cell.blockers.map((x) => [x.kind, x.entryId])).toEqual([['teacher', 'r'], ['class', 'b']]);
    expect(cell.busy).toEqual(cell.blockers[0]);
    const dup = cellAt(slots, 0, 3);
    if (dup?.kind !== 'busy') throw new Error('expected busy');
    expect(dup.blockers).toHaveLength(1);
    expect(dup.blockers[0]).toMatchObject({ kind: 'teacher', teacherId: T.rizan });
  });

  it('is free when nothing clashes and pinned or taken for religion entries', () => {
    const match = entry('m', 1, 2, [C.c6a, C.c6b], [[S.buddhism, T.ananda], [S.catholicism, T.mSilva], [S.islam, T.rizan]], 'religion');
    const diff = entry('d', 1, 3, [C.c6a, C.c6b], [[S.buddhism, T.ananda], [S.catholicism, T.mSilva], [S.islam, T.perera]], 'religion');
    const slots = pinSlots({ ...gArgs, entries: [match, diff] });
    expect(cellAt(slots, 0, 1)?.kind).toBe('free');
    expect(cellAt(slots, 1, 2)).toEqual({ kind: 'pinned', entry: match });
    expect(cellAt(slots, 1, 3)).toEqual({ kind: 'taken', entry: diff });
  });

  it('reports the tightest teacher on free cells', () => {
    const es = [1, 2, 3, 4, 5].map((p) => entry(`l${p}`, 2, p, [C.c12a], [[S.catholicism, T.mSilva]]));
    const c = cellAt(pinSlots({ ...gArgs, entries: es }), 2, 6);
    expect(c).toEqual({ kind: 'free', load: 5, max: 6, limit: false, teacherId: T.mSilva, subjectThatDay: false });
    const full = [...es, entry('l6', 2, 6, [C.c12a], [[S.catholicism, T.mSilva]])];
    expect(cellAt(pinSlots({ ...gArgs, entries: full }), 2, 7)).toMatchObject({ kind: 'free', load: 6, max: 6, limit: true, teacherId: T.mSilva });
  });

  it('returns [] for an unknown teacher or class', () => {
    expect(pinSlots({ ctx, entries: [], spec: singleSpec(C.c6a, S.sinhala, 'nope') })).toEqual([]);
    expect(pinSlots({ ctx, entries: [], spec: singleSpec('nope', S.sinhala, T.ranasinghe) })).toEqual([]);
  });
});

describe('suggestPins for a group spec', () => {
  it('skips days where any spec teacher is at the limit', () => {
    const tight = { ...ctx, teachers: ctx.teachers.map((t) => (t.id === T.mSilva ? { ...t, maxPerDay: 1 } : t)) };
    const picks = suggestPins({ ctx: tight, entries: [], spec: groupSpec, count: 8 });
    expect(picks).toHaveLength(5);
    expect(new Set(picks.map((p) => p.day)).size).toBe(5);
  });
});

describe('pinProgress for a group spec', () => {
  it('counts the group row', () => {
    expect(pinProgress({ ...gArgs, entries: entries6B })).toEqual({ placed: 3, needed: 3, left: 0, over: 0 });
    expect(pinProgress({ ...gArgs, entries: [] })).toEqual({ placed: 0, needed: 3, left: 3, over: 0 });
  });
});

describe('teacherPinSlots', () => {
  const spec1a = singleSpec(C.c1a, S.maths, T.wickramasinghe);
  const base = { ctx, spec: spec1a, teacherId: T.wickramasinghe };
  const at = (slots: ReturnType<typeof teacherPinSlots>, day: number, row: number) => slots.find((s) => s.day === day && s.row === row)!;

  it('covers every default-template row and shows taken entries on their row', () => {
    const slots = teacherPinSlots({ ...base, entries });
    expect(slots).toHaveLength(40);
    const r = at(slots, 0, 1);
    expect(r.period).toBeNull();
    expect(r.cell).toMatchObject({ kind: 'taken', entry: { id: 'e-1a-0-1' } });
  });

  it('maps a free row to the first primary period overlapping it most', () => {
    const slots = teacherPinSlots({ ...base, entries: [] });
    expect(at(slots, 1, 5)).toMatchObject({ period: 5, cell: { kind: 'free' } });
    expect(at(slots, 1, 6)).toMatchObject({ cell: { kind: 'none' }, period: null });
    expect(at(slots, 1, 8).cell.kind).toBe('none');
  });

  it('uses the next free period when the first mapped one is taken by another teacher', () => {
    const es = [entry('o', 1, 5, [C.c1a], [[S.maths, T.kumari]])];
    const slots = teacherPinSlots({ ...base, entries: es });
    expect(at(slots, 1, 5)).toMatchObject({ period: 6, cell: { kind: 'free' } });
  });

  it('marks a row busy with a class blocker when the class period holds another lesson', () => {
    const o = entry('o', 1, 2, [C.c1a], [[S.science, T.kumari]]);
    const slots = teacherPinSlots({ ...base, entries: [o] });
    const cell = at(slots, 1, 2);
    expect(cell.period).toBe(2);
    expect(cell.cell).toMatchObject({ kind: 'busy', blockers: [expect.objectContaining({ entryId: 'o', kind: 'class' })] });
  });

  it('shows a matching entry as pinned on its row', () => {
    const pin = entry('p', 1, 2, [C.c1a], [[S.maths, T.wickramasinghe]]);
    expect(at(teacherPinSlots({ ...base, entries: [pin] }), 1, 2)).toEqual({ day: 1, row: 2, period: 2, cell: { kind: 'pinned', entry: pin } });
  });

  it('marks a row busy when a clock-time clash is only visible across templates', () => {
    const t1 = entry('t1', 0, 1, [C.c6a], [[S.maths, T.wickramasinghe]]);
    const slots = teacherPinSlots({ ...base, entries: [t1] });
    expect(at(slots, 0, 1).cell).toMatchObject({ kind: 'taken', entry: { id: 't1' } });
    expect(at(slots, 0, 2)).toMatchObject({ period: 2, cell: { kind: 'busy', blockers: [expect.objectContaining({ entryId: 't1' })] } });
  });

  it('suggests only the chosen period of a free teacher row', () => {
    const rows = teacherPinSlots({ ...base, entries: [] });
    const chosen = new Set(rows.filter((r) => r.cell.kind === 'free').map((r) => `${r.day}-${r.period}`));
    const all = suggestPins({ ctx, entries: [], spec: spec1a, count: 40 });
    expect(all.some((p) => !chosen.has(`${p.day}-${p.period}`))).toBe(true);
    const picks = suggestPins({ ctx, entries: [], spec: spec1a, count: 40, teacherId: T.wickramasinghe });
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => chosen.has(`${p.day}-${p.period}`))).toBe(true);
  });

  it('returns [] when the base class is unknown', () => {
    expect(teacherPinSlots({ ...base, spec: singleSpec('nope', S.maths, T.wickramasinghe), entries })).toEqual([]);
  });
});

describe('latestGroupSpec', () => {
  it('uses the latest group entry of the class with the class first', () => {
    const early = entry('a', 0, 2, [C.c6a], [[S.buddhism, T.ananda]], 'religion');
    const late = entry('b', 2, 3, [C.c6b, C.c6a], [[S.buddhism, T.ananda], [S.islam, T.rizan]], 'religion');
    expect(latestGroupSpec({ ctx, entries: [early, late], classId: C.c6a, groupKey: 'religion' })).toEqual({
      classIds: [C.c6a, C.c6b],
      lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }, { subjectId: S.islam, teacherId: T.rizan }],
      groupKey: 'religion',
    });
  });

  it('is null with no entry or a lesson without teacher', () => {
    expect(latestGroupSpec({ ctx, entries: [], classId: C.c6a, groupKey: 'religion' })).toBeNull();
    const noTeacher = entry('n', 0, 1, [C.c6a], [[S.buddhism, null]], 'religion');
    expect(latestGroupSpec({ ctx, entries: [noTeacher], classId: C.c6a, groupKey: 'religion' })).toBeNull();
  });
});

describe('specDraft', () => {
  it('places a single spec without a groupKey', () => {
    const d = specDraft(singleSpec(C.c6b, S.maths, T.perera), 2, 4);
    expect(d).toEqual({ day: 2, period: 4, classIds: [C.c6b], lessons: [{ subjectId: S.maths, teacherId: T.perera }] });
    expect('groupKey' in d).toBe(false);
  });

  it('keeps the groupKey of a group spec', () => {
    const spec: PinSpec = { classIds: [C.c6a, C.c6b], lessons: [{ subjectId: S.buddhism, teacherId: T.ananda }], groupKey: 'religion' };
    expect(specDraft(spec, 0, 1)).toEqual({ day: 0, period: 1, classIds: [C.c6a, C.c6b], lessons: spec.lessons, groupKey: 'religion' });
  });
});
