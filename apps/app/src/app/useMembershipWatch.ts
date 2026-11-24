// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { membershipOf, paths } from '@sathiya/core';
import { doc, onSnapshot } from 'firebase/firestore';
import { useEffect } from 'react';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';

export const MEMBERSHIP_RETRY_MS = 3000;

// An unlinked account keeps its old ID token (and claims) for up to an hour; this ends access as soon as the member doc goes.
// The server syncs claims after it deletes the member doc, so the first refresh can still carry the school: retry once, then sign out.
export function useMembershipWatch(sid: string | null): void {
  const { user, claims, refreshClaims, signOut } = useAuth();
  const uid = user?.uid ?? null;
  const member = !!sid && !!membershipOf(claims, sid);

  useEffect(() => {
    if (!sid || !uid || !member) return;
    let handled = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const leave = () => void signOut().catch(() => undefined);
    const stillMember = async () => !!membershipOf(await refreshClaims(), sid);
    const check = async () => {
      if (!(await stillMember()) || cancelled) return;
      timer = setTimeout(() => {
        stillMember().then(
          (still) => !cancelled && still && leave(),
          () => !cancelled && leave(),
        );
      }, MEMBERSHIP_RETRY_MS);
    };
    const unsub = onSnapshot(
      doc(db, `${paths.members(sid)}/${uid}`),
      (snap) => {
        if (snap.exists() || snap.metadata.fromCache || handled) return;
        handled = true;
        check().catch(() => !cancelled && leave());
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsub();
    };
  }, [sid, uid, member, refreshClaims, signOut]);
}
