// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { cleanPhone } from './phone';

describe('cleanPhone', () => {
  it('keeps a local or international number, tidied', () => {
    expect(cleanPhone(' 071 234  5678 ')).toBe('071 234 5678');
    expect(cleanPhone('+94 71 234 5678')).toBe('+94 71 234 5678');
    expect(cleanPhone('(011) 269-1234')).toBe('(011) 269-1234');
  });
  it('clears on an empty value', () => {
    expect(cleanPhone('')).toBeNull();
    expect(cleanPhone('   ')).toBeNull();
  });
  it('rejects text, short or long values and non-strings', () => {
    expect(cleanPhone('call me')).toBeUndefined();
    expect(cleanPhone('12345')).toBeUndefined();
    expect(cleanPhone('1'.repeat(31))).toBeUndefined();
    expect(cleanPhone(712345678)).toBeUndefined();
    expect(cleanPhone(null)).toBeUndefined();
  });
});
