// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthProvider';

export function useRefreshClaimsOnce(enabled: boolean): boolean {
  const { refreshClaims } = useAuth();
  const tried = useRef(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!enabled || tried.current) return;
    tried.current = true;
    refreshClaims()
      .catch(() => undefined)
      .finally(() => setDone(true));
  }, [enabled, refreshClaims]);
  return done;
}
