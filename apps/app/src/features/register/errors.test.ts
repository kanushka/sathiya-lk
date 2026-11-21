// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../lib/callable';
import { registerFailure } from './errors';

describe('registerFailure', () => {
  it('reads the code and school id from error details', () => {
    const err = new ApiError('invalid', 'x', { code: 'census-taken', schoolId: 's1' });
    expect(registerFailure(err)).toEqual({ code: 'census-taken', schoolId: 's1' });
  });

  it.each(['email-unverified', 'already-has-school', 'rate-limited'] as const)('recognises %s', (code) => {
    expect(registerFailure(new ApiError('invalid', 'x', { code }))).toEqual({ code });
  });

  it('returns null for unknown or missing details', () => {
    expect(registerFailure(new ApiError('invalid', 'x', { code: 'nope' }))).toBeNull();
    expect(registerFailure(new ApiError('invalid', 'x'))).toBeNull();
    expect(registerFailure(new Error('x'))).toBeNull();
    expect(registerFailure(null)).toBeNull();
  });
});
