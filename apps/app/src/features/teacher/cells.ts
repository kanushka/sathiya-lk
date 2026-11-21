import type { DayIndex, Hhmm, Lang, SnapshotCell, TeacherSnapshot, TemplateRow } from '@sathiya/core';

export function cellText(cell: SnapshotCell, lang: Lang): { title: string; sub: string } {
  return {
    title: (lang === 'si' && cell.titleSi) || cell.title,
    sub: (lang === 'si' && cell.subSi) || cell.sub,
  };
}

export function clock(t: Hhmm): string {
  return t.replace(/^0/, '');
}

export interface RowSlot {
  kind: 'period' | 'interval';
  n: number;
  row: TemplateRow;
}

export function slotsOf(rows: TemplateRow[]): RowSlot[] {
  let n = 0;
  return rows.map((row) => (row.type === 'period' ? { kind: 'period', n: ++n, row } : { kind: 'interval', n: 0, row }));
}

export type SkeletonRow = { kind: 'period'; n: number; start?: Hhmm } | { kind: 'interval'; start?: Hhmm; end?: Hhmm };

export function weekSkeleton(rows: Record<DayIndex, TemplateRow[]>): SkeletonRow[] {
  const perDay = weekdays.map((d) => slotsOf(rows[d]));
  const count = Math.max(0, ...perDay.map((s) => s.filter((x) => x.kind === 'period').length));
  const out: SkeletonRow[] = [];
  const same = <T,>(vals: T[]): T | undefined => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0] : undefined);
  for (let n = 1; n <= count; n++) {
    const starts = perDay.flatMap((s) => s.filter((x) => x.kind === 'period' && x.n === n).map((x) => x.row.start));
    const start = same(starts);
    out.push(start === undefined ? { kind: 'period', n } : { kind: 'period', n, start });
    const intervals = perDay.flatMap((s) => {
      const i = s.findIndex((x) => x.kind === 'period' && x.n === n);
      const after = i >= 0 ? s[i + 1] : undefined;
      return after?.kind === 'interval' ? [after.row] : [];
    });
    if (intervals.length > 0) {
      const start = same(intervals.map((r) => r.start));
      const end = same(intervals.map((r) => r.end));
      out.push({ kind: 'interval', ...(start && end ? { start, end } : {}) });
    }
  }
  return out;
}

export function cellsAt(snap: TeacherSnapshot, day: DayIndex, period: number): SnapshotCell[] {
  return snap.cells.filter((c) => c.day === day && c.period === period);
}

export const weekdays: DayIndex[] = [0, 1, 2, 3, 4];
