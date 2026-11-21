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
  const today = cells.filter((c) => c.day === day).sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
  let period = 0;
  let current: SnapshotCell | { free: true; start: Hhmm; end: Hhmm } | undefined;
  let minutesLeft: number | undefined;
  for (const row of rows[day]) {
    if (row.type !== 'period') continue;
    period += 1;
    if (minutes >= toMinutes(row.start) && minutes < toMinutes(row.end)) {
      current = today.find((c) => c.period === period) ?? { free: true, start: row.start, end: row.end };
      minutesLeft = toMinutes(row.end) - minutes;
      break;
    }
  }
  const after = current ? toMinutes(current.end) : minutes;
  const next = today.find((c) => toMinutes(c.start) >= after);
  return { day, ...(current && { current, minutesLeft }), ...(next && { next }) };
}
