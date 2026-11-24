// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fb = vi.hoisted(() => ({
  listener: null as null | ((u: unknown) => void),
  signOut: vi.fn(async () => undefined),
}));

const fbAuth = vi.hoisted(() => ({ currentUser: null as unknown }));
vi.mock('../lib/firebase', () => ({ auth: fbAuth }));
vi.mock('firebase/auth', () => ({
  onIdTokenChanged: (_auth: unknown, cb: (u: unknown) => void) => {
    fb.listener = cb;
    return () => undefined;
  },
  signOut: fb.signOut,
}));

const { AuthProvider, parseClaims, useAuth } = await import('./AuthProvider');

function SignOutButton() {
  const { signOut } = useAuth();
  return <button onClick={() => void signOut()}>out</button>;
}

beforeEach(() => {
  fb.signOut.mockClear();
});

describe('AuthProvider', () => {
  it('signs out through Firebase', async () => {
    render(
      <AuthProvider>
        <SignOutButton />
      </AuthProvider>,
    );
    await userEvent.setup().click(screen.getByText('out'));
    expect(fb.signOut).toHaveBeenCalled();
  });
});

function Probe() {
  const { claims, loading } = useAuth();
  return <output data-testid="auth">{JSON.stringify({ claims, loading })}</output>;
}

describe('token changes', () => {
  it('picks up new claims on a token refresh without a loading flash', async () => {
    let raw: Record<string, unknown> = {};
    const user = { uid: 'u1', getIdTokenResult: vi.fn(async () => ({ claims: raw })) };
    fbAuth.currentUser = user;
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await act(async () => fb.listener?.(user));
    expect(screen.getByTestId('auth')).toHaveTextContent('{"claims":{},"loading":false}');
    raw = { schools: { s1: { r: 't', t: 'T1' } } };
    const seen: string[] = [];
    const observer = new MutationObserver(() => seen.push(screen.getByTestId('auth').textContent ?? ''));
    observer.observe(screen.getByTestId('auth'), { childList: true, characterData: true, subtree: true });
    await act(async () => fb.listener?.(user));
    observer.disconnect();
    expect(screen.getByTestId('auth')).toHaveTextContent('{"claims":{"schools":{"s1":{"r":"t","t":"T1"}}},"loading":false}');
    expect(seen.some((s) => s.includes('"loading":true'))).toBe(false);
    fbAuth.currentUser = null;
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
