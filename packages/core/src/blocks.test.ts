// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { blockMates, joinableClasses } from './blocks';
import { C, ctx, entries, S } from './fixtures';

const names = (r: ReturnType<typeof joinableClasses>) => r.map((c) => c.id);

describe('joinableClasses', () => {
  it('only same-grade, same-template, free classes; excludes 6C on Short Friday', () => {
    expect(names(joinableClasses({ ctx, entries, baseClassId: C.c6b, day: 0, period: 2 }))).toEqual([C.c6a]);
    expect(names(joinableClasses({ ctx, entries, baseClassId: C.c6a, day: 2, period: 4 }))).toEqual([C.c6b]);
    expect(names(joinableClasses({ ctx, entries, baseClassId: C.c6c, day: 2, period: 4 }))).toEqual([]);
  });

  it('excludes busy classes unless the busy entry is the one being edited', () => {
    expect(names(joinableClasses({ ctx, entries, baseClassId: C.c6a, day: 0, period: 4 }))).toEqual([]);
    expect(names(joinableClasses({ ctx, entries, baseClassId: C.c6a, day: 0, period: 4, editingEntryId: 'e-religion-0-4' }))).toEqual([C.c6b]);
  });

  it('returns [] for an unknown base class', () => {
    expect(joinableClasses({ ctx, entries, baseClassId: 'nope', day: 0, period: 4 })).toEqual([]);
  });
});

describe('blockMates', () => {
  it('lists same-grade, same-template classes whose plan has the item, by name', () => {
    expect(names(blockMates({ ctx, baseClassId: C.c6a, item: { groupKey: 'religion' } }))).toEqual([C.c6b]);
    expect(names(blockMates({ ctx, baseClassId: C.c6b, item: { subjectId: S.maths } }))).toEqual([C.c6a]);
    expect(names(blockMates({ ctx, baseClassId: C.c6a, item: { groupKey: 'nope' } }))).toEqual([]);
  });

  it('returns [] for an unknown base class', () => {
    expect(blockMates({ ctx, baseClassId: 'nope', item: { groupKey: 'religion' } })).toEqual([]);
  });
});
