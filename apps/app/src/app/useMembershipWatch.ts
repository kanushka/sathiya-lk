// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { membershipOf, paths } from '@sathiya/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';

// An unlinked account keeps its old ID token (and claims) for up to an hour; this ends access as soon as the member doc goes.
export function useMembershipWatch(sid: string | null): void {
  const { user, claims, refreshClaims, signOut } = useAuth();
  const uid = user?.uid ?? null;
  const member = !!sid && !!membershipOf(claims, sid);

  useEffect(() => {
    if (!sid || !uid || !member) return;
    let handled = false;
    return onSnapshot(
      doc(db, `${paths.members(sid)}/${uid}`),
      (snap) => {
        if (snap.exists() || snap.metadata.fromCache || handled) return;
        handled = true;
        refreshClaims().catch(() => signOut().catch(() => undefined));
      },
      () => undefined,
    );
  }, [sid, uid, member, refreshClaims, signOut]);
}
