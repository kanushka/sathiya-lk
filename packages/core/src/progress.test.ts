// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, ctx, mahasen, entries, entries6B, entry, G, plan12A, primaryTemplate, S, shortFridayTemplate, T, TPL, defaultTemplate } from './fixtures';
import { activityCredit, classPlacement, classProgress, weekCapacity } from './progress';
import type { SchoolContext } from './types';
import { slotMinutes } from './time';

const plan6 = ctx.grades.find((g) => g.id === G.g6)!.plan;
const row = (rows: ReturnType<typeof classProgress>, key: string) => rows.find((r) => r.key === key);

describe('classProgress', () => {
  it('6B progress from the canvas grid', () => {
    const rows = classProgress(C.c6b, entries, plan6);
    expect(rows.map((r) => r.key)).toEqual(plan6.map((p) => (p.kind === 'subject' ? `subject:${p.subjectId}` : `group:${p.key}`)));
    expect(row(rows, 'subject:s-maths')).toMatchObject({ placed: 6, needed: 6 });
    expect(row(rows, 'subject:s-science')).toMatchObject({ placed: 3, needed: 5 });
    expect(row(rows, 'subject:s-health')).toMatchObject({ placed: 2, needed: 3 });
    expect(row(rows, 'subject:s-pts')).toMatchObject({ placed: 1, needed: 2 });
    expect(row(rows, 'group:aesthetic')).toMatchObject({ placed: 3, needed: 3 });
    expect(rows.reduce((n, r) => n + r.placed, 0)).toBe(36);
    expect(row(rows, 'subject:s-maths')?.item).toBe(plan6[0]);
  });

  it('a group Religion entry counts 1 for each of 6A and 6B', () => {
    const single = entries6B.filter((e) => e.groupKey === 'religion').slice(0, 1);
    expect(row(classProgress(C.c6a, single, plan6), 'group:religion')?.placed).toBe(1);
    expect(row(classProgress(C.c6b, single, plan6), 'group:religion')?.placed).toBe(1);
    expect(row(classProgress(C.c6a, entries, plan6), 'group:religion')?.placed).toBe(3);
    expect(row(classProgress(C.c6a, entries, plan6), 'subject:s-maths')?.placed).toBe(2);
  });

  it('uses the given (effective) plan', () => {
    const e = [entry('x', 0, 1, [C.c12a], [[S.buddhism, T.ananda]])];
    const rows = classProgress(C.c12a, e, plan12A);
    expect(rows).toHaveLength(plan12A.length);
    expect(row(rows, 'subject:s-buddhism')).toMatchObject({ placed: 1, needed: 8 });
  });
});

const cls = (id: string) => ctx.classes.find((c) => c.id === id)!;

describe('classPlacement', () => {
  it('totals placed periods against the plan', () => {
    const p = classPlacement(cls(C.c6b), entries, ctx);
    expect(p).toMatchObject({ placed: 36, needed: 40 });
    expect(p.rows).toEqual(classProgress(C.c6b, entries, plan6));
  });

  it('caps each plan item at its plan so over-plan periods do not inflate the total', () => {
    const extra = [
      entry('x1', 2, 4, [C.c6b], [[S.maths, T.perera]]),
      entry('x2', 4, 5, [C.c6b], [[S.maths, T.perera]]),
      entry('x3', 4, 6, [C.c6b], [[S.music, T.fernando]], 'aesthetic'),
    ];
    const p = classPlacement(cls(C.c6b), [...entries, ...extra], ctx);
    expect(row(p.rows, 'subject:s-maths')).toMatchObject({ placed: 8, needed: 6 });
    expect(row(p.rows, 'group:aesthetic')).toMatchObject({ placed: 4, needed: 3 });
    expect(p.placed).toBe(36);
  });

  it('leaves out entries outside the class template', () => {
    const rows = shortFridayTemplate.rows;
    const shrunk: SchoolContext = {
      ...ctx,
      templates: ctx.templates.map((t) => (t.id === TPL.shortFriday ? { ...shortFridayTemplate, days: { 0: rows, 1: rows, 2: rows, 3: rows, 4: rows.slice(0, -3) } } : t)),
    };
    expect(classPlacement(cls(C.c6c), entries, ctx)).toMatchObject({ placed: 1 });
    const p = classPlacement(cls(C.c6c), entries, shrunk);
    expect(row(p.rows, 'subject:s-science')).toMatchObject({ placed: 0, needed: 5 });
    expect(p.placed).toBe(0);
  });
});

describe('weekCapacity', () => {
  it('sums periods Mon–Fri', () => {
    expect(weekCapacity(defaultTemplate)).toBe(40);
    expect(weekCapacity(shortFridayTemplate)).toBe(39);
    expect(weekCapacity(primaryTemplate)).toBe(30);
  });
});

describe('minute plan items', () => {
  const mh = mahasen.ctx;
  const mhClass = mh.classes[0]!;
  const mhTpl = mh.templates[0]!;
  const mhPlan = mh.grades[0]!.plan;
  const maths = mhPlan.find((p) => p.kind === 'subject' && p.subjectId === mahasen.S.maths)!;
  const mathsEntry = (id: string, day: 0 | 1 | 2 | 3 | 4, period: number) => entry(id, day, period, [mhClass.id], [[mahasen.S.maths, mhClass.classTeacherId ?? null]]);

  it('measures slot minutes', () => {
    expect(slotMinutes(mhTpl, 0, 1)).toBe(60);
    expect(slotMinutes(mhTpl, 0, 4)).toBe(10);
    expect(slotMinutes(mhTpl, 0, 99)).toBe(0);
  });

  it('counts minutes for minute items', () => {
    const e = [mathsEntry('m1', 0, 3), mathsEntry('m2', 1, 4)];
    const rows = classProgress(mhClass.id, e, mhPlan, mhTpl);
    expect(row(rows, `subject:${mahasen.S.maths}`)).toMatchObject({ placed: 40, needed: 190, unit: 'minutes' });
  });

  it('credits activity rows to their subject', () => {
    const rows = classProgress(mhClass.id, [], mhPlan, mhTpl);
    expect(row(rows, `subject:${mahasen.S.health}`)).toMatchObject({ placed: 50, needed: 50, unit: 'minutes' });
    expect(row(rows, `subject:${mahasen.S.maths}`)).toMatchObject({ placed: 0 });
  });

  it('activityCredit counts 1 per row per day for period items', () => {
    const item = { kind: 'subject', subjectId: mahasen.S.health, perWeek: 5 } as const;
    expect(activityCredit(mhTpl, item)).toBe(5);
    expect(activityCredit(mhTpl, maths)).toBe(0);
  });

  it('period rows report unit periods', () => {
    expect(classProgress(C.c6b, entries, plan6)[0]?.unit).toBe('periods');
  });

  it('classPlacement caps by needed in minutes', () => {
    const e = [0, 1, 2, 3, 4].flatMap((d) => [mathsEntry(`a${d}`, d as 0, 1), mathsEntry(`b${d}`, d as 0, 6)]);
    const p = classPlacement(mhClass, e, mh);
    const r = row(p.rows, `subject:${mahasen.S.maths}`)!;
    expect(r.placed).toBeGreaterThan(r.needed);
    const capped = p.rows.reduce((n, x) => n + Math.min(x.placed, x.needed), 0);
    expect(p.placed).toBe(capped);
    expect(p.placed).toBe(190 + 50);
  });
});
