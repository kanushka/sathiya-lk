import { toMinutes } from './time';
import type { DayIndex, Hhmm, TemplateRow } from './types';
import type { SnapshotCell } from './publish';

export function currentAndNext(
  cells: SnapshotCell[],
  rows: Record<DayIndex, TemplateRow[]>,
  now: Date,
): { day: DayIndex | null; current?: SnapshotCell | { free: true; start: Hhmm; end: Hhmm }; next?: SnapshotCell; minutesLeft?: number } {
  const weekday = now.getDay();
  if (weekday === 0 || weekday === 6) return { day: null };
  const day = (weekday - 1) as DayIndex;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const covers = (x: { start: Hhmm; end: Hhmm }) => toMinutes(x.start) <= minutes && minutes < toMinutes(x.end);
  const today = cells.filter((c) => c.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  const cell = today.find(covers);
  const row = cell ? undefined : (rows[day] ?? []).find((r) => r.type === 'period' && covers(r));
  const current = cell ?? (row && { free: true as const, start: row.start, end: row.end });
  const minutesLeft = current && toMinutes(current.end) - minutes;
  const after = current ? toMinutes(current.end) : minutes;
  const next = today.find((c) => toMinutes(c.start) >= after);
  return { day, ...(current && { current, minutesLeft }), ...(next && { next }) };
}
