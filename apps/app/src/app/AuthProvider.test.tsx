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

const { AuthProvider, useAuth } = await import('./AuthProvider');

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
