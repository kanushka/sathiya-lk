import { useCallback, useState } from 'react';
import { ApiError, call } from '../../lib/callable';

export type SetupItemKind = 'teacher' | 'subject' | 'class' | 'template';

export type DeleteOutcome = 'deleted' | 'in-use' | 'error';

export interface DeleteSetupItem {
  run: (schoolId: string, kind: SetupItemKind, id: string) => Promise<DeleteOutcome>;
  pending: boolean;
  usedIn: number | null;
  failed: boolean;
  reset: () => void;
}

export function useDeleteSetupItem(): DeleteSetupItem {
  const [pending, setPending] = useState(false);
  const [usedIn, setUsedIn] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const run = useCallback(async (schoolId: string, kind: SetupItemKind, id: string): Promise<DeleteOutcome> => {
    setPending(true);
    setFailed(false);
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
      setFailed(true);
      return 'error';
    } finally {
      setPending(false);
    }
  }, []);

  const reset = useCallback(() => {
    setUsedIn(null);
    setFailed(false);
  }, []);

  return { run, pending, usedIn, failed, reset };
}
