// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { buildSnapshots, type Relief, type ReliefDay, type TeacherSnapshot, type Year } from '@sathiya/core';
import { C, S, T, ctx as baseCtx, entries } from '@sathiya/core/fixtures';
import { describe, expect, it } from 'vitest';
import { overlayRelief } from './reliefOverlay';

const year: Year = { id: 'y-2026', label: '2026', status: 'published' };
const ctx = { ...baseCtx, school: { ...baseCtx.school, activeYearId: year.id } };
const claims = (tid: string) => ({ schools: { [ctx.school.id]: { r: 't' as const, t: tid } } });
const snapOf = (tid: string): TeacherSnapshot => buildSnapshots(ctx, entries, year).teachers.find((t) => t.teacherId === tid)!;
const wed0920 = () => new Date('2026-11-25T03:50:00Z');

const perera = snapOf(T.perera);
const lesson = perera.cells.find((c) => c.day === 2 && c.period === 3)!;
const freeSlot = (() => {
  const busy = new Set(perera.cells.filter((c) => c.day === 2).map((c) => c.start));
  const periods = perera.rows[2].filter((r) => r.type === 'period');
  const i = periods.findIndex((r) => !busy.has(r.start));
  return { n: i + 1, start: periods[i]!.start, end: periods[i]!.end };
})();
const [fh, fm] = freeSlot.start.split(':').map(Number) as [number, number];
const atFree = () => new Date(Date.UTC(2026, 10, 25, fh! - 5, fm! - 30 + 10));
const relief = (over: Partial<Relief> = {}): Relief => ({
  entryId: 'e-x', absentTeacherId: T.bandara, day: 2, period: freeSlot.n, start: freeSlot.start, end: freeSlot.end, classIds: [C.c6a], subjectId: S.maths, reliefTeacherId: T.perera, ...over,
});
const doc = (over: Partial<ReliefDay> = {}): ReliefDay => ({
  date: '2026-11-25', day: 2, leaves: [], reliefs: [], names: { [T.bandara]: { en: 'Mr Bandara', si: 'බණ්ඩාර' }, [T.kumara]: { en: 'Mr Kumara' } },
  labels: { [`e-x|${T.bandara}`]: { cls: '6A', sub: 'Maths', subSi: 'ගණිතය' }, [`e-x|${T.kumara}`]: { cls: '9Z', sub: 'Art' } }, updatedAt: 1, updatedBy: 'u', ...over,
});

describe('overlayRelief', () => {
  it('returns the snapshot untouched without a doc', () => {
    expect(overlayRelief(perera, null, T.perera, 'en')).toBe(perera);
  });

  it('adds a relief cell on today only', () => {
    const out = overlayRelief(perera, doc({ reliefs: [relief(), relief({ entryId: 'e-y', reliefTeacherId: T.kumara })] }), T.perera, 'en');
    const added = out.cells.filter((c) => c.relief);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ day: 2, title: '6A', sub: 'Maths', start: freeSlot.start, end: freeSlot.end, period: freeSlot.n, relief: { forTeacher: 'Mr Bandara' } });
    expect(out.cells.filter((c) => c.day !== 2)).toEqual(perera.cells.filter((c) => c.day !== 2));
  });

  it('uses Sinhala names and subject when lang is si, and falls back without labels', () => {
    const si = overlayRelief(perera, doc({ reliefs: [relief()] }), T.perera, 'si').cells.find((c) => c.relief)!;
    expect(si.subSi).toBe('ගණිතය');
    expect(si.relief?.forTeacher).toBe('බණ්ඩාර');
    const bare = overlayRelief(perera, { ...doc({ reliefs: [relief()] }), labels: undefined }, T.perera, 'en').cells.find((c) => c.relief)!;
    expect([bare.title, bare.sub]).toEqual(['', '']);
  });

  it('marks own leave lessons with the relief teacher or none', () => {
    const lv = { teacherId: T.perera, type: 'full' as const, entryIds: [lesson.entryId!] };
    const covered = overlayRelief(perera, doc({ leaves: [lv], reliefs: [relief({ entryId: lesson.entryId!, absentTeacherId: T.perera, reliefTeacherId: T.kumara })] }), T.perera, 'en');
    expect(covered.cells.find((c) => c.entryId === lesson.entryId)?.onLeave).toEqual({ reliefBy: 'Mr Kumara' });
    const open = overlayRelief(perera, doc({ leaves: [lv], reliefs: [relief({ entryId: lesson.entryId!, absentTeacherId: T.perera, reliefTeacherId: null })] }), T.perera, 'en');
    expect(open.cells.find((c) => c.entryId === lesson.entryId)?.onLeave).toEqual({ reliefBy: null });
  });
});
