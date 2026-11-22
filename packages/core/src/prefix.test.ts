// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { followPrefix, suggestStaffPrefix } from './staff';

describe('suggestStaffPrefix', () => {
  it.each([
    ['G/ P. D. S. Kularathne Collage', 'KC'],
    ['Royal College', 'RC'],
    ['Ananda College', 'AC'],
    ['Maliyadeva Balika Vidyalaya', 'MBV'],
  ])('%s → %s', (name, prefix) => {
    expect(suggestStaffPrefix(name)).toBe(prefix);
  });

  it('handles extra spaces and lower case', () => {
    expect(suggestStaffPrefix('  royal    college  ')).toBe('RC');
    expect(suggestStaffPrefix('cp/ dharmaraja  college')).toBe('DC');
    expect(suggestStaffPrefix('WP/Visakha Vidyalaya')).toBe('VV');
  });

  it('drops joined initials', () => {
    expect(suggestStaffPrefix('P.D.S. Kularathne College')).toBe('KC');
  });

  it('caps at four letters', () => {
    expect(suggestStaffPrefix('Sri Rahula National Maha Vidyalaya')).toBe('SRNM');
  });

  it('uses the first letters of a single word so the prefix is valid', () => {
    expect(suggestStaffPrefix('Trinity')).toBe('TRI');
  });

  it('gives nothing for a Sinhala-only or empty name', () => {
    expect(suggestStaffPrefix('රාජකීය විද්‍යාලය')).toBe('');
    expect(suggestStaffPrefix('   ')).toBe('');
  });
});

describe('followPrefix', () => {
  it('fills an empty prefix', () => {
    expect(followPrefix('', 'Royal College', '')).toBe('RC');
  });
  it('keeps following while the prefix is the previous suggestion', () => {
    expect(followPrefix('Royal', 'Royal College', 'ROY')).toBe('RC');
  });
  it('keeps a prefix the user typed', () => {
    expect(followPrefix('Royal', 'Royal College', 'RCK')).toBe('RCK');
  });
  it('clears a followed prefix when the name no longer gives one', () => {
    expect(followPrefix('Ro', 'R', 'RO')).toBe('');
  });
});
