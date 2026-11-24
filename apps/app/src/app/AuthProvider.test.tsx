// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  listener: null as null | ((u: unknown) => void),
  signOut: vi.fn(async () => undefined),
  clear: vi.fn(),
}));

vi.mock('../lib/firebase', () => ({ auth: { currentUser: null } }));
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    fb.listener = cb;
    return () => undefined;
  },
  signOut: fb.signOut,
}));
vi.mock('../features/teachers/sessionPasswords', () => ({ clearSessionPasswords: fb.clear }));

const { AuthProvider, parseClaims, useAuth } = await import('./AuthProvider');

function SignOutButton() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>out</button>;
}

beforeEach(() => {
  fb.signOut.mockClear();
  fb.clear.mockClear();
});

describe('AuthProvider', () => {
  it('clears session teacher passwords on explicit sign-out', async () => {
    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );
    await userEvent.setup().click(screen.getByText('out'));
    expect(fb.signOut).toHaveBeenCalled();
    expect(fb.clear).toHaveBeenCalled();
  });

  it('clears them when the session ends without an explicit sign-out', () => {
    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );
    act(() => fb.listener?.(null));
    expect(fb.clear).toHaveBeenCalled();
  });
});

describe('parseClaims', () => {
  it('keeps the schools map and super flag', () => {
    expect(parseClaims({ schools: { s1: { r: 'a', t: 'T1' }, s2: { r: 't', t: 'T2' } }, super: true, iss: 'x' })).toEqual({
      schools: { s1: { r: 'a', t: 'T1' }, s2: { r: 't', t: 'T2' } },
      super: true,
    });
  });

  it('drops malformed memberships and old single-school claims', () => {
    expect(parseClaims({ sid: 's1', role: 'admin', tid: 'T1' })).toEqual({});
    expect(parseClaims({ schools: { s1: { r: 'x' }, s2: 'a', s3: { r: 't', t: 5 }, s4: { r: 'a' } } })).toEqual({
      schools: { s3: { r: 't' }, s4: { r: 'a' } },
    });
    expect(parseClaims({ schools: ['s1'], super: 'yes' })).toEqual({});
  });
});
