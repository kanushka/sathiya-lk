// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { MIN_PASSWORD_LENGTH, passwordLongEnough } from './password';

describe('passwordLongEnough', () => {
  it('requires 8 characters', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(passwordLongEnough('abcdefg')).toBe(false);
    expect(passwordLongEnough('abcdefgh')).toBe(true);
  });
});
