// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Relief, ReliefDay } from '@sathiya/core';
import { describe, expect, it } from 'vitest';
import { countsExcludingSaved, sameDraft } from './model';

const relief = (entryId: string, absent: string, pick: string | null): Relief => ({
  entryId, absentTeacherId: absent, day: 1, period: 1, start: '07:45', end: '08:30', classIds: ['c'], subjectId: 's', reliefTeacherId: pick,
});
const day = (reliefs: Relief[]): ReliefDay => ({ date: '2026-11-24', day: 1, leaves: [], reliefs, names: {}, updatedAt: 1, updatedBy: 'u' });

describe('countsExcludingSaved', () => {
  it('subtracts the saved day picks per teacher', () => {
    const saved = day([relief('e1', 'a', 'x'), relief('e2', 'a', 'x'), relief('e3', 'a', 'y'), relief('e4', 'a', null)]);
    expect(countsExcludingSaved({ counts: { x: 5, y: 1, z: 2 } }, saved)).toEqual({ x: 3, y: 0, z: 2 });
  });

  it('never goes below zero and keeps stats when nothing is saved', () => {
    expect(countsExcludingSaved({ counts: {} }, day([relief('e1', 'a', 'x')]))).toEqual({ x: 0 });
    expect(countsExcludingSaved({ counts: { x: 2 } }, null)).toEqual({ x: 2 });
  });
});

describe('sameDraft', () => {
  it('ignores the order of leaves, ticks and reliefs', () => {
    const a = {
      leaves: [{ teacherId: 'a', type: 'full' as const, entryIds: ['e1', 'e2'] }, { teacherId: 'b', type: 'late' as const, entryIds: ['e3'] }],
      reliefs: [relief('e1', 'a', 'x'), relief('e3', 'b', null)],
    };
    const b = {
      leaves: [{ teacherId: 'b', type: 'late' as const, entryIds: ['e3'] }, { teacherId: 'a', type: 'full' as const, entryIds: ['e2', 'e1'] }],
      reliefs: [relief('e3', 'b', null), relief('e1', 'a', 'x')],
    };
    expect(sameDraft(a, b)).toBe(true);
  });

  it('sees a changed pick, type or tick', () => {
    const base = { leaves: [{ teacherId: 'a', type: 'full' as const, entryIds: ['e1'] }], reliefs: [relief('e1', 'a', 'x')] };
    expect(sameDraft(base, { ...base, reliefs: [relief('e1', 'a', 'y')] })).toBe(false);
    expect(sameDraft(base, { ...base, leaves: [{ teacherId: 'a', type: 'morning', entryIds: ['e1'] }] })).toBe(false);
    expect(sameDraft(base, { ...base, leaves: [{ teacherId: 'a', type: 'full', entryIds: [] }] })).toBe(false);
  });
});
