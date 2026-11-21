import { periodsFor, toMinutes } from './time';
import type { DayIndex, Hhmm, PeriodTemplate, TemplateRow } from './types';
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
  const dayTemplate: PeriodTemplate = { id: '', name: '', isDefault: false, mode: 'same', rows: rows[day] };
  const row = periodsFor(dayTemplate, day).find((p) => minutes >= toMinutes(p.start) && minutes < toMinutes(p.end));
  const current = row && (today.find((c) => c.period === row.period) ?? { free: true as const, start: row.start, end: row.end });
  const minutesLeft = row && toMinutes(row.end) - minutes;
  const after = current ? toMinutes(current.end) : minutes;
  const next = today.find((c) => toMinutes(c.start) >= after);
  return { day, ...(current && { current, minutesLeft }), ...(next && { next }) };
}
