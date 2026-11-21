// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { contrastWithWhite, isLowContrast } from './contrast';

describe('contrast', () => {
  it('matches known ratios', () => {
    expect(contrastWithWhite('#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 5);
    expect(contrastWithWhite('#767676')).toBeCloseTo(4.54, 1);
  });

  it('flags colours below 4.5:1', () => {
    expect(isLowContrast('#F2C94C')).toBe(true);
    expect(isLowContrast('#7A1F3D')).toBe(false);
    expect(isLowContrast('#0E6B6A')).toBe(false);
  });
});
