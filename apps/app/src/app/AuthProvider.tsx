// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { Claims, Membership } from '@sathiya/core';
import { onIdTokenChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { auth } from '../lib/firebase';

export interface AuthState {
  user: User | null;
  claims: Claims;
  loading: boolean;
  refreshClaims(): Promise<Claims>;
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

  const uidRef = useRef<string | null>(null);

  useEffect(
    () =>
      onIdTokenChanged(auth, (next) => {
        const sameUser = !!next && next.uid === uidRef.current;
        uidRef.current = next?.uid ?? null;
        setUser(next);
        if (!next) {
          setClaims({});
          setLoading(false);
          return;
        }
        if (!sameUser) setLoading(true);
        const stale = () => auth.currentUser !== next;
        readClaims(next)
          .then(
            (c) => {
              if (!stale()) setClaims(c);
            },
            () => {
              if (!stale() && !sameUser) setClaims({});
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
    const next = current ? await readClaims(current, true) : {};
    // Another user may have signed in while the token was in flight; their claims must not be replaced with these.
    if (auth.currentUser !== current) return {};
    setClaims(next);
    return next;
  }, []);

  const signOut = useCallback(async () => {
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
