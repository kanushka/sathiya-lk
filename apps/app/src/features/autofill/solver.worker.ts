// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { solve } from '@sathiya/core';
import type { SolverMessage, SolverRequest } from './useSolver';

const BUDGET_MS = 8000;

export function handleSolve(req: SolverRequest, post: (m: SolverMessage) => void): void {
  try {
    const result = solve({
      ...req,
      budgetMs: req.budgetMs ?? BUDGET_MS,
      now: Date.now,
      onProgress: (p) => post({ type: 'progress', attempt: p.attempt, best: p.best }),
    });
    post({ type: 'done', result });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
}

export function trustedOrigin(origin: string, own: string): boolean {
  return origin === '' || origin === own;
}

self.onmessage = (e: MessageEvent<SolverRequest>) => {
  if (!trustedOrigin(e.origin, self.location.origin)) return;
  handleSolve(e.data, (m) => self.postMessage(m));
};
