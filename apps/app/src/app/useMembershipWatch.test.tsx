// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Claims } from '@sathiya/core';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Snap = { exists(): boolean; metadata: { fromCache: boolean } };

const state = vi.hoisted(() => ({
  claims: {} as Claims,
  user: { uid: 'u1' } as { uid: string } | null,
  refreshClaims: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  listeners: [] as { path: string; next: (s: Snap) => void; unsub: ReturnType<typeof vi.fn> }[],
}));

vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, path: string) => ({ path }),
  onSnapshot: (ref: { path: string }, next: (s: Snap) => void) => {
    const unsub = vi.fn();
    state.listeners.push({ path: ref.path, next, unsub });
    return unsub;
  },
}));
vi.mock('./AuthProvider', () => ({
  useAuth: () => ({ user: state.user, claims: state.claims, refreshClaims: state.refreshClaims, signOut: state.signOut }),
}));

const { useMembershipWatch } = await import('./useMembershipWatch');

const snap = (exists: boolean, fromCache = false): Snap => ({ exists: () => exists, metadata: { fromCache } });

beforeEach(() => {
  state.claims = { schools: { s1: { r: 't', t: 'T1' } } };
  state.user = { uid: 'u1' };
  state.refreshClaims.mockReset().mockResolvedValue(undefined);
  state.signOut.mockReset().mockResolvedValue(undefined);
  state.listeners.length = 0;
});

describe('useMembershipWatch', () => {
  it('watches the signed-in user’s own member doc of the school', () => {
    renderHook(() => useMembershipWatch('s1'));
    expect(state.listeners.map((l) => l.path)).toEqual(['schools/s1/members/u1']);
  });

  it('refreshes claims once when the member doc disappears', async () => {
    renderHook(() => useMembershipWatch('s1'));
    const { next } = state.listeners[0]!;
    next(snap(true));
    expect(state.refreshClaims).not.toHaveBeenCalled();
    next(snap(false));
    next(snap(false));
    await waitFor(() => expect(state.refreshClaims).toHaveBeenCalledTimes(1));
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it('ignores a missing doc that only comes from the cache', () => {
    renderHook(() => useMembershipWatch('s1'));
    state.listeners[0]!.next(snap(false, true));
    expect(state.refreshClaims).not.toHaveBeenCalled();
  });

  it('signs out when the claims refresh fails', async () => {
    state.refreshClaims.mockRejectedValue(new Error('auth/user-token-expired'));
    renderHook(() => useMembershipWatch('s1'));
    state.listeners[0]!.next(snap(false));
    await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(1));
  });

  it('does not watch without a school, a user, or a membership in the claims', () => {
    renderHook(() => useMembershipWatch(null));
    state.claims = { super: true };
    renderHook(() => useMembershipWatch('s1'));
    state.claims = { schools: { s1: { r: 'a' } } };
    state.user = null;
    renderHook(() => useMembershipWatch('s1'));
    expect(state.listeners).toHaveLength(0);
  });

  it('stops listening on unmount', () => {
    const { unmount } = renderHook(() => useMembershipWatch('s1'));
    unmount();
    expect(state.listeners[0]!.unsub).toHaveBeenCalled();
  });
});
