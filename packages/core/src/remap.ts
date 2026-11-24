// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { bestOverlapPeriod, overlaps, rowsFor, toMinutes, windowOf } from './time';
import type { Entry, PeriodTemplate } from './types';

export interface RemapResult { moves: Array<{ entryId: string; period: number }>; blocked: Entry[]; orphaned: Entry[] }

// An entry follows the period it overlaps most. One that now sits only on an activity or interval is blocked;
// one that overlaps nothing keeps its period number and is orphaned if that period no longer exists.
export function remapEntries(before: PeriodTemplate, after: PeriodTemplate, entries: Entry[], classIds: string[]): RemapResult {
  const wanted = new Set(classIds);
  const out: RemapResult = { moves: [], blocked: [], orphaned: [] };
  for (const e of entries) {
    if (!e.classIds.some((id) => wanted.has(id))) continue;
    const from = windowOf(before, e.day, e.period);
    if (!from) continue;
    const best = bestOverlapPeriod(after, e.day, from);
    if (best !== null) {
      if (best !== e.period) out.moves.push({ entryId: e.id, period: best });
    } else if (rowsFor(after, e.day).some((r) => r.type !== 'period' && /^\d\d:\d\d$/.test(r.start) && overlaps(from, { start: toMinutes(r.start), end: toMinutes(r.end) }))) {
      out.blocked.push(e);
    } else if (!windowOf(after, e.day, e.period)) {
      out.orphaned.push(e);
    }
  }
  return out;
}
