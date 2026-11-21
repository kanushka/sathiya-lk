import type { Claims } from '@sathiya/core';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { auth } from '../lib/firebase';

export interface AuthState {
  user: User | null;
  claims: Claims;
  loading: boolean;
  refreshClaims(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function pickClaims(raw: Record<string, unknown>): Claims {
  const claims: Claims = {};
  if (typeof raw.sid === 'string') claims.sid = raw.sid;
  if (raw.role === 'admin' || raw.role === 'teacher') claims.role = raw.role;
  if (typeof raw.tid === 'string') claims.tid = raw.tid;
  if (raw.super === true) claims.super = true;
  return claims;
}

async function readClaims(user: User, force = false): Promise<Claims> {
  const token = await user.getIdTokenResult(force);
  return pickClaims(token.claims);
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
          setClaims({});
          setLoading(false);
          return;
        }
        readClaims(next)
          .then(setClaims, () => setClaims({}))
          .finally(() => setLoading(false));
      }),
    [],
  );

  const refreshClaims = useCallback(async () => {
    const current = auth.currentUser;
    setClaims(current ? await readClaims(current, true) : {});
  }, []);

  const signOut = useCallback(() => fbSignOut(auth), []);

  const value = useMemo(
    () => ({ user, claims, loading, refreshClaims, signOut }),
    [user, claims, loading, refreshClaims, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
