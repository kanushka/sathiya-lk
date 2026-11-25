// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SolveResult } from '@sathiya/core';
import { mahasen } from '@sathiya/core/fixtures';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { handleSolve } from './solver.worker';
import { SolverWorkerContext, useSolver, type SolverMessage, type SolverRequest, type SolverWorker } from './useSolver';

class FakeWorker implements SolverWorker {
  posted: SolverRequest[] = [];
  terminated = false;
  onmessage: ((e: MessageEvent<SolverMessage>) => void) | null = null;
  onerror: ((e: ErrorEvent) => void) | null = null;
  postMessage(m: SolverRequest) {
    this.posted.push(m);
  }
  terminate() {
    this.terminated = true;
  }
  emit(m: SolverMessage) {
    act(() => this.onmessage?.({ data: m } as MessageEvent<SolverMessage>));
  }
}

const result: SolveResult = {
  allocation: [],
  drafts: [],
  deleteEntryIds: [],
  unplaced: [],
  soft: { samePattern: 1, splitDoubles: 0, minPerWeekShort: [], stacked: 0 },
  seed: 7,
  attempts: 3,
};

function setup() {
  const workers: FakeWorker[] = [];
  const factory = () => {
    const w = new FakeWorker();
    workers.push(w);
    return w;
  };
  const wrapper = ({ children }: { children: ReactNode }) => <SolverWorkerContext.Provider value={factory}>{children}</SolverWorkerContext.Provider>;
  const hook = renderHook(() => useSolver(), { wrapper });
  return { hook, workers };
}

const input: SolverRequest = { ctx: mahasen.ctx, entries: [], mode: { kind: 'fillAround' }, seed: 7 };

describe('useSolver', () => {
  it('posts input and returns result', () => {
    const { hook, workers } = setup();
    expect(hook.result.current.state).toBe('idle');
    act(() => hook.result.current.run(input));
    expect(hook.result.current.state).toBe('running');
    expect(workers).toHaveLength(1);
    expect(workers[0]!.posted).toEqual([input]);
    workers[0]!.emit({ type: 'progress', attempt: 2, best: [4, 0, 0, 0, 0] });
    expect(hook.result.current.progress).toEqual({ attempt: 2, best: [4, 0, 0, 0, 0] });
    workers[0]!.emit({ type: 'done', result });
    expect(hook.result.current.state).toBe('done');
    expect(hook.result.current.result).toEqual(result);
    expect(workers[0]!.terminated).toBe(true);
  });

  it('cancel terminates the worker', () => {
    const { hook, workers } = setup();
    act(() => hook.result.current.run(input));
    act(() => hook.result.current.cancel());
    expect(workers[0]!.terminated).toBe(true);
    expect(hook.result.current.state).toBe('idle');
    workers[0]!.emit({ type: 'done', result });
    expect(hook.result.current.result).toBeNull();
  });

  it('reports a solver error', () => {
    const { hook, workers } = setup();
    act(() => hook.result.current.run(input));
    workers[0]!.emit({ type: 'error', message: 'boom' });
    expect(hook.result.current.state).toBe('error');
    expect(hook.result.current.error).toBe('boom');
  });

  it('a new run replaces the running worker', () => {
    const { hook, workers } = setup();
    act(() => hook.result.current.run(input));
    act(() => hook.result.current.run({ ...input, seed: 8 }));
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.posted[0]!.seed).toBe(8);
  });

  it('terminates on unmount', () => {
    const { hook, workers } = setup();
    act(() => hook.result.current.run(input));
    hook.unmount();
    expect(workers[0]!.terminated).toBe(true);
  });
});

describe('handleSolve', () => {
  it('posts progress then the result', () => {
    const posted: SolverMessage[] = [];
    handleSolve({ ...input, budgetMs: 0 }, (m) => posted.push(m));
    expect(posted[0]).toMatchObject({ type: 'progress', attempt: 1 });
    const last = posted.at(-1)!;
    expect(last.type).toBe('done');
    if (last.type === 'done') expect(last.result.seed).toBe(7);
  });

  it('posts an error when solving throws', () => {
    const posted: SolverMessage[] = [];
    handleSolve({ ...input, ctx: null as never }, (m) => posted.push(m));
    expect(posted).toEqual([{ type: 'error', message: expect.any(String) }]);
  });
});
