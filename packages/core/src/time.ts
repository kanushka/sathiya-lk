// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, Hhmm, PeriodTemplate, TemplateRow } from './types';

export function toMinutes(t: Hhmm): number {
  const [h, m] = t.split(':');
  return Number(h) * 60 + Number(m);
}

export function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end;
}

export function rowsFor(t: PeriodTemplate, day: DayIndex): TemplateRow[] {
  if (t.mode === 'perDay') return t.days?.[day] ?? t.rows;
  return t.rows;
}

export function periodsFor(t: PeriodTemplate, day: DayIndex): Array<{ period: number; start: Hhmm; end: Hhmm }> {
  const out: Array<{ period: number; start: Hhmm; end: Hhmm }> = [];
  for (const row of rowsFor(t, day)) {
    if (row.type === 'period') out.push({ period: out.length + 1, start: row.start, end: row.end });
  }
  return out;
}

export function windowOf(t: PeriodTemplate, day: DayIndex, period: number): { start: number; end: number } | null {
  const p = periodsFor(t, day).find((x) => x.period === period);
  return p ? { start: toMinutes(p.start), end: toMinutes(p.end) } : null;
}

export function bestOverlapPeriod(t: PeriodTemplate, day: DayIndex, window: { start: number; end: number }): number | null {
  let best: number | null = null;
  let bestOverlap = 0;
  for (const p of periodsFor(t, day)) {
    const overlap = Math.min(window.end, toMinutes(p.end)) - Math.max(window.start, toMinutes(p.start));
    if (overlap > bestOverlap) {
      best = p.period;
      bestOverlap = overlap;
    }
  }
  return best;
}
