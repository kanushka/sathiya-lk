import { describe, expect, it } from 'vitest';
import { C, ctx, entry, G, plan12A, S, T } from './fixtures';
import { effectivePlan, entryPlanKey, planKey } from './plan';
import type { Grade, SchoolClass } from './types';

const cls = (id: string): SchoolClass => ctx.classes.find((c) => c.id === id)!;
const grade = (id: string): Grade => ctx.grades.find((g) => g.id === id)!;

describe('effectivePlan', () => {
  it('uses the grade plan without an override', () => {
    expect(effectivePlan(cls(C.c6a), grade(G.g6))).toBe(grade(G.g6).plan);
  });

  it('planOverride on 12A replaces the grade plan', () => {
    expect(effectivePlan(cls(C.c12a), grade(G.g12))).toBe(plan12A);
    expect(effectivePlan(cls(C.c12a), grade(G.g12)).some((p) => p.kind === 'subject' && p.subjectId === S.maths)).toBe(false);
  });
});

describe('planKey', () => {
  it('keys subjects and groups', () => {
    expect(planKey({ kind: 'subject', subjectId: S.maths, perWeek: 6 })).toBe('subject:s-maths');
    expect(planKey({ kind: 'group', key: 'religion', nameEn: 'Religion', optionSubjectIds: [], perWeek: 3 })).toBe('group:religion');
  });
});

describe('entryPlanKey', () => {
  const plan = grade(G.g6).plan;

  it('maps a group entry to its group item', () => {
    const e = entry('x', 0, 4, [C.c6a, C.c6b], [[S.buddhism, T.ananda]], 'religion');
    expect(entryPlanKey(e, plan)).toBe('group:religion');
  });

  it('maps a normal entry to its subject item', () => {
    expect(entryPlanKey(entry('x', 0, 1, [C.c6b], [[S.maths, T.perera]]), plan)).toBe('subject:s-maths');
  });

  it('falls back to the subject when the group key is not in the plan', () => {
    const e = entry('x', 0, 1, [C.c12a], [[S.buddhism, T.ananda]], 'religion');
    expect(entryPlanKey(e, plan12A)).toBe('subject:s-buddhism');
  });

  it('returns null when nothing matches', () => {
    expect(entryPlanKey(entry('x', 0, 1, [C.c6b], [[S.pali, T.ananda]]), plan)).toBeNull();
    expect(entryPlanKey(entry('x', 0, 1, [C.c6b], []), plan)).toBeNull();
  });
});
