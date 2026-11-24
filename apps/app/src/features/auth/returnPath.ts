// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { claimInvites } from './api';

export function returnPathFrom(state: unknown): string | null {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null)?.from;
  if (typeof from?.pathname !== 'string' || !from.pathname.startsWith('/') || from.pathname.startsWith('//')) return null;
  return from.pathname + (typeof from.search === 'string' ? from.search : '');
}

export function useFinishSignIn(): () => Promise<void> {
  const { refreshClaims } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  return useCallback(async () => {
    try {
      await claimInvites();
    } catch {
      // Invites are optional; sign-in already succeeded.
    }
    try {
      await refreshClaims();
    } catch {
      // Signed in; HomeRedirect decides from whatever claims are loaded.
    }
    navigate(returnPathFrom(state) ?? '/', { replace: true });
  }, [refreshClaims, navigate, state]);
}
