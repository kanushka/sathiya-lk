// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { defaultTemplate, primaryTemplate, shortFridayTemplate } from '@sathiya/core/fixtures';
import { describe, expect, it } from 'vitest';
import type { PlanItem } from '@sathiya/core';
import { planCapacity, planFit, planIssues, planTotal } from './planModel';

describe('planCapacity', () => {
  it('is the week capacity of a single template', () => {
    expect(planCapacity([primaryTemplate])).toEqual({ min: 30, max: 30 });
  });

  it('spans the smallest and largest template', () => {
    expect(planCapacity([defaultTemplate, shortFridayTemplate, defaultTemplate])).toEqual({ min: 39, max: 40 });
  });

  it('is zero without templates', () => {
    expect(planCapacity([])).toEqual({ min: 0, max: 0 });
  });
});

describe('planFit', () => {
  it('is exact only when the total fills every template', () => {
    expect(planFit(30, { min: 30, max: 30 })).toBe('exact');
    expect(planFit(29, { min: 30, max: 30 })).toBe('under');
    expect(planFit(31, { min: 30, max: 30 })).toBe('over');
  });

  it('is mixed when the total fits some templates but not others', () => {
    expect(planFit(39, { min: 39, max: 40 })).toBe('mixed');
    expect(planFit(40, { min: 39, max: 40 })).toBe('mixed');
    expect(planFit(38, { min: 39, max: 40 })).toBe('under');
    expect(planFit(41, { min: 39, max: 40 })).toBe('over');
  });
});

describe('planIssues', () => {
  const subject = (extra: Partial<Extract<PlanItem, { kind: 'subject' }>>): PlanItem => ({ kind: 'subject', subjectId: 's', perWeek: 50, ...extra });

  it('accepts plain periods and a perDay that multiplies to perWeek', () => {
    expect(planIssues([subject({ perWeek: 5 }), subject({ unit: 'minutes', perWeek: 50, perDay: 10 }), subject({ unit: 'minutes', perWeek: 50 })])).toEqual([]);
  });

  it('rejects perDay that does not multiply to perWeek', () => {
    expect(planIssues([subject({ unit: 'minutes', perWeek: 55, perDay: 10 })])).toEqual([{ index: 0, issue: 'perDayMismatch' }]);
  });

  it('rejects perDay on a period item', () => {
    expect(planIssues([subject({ perWeek: 5, perDay: 1 })])).toEqual([{ index: 0, issue: 'perDayNeedsMinutes' }]);
  });
});

describe('planTotal', () => {
  it('counts periods only, not minute items', () => {
    expect(planTotal([{ kind: 'subject', subjectId: 'a', perWeek: 4 }, { kind: 'subject', subjectId: 'b', perWeek: 190, unit: 'minutes' }])).toBe(4);
  });
});
