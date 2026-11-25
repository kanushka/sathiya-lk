// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { canonicalDistrict, DISTRICTS, isDistrict } from './districts';

describe('districts', () => {
  it('lists the 25 districts', () => {
    expect(DISTRICTS).toHaveLength(25);
    expect(new Set(DISTRICTS).size).toBe(25);
  });

  it('recognises only listed names', () => {
    expect(isDistrict('Monaragala')).toBe(true);
    expect(isDistrict('Moneragala')).toBe(false);
    expect(isDistrict('colombo')).toBe(false);
    expect(isDistrict(undefined)).toBe(false);
  });

  it('maps the MOE spelling to the app spelling', () => {
    expect(canonicalDistrict('Moneragala')).toBe('Monaragala');
    expect(canonicalDistrict('Kandy')).toBe('Kandy');
  });
});
