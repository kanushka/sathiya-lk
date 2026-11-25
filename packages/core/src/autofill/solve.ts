// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { withTeacherIds } from '../clash';
import { classPlacement } from '../progress';
import type { Entry, EntryDraft, SchoolContext } from '../types';
import { allocate, type Allocation } from './allocate';
import { place, type Unplaced } from './place';
import { rng } from './rng';
import { compareScore, score, type ScoreTuple, type SoftReport } from './score';
import { classSlots } from './slots';

export type FillMode = { kind: 'fillAround' } | { kind: 'startOver'; gradeIds: string[] };

export interface SolveInput {
  ctx: SchoolContext;
  entries: Entry[];
  mode: FillMode;
  seed: number;
  budgetMs?: number;
  overrides?: Allocation[];
  now?: () => number;
  onProgress?: (p: { attempt: number; best: number[] }) => void;
}

export interface SolveResult {
  allocation: Allocation[];
  drafts: EntryDraft[];
  deleteEntryIds: string[];
  unplaced: Unplaced[];
  soft: SoftReport;
  seed: number;
  attempts: number;
}

const DEFAULT_BUDGET_MS = 8000;
const STEP_BUDGET = 2000;
const FIRST_ATTEMPT_CAP_MS = 30000;

function averagePeriodMinutes(ctx: SchoolContext, classId: string): number {
  const slots = classSlots(ctx, classId);
  return slots.length === 0 ? 1 : slots.reduce((n, s) => n + s.minutes, 0) / slots.length;
}

export function solve(input: SolveInput): SolveResult {
  const { ctx, entries, mode, seed } = input;
  const now = input.now ?? Date.now;
  const budgetMs = input.budgetMs ?? DEFAULT_BUDGET_MS;
  const start = now();

  let deleteEntryIds: string[] = [];
  let classIds: string[];
  if (mode.kind === 'startOver') {
    const gradeIds = new Set(mode.gradeIds);
    classIds = ctx.classes.filter((c) => gradeIds.has(c.gradeId)).map((c) => c.id);
    const inScope = new Set(classIds);
    deleteEntryIds = entries.filter((e) => e.classIds.some((c) => inScope.has(c))).map((e) => e.id);
  } else {
    classIds = ctx.classes.filter((c) => classPlacement(c, entries, ctx).rows.some((r) => r.placed < r.needed)).map((c) => c.id);
  }
  const removed = new Set(deleteEntryIds);
  const kept = entries.filter((e) => !removed.has(e.id));
  const avg = new Map(classIds.map((id) => [id, averagePeriodMinutes(ctx, id)]));

  let best: { tuple: ScoreTuple; soft: SoftReport; allocation: Allocation[]; drafts: EntryDraft[]; unplaced: Unplaced[] } | null = null;
  let attempts = 0;
  for (;;) {
    const random = rng(seed + attempts);
    const { allocation } = allocate({ ctx, entries: kept, classIds, overrides: input.overrides, random });
    const { drafts, unplaced } = place({ ctx, kept, allocation, classIds, random, stepBudget: STEP_BUDGET, deadline: start + (attempts === 0 ? Math.max(budgetMs, FIRST_ATTEMPT_CAP_MS) : budgetMs), now });
    const missing = unplaced.reduce((n, u) => n + (u.unit === 'minutes' ? Math.ceil(u.missing / (avg.get(u.classId) ?? 1)) : u.missing), 0);
    const placedEntries: Entry[] = drafts.map((d, i) => ({ ...withTeacherIds(d), id: `solve-${attempts}-${i}` }));
    const { tuple, soft } = score(ctx, [...kept, ...placedEntries], missing);
    if (best === null || compareScore(tuple, best.tuple) < 0) best = { tuple, soft, allocation, drafts, unplaced };
    attempts += 1;
    input.onProgress?.({ attempt: attempts, best: [...best.tuple] });
    if (best.tuple.every((v) => v === 0) || now() - start >= budgetMs) break;
  }
  return { allocation: best.allocation, drafts: best.drafts, deleteEntryIds, unplaced: best.unplaced, soft: best.soft, seed, attempts };
}
