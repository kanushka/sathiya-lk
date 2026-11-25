// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { DAYS, findClass, templateOf } from '../lookup';
import { rowsFor, toMinutes } from '../time';
import type { DayIndex, SchoolContext } from '../types';

export interface Slot {
  classId: string;
  day: DayIndex;
  period: number;
  start: number;
  end: number;
  minutes: number;
  first: boolean;
  nextPeriod: number | null;
}

export function classSlots(ctx: SchoolContext, classId: string): Slot[] {
  const cls = findClass(ctx, classId);
  const tpl = cls && templateOf(ctx, cls);
  if (!tpl) return [];
  const out: Slot[] = [];
  for (const day of DAYS) {
    const rows = rowsFor(tpl, day);
    let period = 0;
    rows.forEach((row, i) => {
      if (row.type !== 'period') return;
      period += 1;
      const start = toMinutes(row.start);
      const end = toMinutes(row.end);
      out.push({ classId, day, period, start, end, minutes: end - start, first: period === 1, nextPeriod: rows[i + 1]?.type === 'period' ? period + 1 : null });
    });
  }
  return out;
}
