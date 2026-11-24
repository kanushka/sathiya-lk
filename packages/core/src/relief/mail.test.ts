// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import type { Relief } from '../types';
import { planReliefMail, reliefKey } from './mail';

const r = (entryId: string, reliefTeacherId: string | null): Relief => ({ entryId, absentTeacherId: 'x', day: 1, period: 1, start: '07:45', end: '08:30', classIds: ['c'], subjectId: 's', reliefTeacherId });

describe('reliefKey', () => {
  it('covers only the teacher\'s duties, in a stable order', () => {
    const key = reliefKey([r('e2', 't1'), r('e1', 't1'), r('e3', 't2'), r('e4', null)], 't1');
    expect(key).toBe(reliefKey([r('e1', 't1'), r('e2', 't1')], 't1'));
    expect(key).not.toBe(reliefKey([r('e1', 't1')], 't1'));
  });
  it.each([
    ['absentTeacherId', 'y'],
    ['start', '07:50'],
    ['end', '08:20'],
    ['period', 2],
    ['classIds', ['c', 'd']],
    ['subjectId', 't'],
  ] as const)('changes when %s changes', (field, value) => {
    expect(reliefKey([{ ...r('e1', 't1'), [field]: value }], 't1')).not.toBe(reliefKey([r('e1', 't1')], 't1'));
  });
  it('is empty when the teacher has none', () => {
    expect(reliefKey([r('e1', 't2')], 't1')).toBe('');
  });
});

describe('planReliefMail', () => {
  it.each([
    ['e1', undefined, 'assigned'],
    ['e1', 'e1', null],
    ['e1,e2', 'e1', 'assigned'],
    ['', 'e1', 'cancelled'],
    ['', undefined, null],
    ['', '', null],
    ['e1', '', 'assigned'],
  ] as const)('current %j last %j -> %j', (current, last, want) => {
    expect(planReliefMail(current, last)).toBe(want);
  });
});
