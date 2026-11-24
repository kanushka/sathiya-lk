// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims, Membership } from '@sathiya/core';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearSessionPasswords } from '../features/teachers/sessionPasswords';
import { auth } from '../lib/firebase';

export interface AuthState {
  user: User | null;
  claims: Claims;
  loading: boolean;
  refreshClaims(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function pickMembership(raw: unknown): Membership | null {
  if (!raw || typeof raw !== 'object') return null;
  const { r, t } = raw as { r?: unknown; t?: unknown };
  if (r !== 'a' && r !== 't') return null;
  return typeof t === 'string' && t ? { r, t } : { r };
}

export function parseClaims(raw: Record<string, unknown>): Claims {
  const claims: Claims = {};
  if (raw.schools && typeof raw.schools === 'object' && !Array.isArray(raw.schools)) {
    const schools: Record<string, Membership> = {};
    for (const [sid, value] of Object.entries(raw.schools)) {
      const m = pickMembership(value);
      if (m) schools[sid] = m;
    }
    if (Object.keys(schools).length) claims.schools = schools;
  }
  if (raw.super === true) claims.super = true;
  return claims;
}

async function readClaims(user: User, force = false): Promise<Claims> {
  const token = await user.getIdTokenResult(force);
  return parseClaims(token.claims);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims>({});
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      onAuthStateChanged(auth, (next) => {
        setLoading(true);
        setUser(next);
        if (!next) {
          clearSessionPasswords();
          setClaims({});
          setLoading(false);
          return;
        }
        const stale = () => auth.currentUser !== next;
        readClaims(next)
          .then(
            (c) => {
              if (!stale()) setClaims(c);
            },
            () => {
              if (!stale()) setClaims({});
            },
          )
          .finally(() => {
            if (!stale()) setLoading(false);
          });
      }),
    [],
  );

  const refreshClaims = useCallback(async () => {
    const current = auth.currentUser;
    setClaims(current ? await readClaims(current, true) : {});
  }, []);

  const signOut = useCallback(async () => {
    clearSessionPasswords();
    await fbSignOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user, claims, loading, refreshClaims, signOut }),
    [user, claims, loading, refreshClaims, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthContextProvider({ value, children }: { value: AuthState; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
