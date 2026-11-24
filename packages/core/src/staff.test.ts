// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { formatStaffId, isValidStaffId, nextStaffNumber } from './staff';

describe('staff ids', () => {
  it('formats zero-padded', () => {
    expect(formatStaffId('SCC', 24)).toBe('SCC024');
    expect(formatStaffId('SCC', 1)).toBe('SCC001');
  });
  it('validates', () => {
    expect(isValidStaffId('SCC', 'SCC024')).toBe(true);
    expect(isValidStaffId('SCC', 'SCC24')).toBe(false);
    expect(isValidStaffId('SCC', 'SCC0245')).toBe(false);
    expect(isValidStaffId('SCC', 'ABC024')).toBe(false);
    expect(isValidStaffId('S', 'S024')).toBe(false);
  });
  it('computes next number', () => {
    expect(nextStaffNumber(['SCC001', 'SCC007'], 'SCC')).toBe(8);
    expect(nextStaffNumber([], 'SCC')).toBe(1);
    expect(nextStaffNumber(['XYZ009', 'SCC02'], 'SCC')).toBe(1);
  });
});
