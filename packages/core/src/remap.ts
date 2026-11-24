// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { periodsFor, toMinutes, windowOf } from './time';
import type { Entry, PeriodTemplate } from './types';

export interface RemapResult { moves: Array<{ entryId: string; period: number }>; blocked: Entry[] }

// Entries already outside the old template are left alone; they are orphans before and after.
export function remapEntries(before: PeriodTemplate, after: PeriodTemplate, entries: Entry[], classIds: string[]): RemapResult {
  const wanted = new Set(classIds);
  const moves: RemapResult['moves'] = [];
  const blocked: Entry[] = [];
  for (const e of entries) {
    if (!e.classIds.some((id) => wanted.has(id))) continue;
    const from = windowOf(before, e.day, e.period);
    if (!from) continue;
    const to = periodsFor(after, e.day).find((p) => toMinutes(p.start) === from.start);
    if (!to) blocked.push(e);
    else if (to.period !== e.period) moves.push({ entryId: e.id, period: to.period });
  }
  return { moves, blocked };
}
