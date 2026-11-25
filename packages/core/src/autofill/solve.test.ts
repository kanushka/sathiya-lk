// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { withTeacherIds } from '../clash';
import { mahasen, secondary } from '../fixtures';
import { classPlacement } from '../progress';
import type { Entry, EntryDraft, PeriodTemplate, SchoolContext, TemplateRow } from '../types';
import { checkHard } from './check';
import { solve, type FillMode } from './solve';

const asEntries = (drafts: EntryDraft[], prefix = 'n'): Entry[] => drafts.map((d, i) => ({ ...withTeacherIds(d), id: `${prefix}${i}` }));
const once = (): number => 0;
const fillAround: FillMode = { kind: 'fillAround' };

function fake(step = 100): () => number {
  let t = 0;
  return () => {
    t += step;
    return t;
  };
}

function sixteenPeriod(): SchoolContext {
  const base = mahasen.ctx;
  const durations = [10, 15, 20, 25, 30, 35, 40, 10, 15, 20, 25, 30, 35, 40, 10, 15];
  let t = 7 * 60;
  const hhmm = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const rows: TemplateRow[] = durations.map((d) => {
    const row: TemplateRow = { type: 'period', start: hhmm(t), end: hhmm(t + d) };
    t += d;
    return row;
  });
  const tpl: PeriodTemplate = { ...base.templates[0]!, rows };
  return { ...base, templates: [tpl] };
}

describe('solve', () => {
  it('same seed gives identical result', () => {
    const ctx = secondary([6, 7], 3);
    const a = solve({ ctx, entries: [], mode: fillAround, seed: 4, budgetMs: 300, now: fake() });
    const b = solve({ ctx, entries: [], mode: fillAround, seed: 4, budgetMs: 300, now: fake() });
    expect(a).toEqual(b);
  });

  it('stops at budget with best so far', () => {
    const ctx = secondary([6], 2);
    const seen: number[][] = [];
    const r = solve({ ctx, entries: [], mode: fillAround, seed: 1, budgetMs: 1000, now: fake(100), onProgress: (p) => seen.push(p.best) });
    expect(r.attempts).toBeGreaterThanOrEqual(1);
    expect(r.attempts).toBeLessThanOrEqual(10);
    expect(seen).toHaveLength(r.attempts);
    expect(r.seed).toBe(1);
  });

  it('always runs at least one attempt', () => {
    const r = solve({ ctx: secondary([6], 2), entries: [], mode: fillAround, seed: 1, budgetMs: 0, now: once });
    expect(r.attempts).toBe(1);
    expect(r.drafts.length).toBeGreaterThan(0);
  });

  it('fill around never deletes', () => {
    const ctx = secondary([6, 7], 2);
    const first = solve({ ctx, entries: [], mode: fillAround, seed: 1, budgetMs: 0, now: once });
    const kept = asEntries(first.drafts.slice(0, 30));
    const r = solve({ ctx, entries: kept, mode: fillAround, seed: 2, budgetMs: 0, now: once });
    expect(r.deleteEntryIds).toEqual([]);
    expect(checkHard(ctx, kept, r.drafts)).toEqual([]);
    for (const cls of ctx.classes) expect(classPlacement(cls, [...kept, ...asEntries(r.drafts, 'x')], ctx).placed).toBeGreaterThan(0);
  });

  it('start over keeps other grades and their teacher clashes', () => {
    const ctx = secondary([6, 7], 2);
    const full = solve({ ctx, entries: [], mode: fillAround, seed: 1, budgetMs: 0, now: once });
    const entries = asEntries(full.drafts);
    const g6 = ctx.grades.find((g) => g.number === 6)!;
    const g6Classes = new Set(ctx.classes.filter((c) => c.gradeId === g6.id).map((c) => c.id));
    const r = solve({ ctx, entries, mode: { kind: 'startOver', gradeIds: [g6.id] }, seed: 3, budgetMs: 0, now: once });
    const expectedDeleted = entries.filter((e) => e.classIds.some((c) => g6Classes.has(c))).map((e) => e.id);
    expect([...r.deleteEntryIds].sort()).toEqual([...expectedDeleted].sort());
    const kept = entries.filter((e) => !r.deleteEntryIds.includes(e.id));
    expect(kept.length).toBeGreaterThan(0);
    expect(r.drafts.every((d) => d.classIds.every((c) => g6Classes.has(c)))).toBe(true);
    expect(checkHard(ctx, kept, r.drafts)).toEqual([]);
  });

  it('checkHard is empty for every result', () => {
    for (const ctx of [mahasen.ctx, secondary([6, 7], 2)]) {
      for (const seed of [1, 2, 3, 4, 5]) {
        for (const mode of [fillAround, { kind: 'startOver', gradeIds: [ctx.grades[0]!.id] } as FillMode]) {
          const seeded = solve({ ctx, entries: [], mode: fillAround, seed: 9, budgetMs: 0, now: once });
          const entries = asEntries(seeded.drafts);
          const input = mode.kind === 'fillAround' ? entries.filter((_, i) => i % 3 !== 0) : entries;
          const r = solve({ ctx, entries: input, mode, seed, budgetMs: 0, now: once });
          const kept = input.filter((e) => !r.deleteEntryIds.includes(e.id));
          expect(checkHard(ctx, kept, r.drafts)).toEqual([]);
          const ids = new Set(kept.map((e) => e.id));
          expect(r.drafts.some((d) => d.id !== undefined && ids.has(d.id))).toBe(false);
        }
      }
    }
  });

  it('completes a partially kept group block', () => {
    const ctx = secondary([6], 4);
    const full = solve({ ctx, entries: [], mode: fillAround, seed: 1, budgetMs: 0, now: once });
    const some = new Set(ctx.classes.slice(0, 2).map((c) => c.id));
    const block = full.drafts.filter((d) => d.groupKey === 'religion').map((d) => ({ ...d, classIds: d.classIds.filter((c) => some.has(c)) }));
    const kept = asEntries(block, 'k');
    const r = solve({ ctx, entries: kept, mode: fillAround, seed: 1, budgetMs: 0, now: once });
    expect(checkHard(ctx, kept, r.drafts)).toEqual([]);
    expect(r.unplaced).toEqual([]);
  });

  it('secondary 40 classes finishes within budget', () => {
    const ctx = secondary([6, 7, 8, 9, 10, 11, 12, 13].slice(0, 6), 7);
    const started = Date.now();
    const r = solve({ ctx, entries: [], mode: fillAround, seed: 1, budgetMs: 2000 });
    const took = Date.now() - started;
    console.info(`secondary ${ctx.classes.length} classes: ${took} ms, attempts ${r.attempts}`);
    expect(r.attempts).toBeGreaterThanOrEqual(1);
    expect(took).toBeLessThan(9000);
    expect(checkHard(ctx, [], r.drafts)).toEqual([]);
  });

  it('mahasen solves fully', () => {
    const started = Date.now();
    const r = solve({ ctx: mahasen.ctx, entries: [], mode: fillAround, seed: 1, budgetMs: 1000 });
    console.info(`mahasen: ${Date.now() - started} ms, attempts ${r.attempts}`);
    expect(r.unplaced).toEqual([]);
  });

  it('respects the budget on a 16-period uneven template', () => {
    const ctx = sixteenPeriod();
    const started = Date.now();
    const r = solve({ ctx, entries: [], mode: fillAround, seed: 1, budgetMs: 800 });
    const took = Date.now() - started;
    console.info(`16-period template: ${took} ms, attempts ${r.attempts}`);
    expect(r.attempts).toBeGreaterThanOrEqual(1);
    expect(took).toBeLessThan(3000);
    expect(checkHard(ctx, [], r.drafts)).toEqual([]);
  });
});
