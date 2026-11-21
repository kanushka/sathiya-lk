import { describe, expect, it } from 'vitest';
import { C, ctx, entries, entries6B, entry, G, plan12A, primaryTemplate, S, shortFridayTemplate, T, defaultTemplate } from './fixtures';
import { classProgress, weekCapacity } from './progress';

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

describe('weekCapacity', () => {
  it('sums periods Mon–Fri', () => {
    expect(weekCapacity(defaultTemplate)).toBe(40);
    expect(weekCapacity(shortFridayTemplate)).toBe(39);
    expect(weekCapacity(primaryTemplate)).toBe(30);
  });
});
