// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import fc from 'fast-check';
import { describe, it } from 'vitest';
import { findConflicts } from './clash';
import { C, ctx, S, T } from './fixtures';
import { overlaps } from './time';
import type { DayIndex, Entry } from './types';

const windowArb = fc
  .tuple(fc.integer({ min: 0, max: 1440 }), fc.integer({ min: 1, max: 240 }))
  .map(([start, len]) => ({ start, end: start + len }));

const entryArb = (id: string) =>
  fc.record({
    day: fc.constantFrom<DayIndex>(0, 1, 2, 3, 4),
    period: fc.integer({ min: 1, max: 9 }),
    classIds: fc.uniqueArray(fc.constantFrom(...Object.values(C)), { minLength: 1, maxLength: 2 }),
    lessons: fc.array(
      fc.record({
        subjectId: fc.constantFrom(...Object.values(S)),
        teacherId: fc.option(fc.constantFrom(...Object.values(T)), { nil: null }),
      }),
      { minLength: 1, maxLength: 3 },
    ),
  }).map((d): Entry => ({ ...d, id, teacherIds: [] }));

const key = (c: { kind: string; id: string }) => `${c.kind}:${c.id}`;

describe('overlaps (property)', () => {
  it('is symmetric and agrees with a minute-by-minute check', () => {
    fc.assert(
      fc.property(windowArb, windowArb, (a, b) => {
        const brute = Math.max(a.start, b.start) < Math.min(a.end, b.end);
        return overlaps(a, b) === overlaps(b, a) && overlaps(a, b) === brute;
      }),
    );
  });
});

describe('findConflicts (property)', () => {
  it('is symmetric between two entries and never reports an entry against itself', () => {
    fc.assert(
      fc.property(entryArb('a'), entryArb('b'), (a, b) => {
        const ab = findConflicts(a, [b], ctx).map(key).sort();
        const ba = findConflicts(b, [a], ctx).map(key).sort();
        return JSON.stringify(ab) === JSON.stringify(ba) && findConflicts(a, [a], ctx).length === 0;
      }),
    );
  });
});
