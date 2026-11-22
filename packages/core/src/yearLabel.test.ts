// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { yearLabelError } from './yearLabel';

describe('yearLabelError', () => {
  it('accepts a new 4-digit year, trimmed', () => {
    expect(yearLabelError('2027', ['2026'])).toBeNull();
    expect(yearLabelError(' 2027 ', [])).toBeNull();
    expect(yearLabelError('2000', [])).toBeNull();
    expect(yearLabelError('2100', [])).toBeNull();
  });
  it.each(['', 'abc', '27', '20277', '1999', '2101', '20x7', '2027-28'])('rejects %j as a bad format', (l) => {
    expect(yearLabelError(l, [])).toBe('format');
  });
  it('rejects a label an existing year already has', () => {
    expect(yearLabelError('2027', ['2026', '2027'])).toBe('duplicate');
    expect(yearLabelError('2027', [' 2027'])).toBe('duplicate');
  });
});
