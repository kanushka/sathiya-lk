// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../app/AuthProvider', () => ({ useAuth: () => ({}) }));
vi.mock('./api', () => ({ claimInvites: vi.fn() }));

const { returnPathFrom } = await import('./returnPath');

describe('returnPathFrom', () => {
  it('returns the path and query of a same-origin target', () => {
    expect(returnPathFrom({ from: { pathname: '/join/s1/abc', search: '?x=1' } })).toBe('/join/s1/abc?x=1');
    expect(returnPathFrom({ from: { pathname: '/s/s1/me' } })).toBe('/s/s1/me');
  });

  it.each([null, undefined, {}, { from: {} }, { from: { pathname: 'https://evil.example' } }, { from: { pathname: '//evil.example/x' } }, { from: { pathname: 5 } }])(
    'returns null for %j',
    (state) => {
      expect(returnPathFrom(state)).toBeNull();
    },
  );
});
