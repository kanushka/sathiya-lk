// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SnapshotCell, TeacherSnapshot } from '../publish';
import { overlaps, toMinutes } from '../time';
import type { DayIndex, Leave, LeaveType, Relief, TemplateRow } from '../types';

export interface Window { start: number; end: number }

const SHORT_LEAVE = 60;

export function leaveWindow(type: LeaveType, rows: TemplateRow[]): Window {
  const periods = rows.filter((r) => r.type === 'period');
  const first = periods[0];
  const last = periods[periods.length - 1];
  if (!first || !last) return { start: 0, end: 0 };
  const dayStart = toMinutes(first.start);
  const dayEnd = toMinutes(last.end);
  if (type === 'full') return { start: dayStart, end: dayEnd };
  if (type === 'late') return { start: dayStart, end: dayStart + SHORT_LEAVE };
  if (type === 'early') return { start: dayEnd - SHORT_LEAVE, end: dayEnd };
  let main: Window | undefined;
  for (const r of rows) {
    if (r.type !== 'interval') continue;
    const w = { start: toMinutes(r.start), end: toMinutes(r.end) };
    if (!main || w.end - w.start > main.end - main.start) main = w;
  }
  const split = main ?? { start: Math.floor((dayStart + dayEnd) / 2), end: Math.floor((dayStart + dayEnd) / 2) };
  return type === 'morning' ? { start: dayStart, end: split.end } : { start: split.start, end: dayEnd };
}

export function lessonsForLeave(snap: TeacherSnapshot, day: DayIndex, type: LeaveType): SnapshotCell[] {
  const w = leaveWindow(type, snap.rows[day] ?? []);
  return snap.cells.filter((c) => c.day === day && overlaps(w, { start: toMinutes(c.start), end: toMinutes(c.end) }));
}

export function reliefSlots(leaves: Leave[], snaps: Map<string, TeacherSnapshot>, day: DayIndex): Relief[] {
  const out: Relief[] = [];
  for (const leave of leaves) {
    const snap = snaps.get(leave.teacherId);
    if (!snap) continue;
    for (const c of lessonsForLeave(snap, day, leave.type)) {
      if (c.entryId === undefined) continue;
      out.push({ entryId: c.entryId, absentTeacherId: leave.teacherId, day, period: c.period, start: c.start, end: c.end, classIds: c.classIds ?? [], subjectId: c.subjectId ?? '', reliefTeacherId: null });
    }
  }
  const classKey = (r: Relief) => r.classIds.join('+');
  return out.sort((a, b) => toMinutes(a.start) - toMinutes(b.start) || classKey(a).localeCompare(classKey(b)));
}
