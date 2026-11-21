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

export function cellsAt(snap: TeacherSnapshot, day: DayIndex, period: number): SnapshotCell[] {
  return snap.cells.filter((c) => c.day === day && c.period === period);
}

export const weekdays: DayIndex[] = [0, 1, 2, 3, 4];
