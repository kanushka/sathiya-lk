// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { toMinutes } from './time';
import type { DayIndex, TemplateRow } from './types';

export const DAY_INDEXES: DayIndex[] = [0, 1, 2, 3, 4];

export interface TemplatePatch {
  name: string;
  mode: 'same' | 'perDay';
  rows: TemplateRow[];
  days?: Record<DayIndex, TemplateRow[]>;
}

export type ValidationCode = 'name' | 'empty' | 'noPeriod' | 'order' | 'overlap' | 'activityName';
export interface ValidationError {
  code: ValidationCode;
  day: DayIndex | null;
  row: number | null;
}

function validateRows(rows: TemplateRow[], day: DayIndex | null): ValidationError[] {
  const out: ValidationError[] = [];
  if (!rows.some((r) => r.type === 'period')) out.push({ code: 'noPeriod', day, row: null });
  const validTime = (v: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
  rows.forEach((r, i) => {
    if (!validTime(r.start) || !validTime(r.end)) out.push({ code: 'empty', day, row: i });
    else if (toMinutes(r.start) >= toMinutes(r.end)) out.push({ code: 'order', day, row: i });
    else if (i > 0 && toMinutes(r.start) < toMinutes(rows[i - 1]!.end)) out.push({ code: 'overlap', day, row: i });
    if (r.type === 'activity' && !r.nameEn?.trim() && !r.nameSi?.trim()) out.push({ code: 'activityName', day, row: i });
  });
  return out;
}

export function validateTemplate(draft: TemplatePatch): ValidationError[] {
  const out: ValidationError[] = [];
  if (draft.name.trim() === '') out.push({ code: 'name', day: null, row: null });
  if (draft.mode === 'same' || !draft.days) return [...out, ...validateRows(draft.rows, null)];
  for (const d of DAY_INDEXES) out.push(...validateRows(draft.days[d] ?? [], d));
  return out;
}
