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

export function periodCount(rows: TemplateRow[]): number {
  return rows.filter((r) => r.type === 'period').length;
}
