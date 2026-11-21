// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useRef, useState } from 'react';
import { actionErrorKey, type ActionErrorKey } from './actionErrors';

export type ActionState<T> =
  | { status: 'loading' }
  | { status: 'done'; value: T }
  | { status: 'error'; error: ActionErrorKey };

// One-time codes are consumed on use, so the call must not repeat (StrictMode, re-render).
export function useActionCode<T>(run: () => Promise<T>): ActionState<T> {
  const [state, setState] = useState<ActionState<T>>({ status: 'loading' });
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    run().then(
      (value) => setState({ status: 'done', value }),
      (err: unknown) => setState({ status: 'error', error: actionErrorKey(err) }),
    );
  }, [run]);
  return state;
}
