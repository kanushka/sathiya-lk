// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { orphanedEntries, toMinutes, type DayIndex, type Entry, type PeriodTemplate, type SchoolContext, type TemplateRow } from '@sathiya/core';

export const DAY_INDEXES: DayIndex[] = [0, 1, 2, 3, 4];

export interface TemplateDraft {
  name: string;
  mode: 'same' | 'perDay';
  rows: TemplateRow[];
  days?: Record<DayIndex, TemplateRow[]>;
}

export type ValidationCode = 'name' | 'empty' | 'noPeriod' | 'order' | 'overlap';
export interface ValidationError {
  code: ValidationCode;
  day: DayIndex | null;
  row: number | null;
}

function validateRows(rows: TemplateRow[], day: DayIndex | null): ValidationError[] {
  const out: ValidationError[] = [];
  if (!rows.some((r) => r.type === 'period')) out.push({ code: 'noPeriod', day, row: null });
  const validTime = (v: string) => /^\d\d:\d\d$/.test(v);
  rows.forEach((r, i) => {
    if (!validTime(r.start) || !validTime(r.end)) out.push({ code: 'empty', day, row: i });
    else if (toMinutes(r.start) >= toMinutes(r.end)) out.push({ code: 'order', day, row: i });
    else if (i > 0 && toMinutes(r.start) < toMinutes(rows[i - 1]!.end)) out.push({ code: 'overlap', day, row: i });
  });
  return out;
}

export function validateTemplate(draft: TemplateDraft): ValidationError[] {
  const out: ValidationError[] = [];
  if (draft.name.trim() === '') out.push({ code: 'name', day: null, row: null });
  if (draft.mode === 'same' || !draft.days) return [...out, ...validateRows(draft.rows, null)];
  for (const d of DAY_INDEXES) out.push(...validateRows(draft.days[d] ?? [], d));
  return out;
}

export function toPerDay(rows: TemplateRow[]): Record<DayIndex, TemplateRow[]> {
  const copy = () => rows.map((r) => ({ ...r }));
  return { 0: copy(), 1: copy(), 2: copy(), 3: copy(), 4: copy() };
}

export function toHhmm(minutes: number): string {
  const m = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function appendRow(rows: TemplateRow[], type: TemplateRow['type']): TemplateRow[] {
  const last = rows[rows.length - 1];
  const start = last ? toMinutes(last.end) : 7 * 60 + 45;
  return [...rows, { type, start: toHhmm(start), end: toHhmm(start + (type === 'period' ? 40 : 20)) }];
}

export function draftToTemplate(base: PeriodTemplate, draft: TemplateDraft): PeriodTemplate {
  const days = draft.mode === 'perDay' ? draft.days : undefined;
  const next: PeriodTemplate = { ...base, name: draft.name.trim(), mode: draft.mode, rows: days ? days[0] : draft.rows };
  if (days) next.days = days;
  else delete next.days;
  return next;
}

export function newlyOrphaned(entries: Entry[], ctx: SchoolContext, next: PeriodTemplate): number {
  const before = orphanedEntries(entries, ctx).length;
  const after = orphanedEntries(entries, { ...ctx, templates: ctx.templates.map((t) => (t.id === next.id ? next : t)) }).length;
  return Math.max(after - before, 0);
}

export function periodCount(rows: TemplateRow[]): number {
  return rows.filter((r) => r.type === 'period').length;
}
