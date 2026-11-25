// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SolveInput, SolveResult } from '@sathiya/core';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export type SolverRequest = Omit<SolveInput, 'now' | 'onProgress'>;

export type SolverMessage =
  | { type: 'progress'; attempt: number; best: number[] }
  | { type: 'done'; result: SolveResult }
  | { type: 'error'; message: string };

export interface SolverWorker {
  postMessage(req: SolverRequest): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<SolverMessage>) => void) | null;
  onerror: ((e: ErrorEvent) => void) | null;
}

export const createSolverWorker = (): SolverWorker => new Worker(new URL('./solver.worker.ts', import.meta.url), { type: 'module' });

export const SolverWorkerContext = createContext<() => SolverWorker>(createSolverWorker);

export type SolverState = 'idle' | 'running' | 'done' | 'error';

export interface UseSolver {
  run(input: SolverRequest): void;
  cancel(): void;
  state: SolverState;
  progress: { attempt: number; best: number[] } | null;
  result: SolveResult | null;
  error: string | null;
}

export function useSolver(): UseSolver {
  const factory = useContext(SolverWorkerContext);
  const worker = useRef<SolverWorker | null>(null);
  const [state, setState] = useState<SolverState>('idle');
  const [progress, setProgress] = useState<UseSolver['progress']>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    const w = worker.current;
    worker.current = null;
    if (w) {
      w.onmessage = null;
      w.onerror = null;
      w.terminate();
    }
  }, []);

  const run = useCallback(
    (input: SolverRequest) => {
      stop();
      const w = factory();
      worker.current = w;
      setState('running');
      setProgress(null);
      setResult(null);
      setError(null);
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'progress') setProgress({ attempt: m.attempt, best: m.best });
        else if (m.type === 'done') {
          stop();
          setResult(m.result);
          setState('done');
        } else {
          stop();
          setError(m.message);
          setState('error');
        }
      };
      w.onerror = (e) => {
        stop();
        setError(e.message || 'worker error');
        setState('error');
      };
      w.postMessage(input);
    },
    [factory, stop],
  );

  const cancel = useCallback(() => {
    stop();
    setState('idle');
    setProgress(null);
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { run, cancel, state, progress, result, error };
}
