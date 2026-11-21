// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { C, ctx, defaultTemplate, entries, entry, S, T, TPL } from './fixtures';
import { orphanedEntries, usageCount, warnings } from './usage';
import type { SchoolContext } from './types';

describe('usageCount', () => {
  it('counts entries using a subject', () => {
    const expected = entries.filter((e) => e.lessons.some((l) => l.subjectId === S.science)).length;
    expect(usageCount('subject', S.science, ctx, entries)).toBe(expected);
    expect(expected).toBe(4);
  });

  it('counts teachers, classes and templates', () => {
    expect(usageCount('teacher', T.perera, ctx, entries)).toBe(7);
    expect(usageCount('teacher', T.jayawardena, ctx, entries)).toBe(0);
    expect(usageCount('class', C.c6a, ctx, entries)).toBe(5);
    expect(usageCount('template', TPL.default, ctx, entries)).toBe(3);
    expect(usageCount('template', TPL.primary, ctx, entries)).toBe(1);
  });
});

const shrunk: SchoolContext = {
  ...ctx,
  templates: ctx.templates.map((t) => (t.id === TPL.default ? { ...defaultTemplate, rows: defaultTemplate.rows.slice(0, -1) } : t)),
};

describe('orphanedEntries', () => {
  it('returns nothing for the fixtures', () => {
    expect(orphanedEntries(entries, ctx)).toEqual([]);
  });

  it('returns period-8 entries after the template shrinks to 7', () => {
    const orphans = orphanedEntries(entries, shrunk);
    expect(orphans.map((e) => e.id)).toEqual(entries.filter((e) => e.period === 8 && e.classIds[0] !== C.c6c).map((e) => e.id));
    expect(orphans).toHaveLength(5);
  });
});

describe('warnings', () => {
  it('is empty for the fixtures', () => {
    expect(warnings(entries, ctx)).toEqual([]);
  });

  it('reports over-limit for an 8-period day and over-target', () => {
    const day = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => entry(`m-${p}`, 0, p, [C.c6b], [[S.maths, T.perera]]));
    expect(warnings(day, ctx)).toEqual([
      { kind: 'over-limit', refId: T.perera, day: 0, detail: '8 periods on Mon, limit 7' },
      { kind: 'over-target', refId: C.c6b, detail: 'Mathematics 8/6', planKey: `subject:${S.maths}` },
    ]);
  });

  it('reports group entries missing a teacher and orphans', () => {
    const group = entry('g', 1, 4, [C.c6a, C.c6b], [[S.buddhism, T.ananda], [S.islam, null]], 'religion');
    const orphan = entry('o', 2, 8, [C.c6b], [[S.history, T.rSilva]]);
    expect(warnings([group, orphan], shrunk)).toEqual([
      { kind: 'group-no-teacher', refId: 'g', day: 1, detail: 'Religion has an option without a teacher' },
      { kind: 'orphaned', refId: 'o', day: 2, detail: 'Wed P8 is outside the class template' },
    ]);
  });
});
