// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { withTeacherIds } from '../clash';
import { entry, mahasen, S, secondary } from '../fixtures';
import { DAYS, templateOf } from '../lookup';
import { readiness } from '../readiness';
import { windowOf } from '../time';
import type { Entry, EntryDraft, PlanItem, SchoolContext, TemplateRow } from '../types';
import { allocate, type Allocation } from './allocate';
import { checkHard } from './check';
import { place } from './place';
import { rng } from './rng';
import { score } from './score';
import { classSlots } from './slots';

const run = (ctx: SchoolContext, kept: Entry[] = [], seed = 1, allocation?: Allocation[], stepBudget = 2000) => {
  const classIds = ctx.classes.map((c) => c.id);
  const alloc = allocation ?? allocate({ ctx, entries: kept, classIds, random: rng(seed) }).allocation;
  return { alloc, ...place({ ctx, kept, allocation: alloc, classIds, random: rng(seed), stepBudget }) };
};
const asEntries = (drafts: EntryDraft[]): Entry[] => drafts.map((d, i) => ({ ...withTeacherIds(d), id: `d${i}` }));
const startOf = (ctx: SchoolContext, d: EntryDraft): number | undefined => {
  const cls = ctx.classes.find((c) => c.id === d.classIds[0])!;
  return windowOf(templateOf(ctx, cls)!, d.day, d.period)?.start;
};

describe('place', () => {
  it('places the mahasen fixture fully', () => {
    const { ctx, S: MS } = mahasen;
    const { drafts, unplaced } = run(ctx);
    expect(unplaced).toEqual([]);
    expect(checkHard(ctx, [], drafts)).toEqual([]);
    for (const cls of ctx.classes) {
      const mother = drafts.filter((d) => d.classIds.includes(cls.id) && d.lessons[0]?.subjectId === MS.motherTongue);
      for (const day of DAYS) expect(mother.some((d) => d.day === day && startOf(ctx, d) === 8 * 60 + 15)).toBe(true);
    }
  });

  it('meets per-day minutes exactly on every day for mahasen', () => {
    const { ctx, S: MS } = mahasen;
    const { drafts } = run(ctx);
    for (const cls of ctx.classes) {
      const slots = classSlots(ctx, cls.id);
      for (const day of DAYS) {
        const english = drafts
          .filter((d) => d.classIds.includes(cls.id) && d.day === day && d.lessons[0]?.subjectId === MS.english)
          .reduce((n, d) => n + slots.find((s) => s.day === d.day && s.period === d.period)!.minutes, 0);
        expect(english).toBe(10);
      }
    }
  });

  it('builds a ready secondary fixture', () => {
    expect(readiness(secondary([6, 7, 8, 9, 10, 11], 4), []).blocking).toEqual([]);
  });

  it('keeps same period across the week on the secondary fixture', () => {
    const ctx = secondary([6, 7, 8], 4);
    const { drafts, unplaced } = run(ctx);
    expect(checkHard(ctx, [], drafts)).toEqual([]);
    const missing = unplaced.reduce((n, u) => n + u.missing, 0);
    expect(score(ctx, asEntries(drafts), missing).soft.samePattern).toBeGreaterThanOrEqual(0.8);
  });

  it('never puts a group on the first slot', () => {
    const ctx = secondary([6, 7], 4);
    const { drafts } = run(ctx);
    const groups = drafts.filter((d) => d.groupKey !== undefined);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((d) => d.period !== 1)).toBe(true);
  });

  it('places groups as one block for all block classes', () => {
    const ctx = secondary([6], 4);
    const { drafts, unplaced } = run(ctx);
    expect(unplaced).toEqual([]);
    const ids = ctx.classes.map((c) => c.id).sort();
    for (const key of ['religion', 'aesthetic']) {
      const block = drafts.filter((d) => d.groupKey === key);
      expect(block).toHaveLength(3);
      for (const d of block) {
        expect([...d.classIds].sort()).toEqual(ids);
        expect(d.lessons).toHaveLength(3);
        expect(d.lessons.every((l) => l.teacherId !== null)).toBe(true);
      }
    }
  });

  it('doubles are adjacent when possible', () => {
    const ctx = secondary([6], 2);
    const { drafts, unplaced } = run(ctx);
    expect(unplaced).toEqual([]);
    expect(score(ctx, asEntries(drafts), 0).soft.splitDoubles).toBe(0);
    for (const cls of ctx.classes) {
      const maths = drafts.filter((d) => d.classIds.includes(cls.id) && d.lessons[0]?.subjectId === S.maths);
      expect(maths).toHaveLength(6);
      expect(new Set(maths.map((d) => d.day)).size).toBe(5);
    }
  });

  it('reports unplaced when the class has no room', () => {
    const base = secondary([6], 1);
    const cls = base.classes[0]!;
    const plan = base.grades[0]!.plan.map((i) => (i.kind === 'subject' && i.subjectId === S.maths ? { ...i, perWeek: 10 } : i));
    const ctx = { ...base, classes: [{ ...cls, planOverride: plan }] };
    const { drafts, unplaced } = run(ctx);
    expect(checkHard(ctx, [], drafts)).toEqual([]);
    expect(drafts).toHaveLength(40);
    expect(unplaced.reduce((n, u) => n + u.missing, 0)).toBe(2);
    expect(unplaced.every((u) => u.reason === 'no-room' && u.unit === 'periods' && u.classId === cls.id)).toBe(true);
  });

  it('respects kept entries that already exceed limits', () => {
    const ctx = secondary([6], 2);
    const cls = ctx.classes[0]!;
    const ct = cls.classTeacherId!;
    const kept = Array.from({ length: 8 }, (_, i) => entry(`k${i}`, 0, i + 1, [cls.id], [[S.maths, ct]]));
    const { drafts } = run(ctx, kept);
    expect(checkHard(ctx, kept, drafts)).toEqual([]);
    expect(drafts.some((d) => d.day === 0 && d.lessons.some((l) => l.teacherId === ct))).toBe(false);
    expect(drafts.some((d) => d.classIds.includes(cls.id) && d.lessons[0]?.subjectId === S.maths)).toBe(false);
  });

  it('reports unallocated items without placing them', () => {
    const ctx = secondary([6], 1);
    const classId = ctx.classes[0]!.id;
    const alloc = allocate({ ctx, entries: [], classIds: [classId], random: rng(1) }).allocation.map((a) =>
      a.planKey === `subject:${S.history}` ? { ...a, teacherId: null } : a,
    );
    const { drafts, unplaced } = run(ctx, [], 1, alloc);
    expect(drafts.some((d) => d.lessons[0]?.subjectId === S.history)).toBe(false);
    expect(unplaced).toContainEqual({ classId, planKey: `subject:${S.history}`, missing: 3, unit: 'periods', reason: 'no-free-teacher', params: { reason: 'unallocated' } });
  });

  it('is deterministic for the same seed', () => {
    const ctx = secondary([6, 7], 3);
    expect(run(ctx, [], 7)).toEqual(run(ctx, [], 7));
    expect(run(mahasen.ctx, [], 3)).toEqual(run(mahasen.ctx, [], 3));
  });

  it('fills a whole secondary school with every hard rule kept', () => {
    const ctx = secondary([6, 7, 8, 9, 10, 11], 4);
    const { drafts } = run(ctx);
    expect(checkHard(ctx, [], drafts)).toEqual([]);
    const firsts = new Set(drafts.filter((d) => d.period === 1).map((d) => `${d.classIds[0]}|${d.day}`));
    expect(firsts.size).toBe(ctx.classes.length * 5);
  });

  it('repairs minutes when the first greedy choice leaves an item unbuildable', () => {
    const { ctx: base, S: MS } = mahasen;
    const period = (start: string, end: string): TemplateRow => ({ type: 'period', start, end });
    const rows = [period('08:00', '08:20'), period('08:20', '09:15'), period('09:15', '10:10'), period('10:10', '10:20'), period('10:20', '11:15')];
    const plan: PlanItem[] = [
      { kind: 'subject', subjectId: MS.motherTongue, perWeek: 100, unit: 'minutes' },
      { kind: 'subject', subjectId: MS.maths, perWeek: 525, unit: 'minutes' },
      { kind: 'subject', subjectId: MS.environment, perWeek: 350, unit: 'minutes' },
    ];
    const ctx: SchoolContext = { ...base, templates: [{ ...base.templates[0]!, rows }], grades: [{ ...base.grades[0]!, plan }], classes: [base.classes[0]!] };
    expect(run(ctx, [], 1, undefined, 0).unplaced).not.toEqual([]);
    const { drafts, unplaced } = run(ctx);
    expect(unplaced).toEqual([]);
    expect(checkHard(ctx, [], drafts)).toEqual([]);
    expect(drafts.filter((d) => d.period === 1)).toHaveLength(5);
  });

  it('moves placed lessons to make room when a full week is tight', () => {
    const base = secondary([6, 7, 8, 9, 10, 11], 4);
    const full = (i: PlanItem): PlanItem => (i.kind === 'subject' && (i.subjectId === S.health || i.subjectId === S.tamil) ? { ...i, perWeek: 3 } : i);
    const ctx = { ...base, grades: base.grades.map((g) => ({ ...g, plan: g.plan.map(full) })) };
    expect(run(ctx, [], 1, undefined, 0).unplaced).not.toEqual([]);
    const { drafts, unplaced } = run(ctx);
    expect(unplaced).toEqual([]);
    expect(checkHard(ctx, [], drafts)).toEqual([]);
    expect(drafts).toHaveLength(ctx.classes.length * 40 - base.grades.length * 2 * 3 * 3);
  });

  it('stops at the deadline and reports what is left', () => {
    const ctx = secondary([6, 7], 3);
    const classIds = ctx.classes.map((c) => c.id);
    const allocation = allocate({ ctx, entries: [], classIds, random: rng(1) }).allocation;
    const r = place({ ctx, kept: [], allocation, classIds, random: rng(1), stepBudget: 2000, deadline: 0, now: () => 1 });
    expect(r.drafts).toEqual([]);
    expect(r.unplaced.length).toBeGreaterThan(0);
  });
});
