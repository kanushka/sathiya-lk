// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { toMinutes, type DayIndex, type PeriodTemplate, type TemplatePatch, type TemplateRow } from '@sathiya/core';

export { DAY_INDEXES, validateTemplate, type ValidationCode, type ValidationError } from '@sathiya/core';

export type TemplateDraft = TemplatePatch;

export function toPerDay(rows: TemplateRow[]): Record<DayIndex, TemplateRow[]> {
  const copy = () => rows.map((r) => ({ ...r }));
  return { 0: copy(), 1: copy(), 2: copy(), 3: copy(), 4: copy() };
}

export function toHhmm(minutes: number): string {
  const m = Math.min(Math.max(minutes, 0), 23 * 60 + 59);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function appendRow(rows: TemplateRow[], type: TemplateRow['type']): TemplateRow[] {
  return insertRow(rows, rows.length, type);
}

const HHMM = /^\d\d:\d\d$/;
export const DEFAULT_DAY_START = '07:45';
export const MINUTES_STEP = 5;
const DEFAULT_MINUTES: Record<TemplateRow['type'], number> = { period: 40, interval: 20, activity: 20 };

export function rowMinutes(r: TemplateRow): number {
  if (!HHMM.test(r.start) || !HHMM.test(r.end)) return DEFAULT_MINUTES[r.type];
  return Math.max(toMinutes(r.end) - toMinutes(r.start), MINUTES_STEP);
}

export function dayStart(rows: TemplateRow[]): string {
  const first = rows[0]?.start;
  return first && HHMM.test(first) ? first : DEFAULT_DAY_START;
}

export function hasGaps(rows: TemplateRow[]): boolean {
  return rows.some((r, i) => i > 0 && HHMM.test(r.start) && HHMM.test(rows[i - 1]!.end) && toMinutes(r.start) > toMinutes(rows[i - 1]!.end));
}

function fillGaps(rows: TemplateRow[]): TemplateRow[] {
  return rows.flatMap((r, i) => {
    const prev = rows[i - 1];
    if (prev && HHMM.test(r.start) && HHMM.test(prev.end) && toMinutes(r.start) > toMinutes(prev.end)) {
      return [{ type: 'interval' as const, start: prev.end, end: r.start }, r];
    }
    return [r];
  });
}

function layout(start: string, rows: TemplateRow[], minutes: number[]): TemplateRow[] {
  let t = toMinutes(start);
  return rows.map((r, i) => {
    const s = t;
    t += minutes[i]!;
    return { ...r, start: toHhmm(s), end: toHhmm(t) };
  });
}

function edit(rows: TemplateRow[], fn: (rows: TemplateRow[], minutes: number[]) => void, start = dayStart(rows)): TemplateRow[] {
  const next = fillGaps(rows);
  const minutes = next.map(rowMinutes);
  fn(next, minutes);
  return layout(start, next, minutes);
}

export const setDayStart = (rows: TemplateRow[], start: string) => edit(rows, () => undefined, start);

export const setRowMinutes = (rows: TemplateRow[], i: number, minutes: number) =>
  edit(rows, (_, m) => {
    m[i] = Math.min(Math.max(Math.round(minutes), MINUTES_STEP), 240);
  });

export const moveRow = (rows: TemplateRow[], from: number, to: number) =>
  edit(rows, (r, m) => {
    if (to < 0 || to >= r.length || from === to) return;
    r.splice(to, 0, ...r.splice(from, 1));
    m.splice(to, 0, ...m.splice(from, 1));
  });

export const insertRow = (rows: TemplateRow[], at: number, type: TemplateRow['type']) =>
  edit(rows, (r, m) => {
    r.splice(at, 0, { type, start: DEFAULT_DAY_START, end: DEFAULT_DAY_START });
    m.splice(at, 0, DEFAULT_MINUTES[type]);
  });

export const removeRow = (rows: TemplateRow[], i: number) =>
  edit(rows, (r, m) => {
    r.splice(i, 1);
    m.splice(i, 1);
  });

export function draftToTemplate(base: PeriodTemplate, draft: TemplateDraft): PeriodTemplate {
  const days = draft.mode === 'perDay' ? draft.days : undefined;
  const next: PeriodTemplate = { ...base, name: draft.name.trim(), mode: draft.mode, rows: days ? days[0] : draft.rows };
  if (days) next.days = days;
  else delete next.days;
  return next;
}

export function periodCount(rows: TemplateRow[]): number {
  return rows.filter((r) => r.type === 'period').length;
}
