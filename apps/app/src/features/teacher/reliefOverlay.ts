// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { toMinutes, type Lang, type ReliefDay, type SnapshotCell, type TeacherSnapshot } from '@sathiya/core';
import { slotsOf } from './cells';

export interface OverlayCell extends SnapshotCell {
  relief?: { forTeacher: string };
  onLeave?: { reliefBy: string | null };
}
export type OverlaySnapshot = Omit<TeacherSnapshot, 'cells'> & { cells: OverlayCell[] };

export function overlayRelief(snap: TeacherSnapshot, day: ReliefDay | null, teacherId: string, lang: Lang): OverlaySnapshot {
  if (!day) return snap;
  const nameOf = (id: string): string => {
    const n = day.names[id];
    return (lang === 'si' && n?.si) || n?.en || '';
  };
  const ownLeave = new Set(day.leaves.find((l) => l.teacherId === teacherId)?.entryIds ?? []);
  const reliefBy = (entryId: string): string | null => {
    const id = day.reliefs.find((r) => r.entryId === entryId && r.absentTeacherId === teacherId)?.reliefTeacherId;
    return id ? nameOf(id) : null;
  };
  const periods = slotsOf(snap.rows[day.day] ?? []).filter((s) => s.kind === 'period');
  const periodFor = (start: string, end: string, fallback: number): number => {
    let best = fallback;
    let bestOverlap = 0;
    for (const p of periods) {
      const overlap = Math.min(toMinutes(end), toMinutes(p.row.end)) - Math.max(toMinutes(start), toMinutes(p.row.start));
      if (overlap > bestOverlap) {
        best = p.n;
        bestOverlap = overlap;
      }
    }
    return best;
  };

  const own = snap.cells.map((c): OverlayCell => (c.day === day.day && c.entryId !== undefined && ownLeave.has(c.entryId) ? { ...c, onLeave: { reliefBy: reliefBy(c.entryId) } } : c));
  const relief = day.reliefs
    .filter((r) => r.reliefTeacherId === teacherId)
    .map((r): OverlayCell => {
      const label = day.labels?.[r.entryId];
      return {
        day: day.day,
        period: periodFor(r.start, r.end, r.period),
        start: r.start,
        end: r.end,
        title: label?.cls ?? '',
        sub: label?.sub ?? '',
        ...(label?.subSi ? { subSi: label.subSi } : {}),
        color: '',
        isGroup: false,
        entryId: r.entryId,
        relief: { forTeacher: nameOf(r.absentTeacherId) },
      };
    });
  return { ...snap, cells: [...own, ...relief].sort((a, b) => a.day - b.day || toMinutes(a.start) - toMinutes(b.start)) };
}
