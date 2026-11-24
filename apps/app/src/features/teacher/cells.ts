// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
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

export type SkeletonRow = { kind: 'period'; n: number; start?: Hhmm } | { kind: 'interval'; start?: Hhmm; end?: Hhmm; row?: TemplateRow };

export function weekSkeleton(rows: Record<DayIndex, TemplateRow[]>): SkeletonRow[] {
  const perDay = weekdays.map((d) => slotsOf(rows[d]));
  const count = Math.max(0, ...perDay.map((s) => s.filter((x) => x.kind === 'period').length));
  const out: SkeletonRow[] = [];
  const same = <T,>(vals: T[]): T | undefined => (vals.length > 0 && vals.every((v) => v === vals[0]) ? vals[0] : undefined);
  const gapsAfter = (n: number): TemplateRow[][] =>
    perDay.map((s) => {
      const i = n === 0 ? -1 : s.findIndex((x) => x.kind === 'period' && x.n === n);
      if (i < 0 && n > 0) return [];
      const gap: TemplateRow[] = [];
      for (let j = i + 1; j < s.length && s[j]!.kind === 'interval'; j++) gap.push(s[j]!.row);
      return gap;
    });
  const pushGap = (n: number) => {
    const gaps = gapsAfter(n);
    for (let k = 0; k < Math.max(0, ...gaps.map((g) => g.length)); k++) {
      const at = gaps.flatMap((g) => (g[k] ? [g[k]!] : []));
      const start = same(at.map((r) => r.start));
      const end = same(at.map((r) => r.end));
      const first = at[0]!;
      const label = first.type === 'activity' && at.every((r) => r.type === 'activity' && r.nameEn === first.nameEn && r.nameSi === first.nameSi) ? { row: first } : {};
      out.push({ kind: 'interval', ...(start && end ? { start, end } : {}), ...label });
    }
  };
  pushGap(0);
  for (let n = 1; n <= count; n++) {
    const starts = perDay.flatMap((s) => s.filter((x) => x.kind === 'period' && x.n === n).map((x) => x.row.start));
    const start = same(starts);
    out.push(start === undefined ? { kind: 'period', n } : { kind: 'period', n, start });
    pushGap(n);
  }
  return out;
}

export function cellsAt(snap: TeacherSnapshot, day: DayIndex, period: number): SnapshotCell[] {
  return snap.cells.filter((c) => c.day === day && c.period === period);
}

export const weekdays: DayIndex[] = [0, 1, 2, 3, 4];
