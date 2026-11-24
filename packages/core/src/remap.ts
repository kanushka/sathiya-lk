// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { bestOverlapPeriod, overlaps, rowsFor, toMinutes, windowOf } from './time';
import type { Entry, PeriodTemplate } from './types';

export interface RemapResult { moves: Array<{ entryId: string; period: number }>; blocked: Entry[]; orphaned: Entry[] }

// An entry follows the period it overlaps most. One that now sits only on an activity or interval, or whose
// time overlaps no period while its old number still exists (a removed middle period), is blocked;
// one past the new last period is orphaned.
export function remapEntries(before: PeriodTemplate, after: PeriodTemplate, entries: Entry[], classIds: string[]): RemapResult {
  const wanted = new Set(classIds);
  const landed: Array<{ entry: Entry; period: number; move: boolean }> = [];
  const blocked = new Set<Entry>();
  for (const e of entries) {
    if (!e.classIds.some((id) => wanted.has(id))) continue;
    const from = windowOf(before, e.day, e.period);
    if (!from) continue;
    const best = bestOverlapPeriod(after, e.day, from);
    if (best !== null) landed.push({ entry: e, period: best, move: best !== e.period });
    else if (rowsFor(after, e.day).some((r) => r.type !== 'period' && /^\d\d:\d\d$/.test(r.start) && overlaps(from, { start: toMinutes(r.start), end: toMinutes(r.end) }))) blocked.add(e);
    else if (windowOf(after, e.day, e.period)) blocked.add(e);
    else landed.push({ entry: e, period: e.period, move: false });
  }

  // Merged periods can put two entries in one slot; block every pair from different old periods sharing a class or teacher there.
  const shares = (a: Entry, b: Entry) => a.classIds.some((c) => b.classIds.includes(c)) || a.teacherIds.some((t) => b.teacherIds.includes(t));
  landed.forEach((x, i) => {
    for (const y of landed.slice(i + 1)) {
      if (x.entry.day === y.entry.day && x.period === y.period && x.entry.period !== y.entry.period && shares(x.entry, y.entry)) {
        blocked.add(x.entry);
        blocked.add(y.entry);
      }
    }
  });

  const out: RemapResult = { moves: [], blocked: entries.filter((e) => blocked.has(e)), orphaned: [] };
  for (const l of landed) {
    if (blocked.has(l.entry)) continue;
    if (l.move) out.moves.push({ entryId: l.entry.id, period: l.period });
    else if (!windowOf(after, l.entry.day, l.period)) out.orphaned.push(l.entry);
  }
  return out;
}
