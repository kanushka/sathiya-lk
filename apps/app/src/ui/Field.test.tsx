// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { describe, expect, it } from 'vitest';
import { inputBareClass, inputClass } from './Field';

describe('field classes', () => {
  it('inputClass carries height and width', () => {
    const tokens = inputClass.split(/\s+/);
    expect(tokens).toContain('h-10');
    expect(tokens).toContain('w-full');
  });

  it('inputBareClass leaves height and width to the caller', () => {
    const tokens = inputBareClass.split(/\s+/);
    expect(tokens.filter((c) => /^(h|w)-/.test(c))).toEqual([]);
    expect(tokens).toContain('border-line-strong');
    expect(tokens).toContain('focus:ring-brand/30');
  });
});
