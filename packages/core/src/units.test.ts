// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { formatAmount, formatAmountPair } from './units';

describe('formatAmount', () => {
  it('formats minutes of an hour or more as hours and minutes', () => {
    expect(formatAmount(190, 'minutes', 'en')).toBe('3h 10m');
    expect(formatAmount(190, 'minutes', 'si')).toBe('පැ. 3.10');
    expect(formatAmount(300, 'minutes', 'en')).toBe('5h');
    expect(formatAmount(65, 'minutes', 'si')).toBe('පැ. 1.05');
  });

  it('formats minutes under an hour', () => {
    expect(formatAmount(50, 'minutes', 'en')).toBe('50 min');
    expect(formatAmount(50, 'minutes', 'si')).toBe('මි. 50');
    expect(formatAmount(0, 'minutes', 'en')).toBe('0 min');
  });

  it('formats periods as a plain number', () => {
    expect(formatAmount(5, 'periods', 'en')).toBe('5');
    expect(formatAmount(5, 'periods', 'si')).toBe('5');
  });
});

describe('formatAmountPair', () => {
  it('shares the unit when both sides are under an hour', () => {
    expect(formatAmountPair(40, 50, 'minutes', 'en')).toBe('40/50 min');
    expect(formatAmountPair(40, 50, 'minutes', 'si')).toBe('මි. 40/50');
  });

  it('formats each side when either reaches an hour', () => {
    expect(formatAmountPair(80, 190, 'minutes', 'en')).toBe('1h 20m/3h 10m');
    expect(formatAmountPair(80, 190, 'minutes', 'si')).toBe('පැ. 1.20/3.10');
  });

  it('joins periods with a slash', () => {
    expect(formatAmountPair(3, 5, 'periods', 'en')).toBe('3/5');
  });
});
