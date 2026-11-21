// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { describe, expect, it, vi } from 'vitest';
import { grantSuper } from '../src/lib/grantSuper';

function fakeAuth(customClaims?: Record<string, unknown>) {
  return {
    getUserByEmail: vi.fn(async () => ({ uid: 'u1', customClaims })),
    setCustomUserClaims: vi.fn(async () => undefined),
  };
}

describe('grantSuper', () => {
  it('adds super while keeping existing claims', async () => {
    const auth = fakeAuth({ sid: 's1', role: 'admin', tid: 't1' });
    const res = await grantSuper(auth as never, ' a@b.lk ');
    expect(auth.getUserByEmail).toHaveBeenCalledWith('a@b.lk');
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { sid: 's1', role: 'admin', tid: 't1', super: true });
    expect(res).toEqual({ uid: 'u1', claims: { sid: 's1', role: 'admin', tid: 't1', super: true } });
  });

  it('works for a user without claims', async () => {
    const auth = fakeAuth();
    await grantSuper(auth as never, 'a@b.lk');
    expect(auth.setCustomUserClaims).toHaveBeenCalledWith('u1', { super: true });
  });

  it('propagates an unknown user', async () => {
    const auth = fakeAuth();
    auth.getUserByEmail.mockRejectedValue(new Error('no user'));
    await expect(grantSuper(auth as never, 'x@y.lk')).rejects.toThrow('no user');
    expect(auth.setCustomUserClaims).not.toHaveBeenCalled();
  });
});
