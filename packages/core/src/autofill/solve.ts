// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { withTeacherIds } from '../clash';
import { classPlacement } from '../progress';
import type { Entry, EntryDraft, SchoolContext } from '../types';
import { allocate, type Allocation, type AllocationProblem } from './allocate';
import { place, type Unplaced, type UnplacedReason } from './place';
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

export function startOverDeletes(ctx: SchoolContext, entries: Entry[], gradeIds: string[]): string[] {
  const grades = new Set(gradeIds);
  const inScope = new Set(ctx.classes.filter((c) => grades.has(c.gradeId)).map((c) => c.id));
  return entries.filter((e) => e.classIds.some((c) => inScope.has(c))).map((e) => e.id);
}

const ALLOCATION_REASONS: ReadonlySet<string> = new Set<UnplacedReason>(['subject-cap', 'duplicate-option-teacher']);

function withProblems(ctx: SchoolContext, unplaced: Unplaced[], problems: AllocationProblem[]): Unplaced[] {
  const specific = new Map(problems.filter((p) => ALLOCATION_REASONS.has(p.reason)).map((p) => [`${p.classId}|${p.planKey}`, p.reason as UnplacedReason]));
  const out = unplaced.map((u): Unplaced => {
    const reason = u.params['reason'] === 'unallocated' ? specific.get(`${u.classId}|${u.planKey}`) : undefined;
    if (reason === undefined) return u;
    const { reason: _unallocated, ...params } = u.params;
    return { ...u, reason, params };
  });
  for (const p of problems) {
    if (p.reason !== 'class-teacher-no-daily-subject') continue;
    const teacherId = ctx.classes.find((c) => c.id === p.classId)?.classTeacherId;
    out.push({ classId: p.classId, planKey: p.planKey, missing: 0, unit: 'periods', reason: p.reason, params: teacherId === undefined ? {} : { teacherId } });
  }
  return out;
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
    deleteEntryIds = startOverDeletes(ctx, entries, mode.gradeIds);
  } else {
    classIds = ctx.classes.filter((c) => classPlacement(c, entries, ctx).rows.some((r) => r.placed < r.needed)).map((c) => c.id);
  }
  const removed = new Set(deleteEntryIds);
  const kept = entries.filter((e) => !removed.has(e.id));
  const avg = new Map(classIds.map((id) => [id, averagePeriodMinutes(ctx, id)]));

  let best: { tuple: ScoreTuple; soft: SoftReport; allocation: Allocation[]; problems: AllocationProblem[]; drafts: EntryDraft[]; unplaced: Unplaced[] } | null = null;
  let attempts = 0;
  for (;;) {
    const random = rng(seed + attempts);
    const { allocation, problems } = allocate({ ctx, entries: kept, classIds, overrides: input.overrides, random });
    const { drafts, unplaced } = place({ ctx, kept, allocation, classIds, random, stepBudget: STEP_BUDGET, deadline: start + (attempts === 0 ? Math.max(budgetMs, FIRST_ATTEMPT_CAP_MS) : budgetMs), now });
    const missing = unplaced.reduce((n, u) => n + (u.unit === 'minutes' ? Math.ceil(u.missing / (avg.get(u.classId) ?? 1)) : u.missing), 0);
    const placedEntries: Entry[] = drafts.map((d, i) => ({ ...withTeacherIds(d), id: `solve-${attempts}-${i}` }));
    const { tuple, soft } = score(ctx, [...kept, ...placedEntries], missing);
    if (best === null || compareScore(tuple, best.tuple) < 0) best = { tuple, soft, allocation, problems, drafts, unplaced };
    attempts += 1;
    input.onProgress?.({ attempt: attempts, best: [...best.tuple] });
    if (best.tuple.every((v) => v === 0) || now() - start >= budgetMs) break;
  }
  return { allocation: best.allocation, drafts: best.drafts, deleteEntryIds, unplaced: withProblems(ctx, best.unplaced, best.problems), soft: best.soft, seed, attempts };
}
