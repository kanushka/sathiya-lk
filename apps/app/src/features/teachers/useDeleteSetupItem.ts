// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useCallback, useState } from 'react';
import { ApiError, call, isSchoolDisabled } from '../../lib/callable';

export type SetupItemKind = 'teacher' | 'subject' | 'class' | 'template' | 'grade';

export type DeleteOutcome = 'deleted' | 'in-use' | 'error';

export interface DeleteSetupItem {
  run: (schoolId: string, kind: SetupItemKind, id: string) => Promise<DeleteOutcome>;
  pending: boolean;
  usedIn: number | null;
  failed: boolean;
  suspended: boolean;
  reset: () => void;
}

export function useDeleteSetupItem(): DeleteSetupItem {
  const [pending, setPending] = useState(false);
  const [usedIn, setUsedIn] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [suspended, setSuspended] = useState(false);

  const run = useCallback(async (schoolId: string, kind: SetupItemKind, id: string): Promise<DeleteOutcome> => {
    setPending(true);
    setFailed(false);
    setSuspended(false);
    try {
      const res = await call('deleteSetupItem', { schoolId, kind, id });
      if (res.deleted) return 'deleted';
      setUsedIn(res.usedIn);
      return 'in-use';
    } catch (err) {
      if (err instanceof ApiError && err.code === 'in-use') {
        const n = (err.details as { usedIn?: unknown } | undefined)?.usedIn;
        setUsedIn(typeof n === 'number' ? n : 0);
        return 'in-use';
      }
      setSuspended(isSchoolDisabled(err));
      setFailed(true);
      return 'error';
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUsedIn(null);
    setFailed(false);
    setSuspended(false);
  }, []);

  return { run, pending, usedIn, failed, suspended, reset };
}
