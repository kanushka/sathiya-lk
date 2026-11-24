// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SnapshotCell, TeacherSnapshot } from '../publish';
import { overlaps, toMinutes } from '../time';
import type { DayIndex, Leave, LeaveType, Relief, TemplateRow } from '../types';

export interface Window { start: number; end: number }

const SHORT_LEAVE = 60;

function dayBounds(rows: TemplateRow[]): Window | null {
  const periods = rows.filter((r) => r.type === 'period');
  const first = periods[0];
  const last = periods[periods.length - 1];
  return first && last ? { start: toMinutes(first.start), end: toMinutes(last.end) } : null;
}

function mainInterval(rows: TemplateRow[], day: Window): Window {
  let main: Window | undefined;
  for (const r of rows) {
    if (r.type !== 'interval') continue;
    const w = { start: toMinutes(r.start), end: toMinutes(r.end) };
    if (!main || w.end - w.start > main.end - main.start) main = w;
  }
  const mid = Math.floor((day.start + day.end) / 2);
  return main ?? { start: mid, end: mid };
}

export function leaveWindow(type: LeaveType, rows: TemplateRow[]): Window {
  const day = dayBounds(rows);
  if (!day) return { start: 0, end: 0 };
  if (type === 'full') return day;
  if (type === 'late') return { start: day.start, end: day.start + SHORT_LEAVE };
  if (type === 'early') return { start: day.end - SHORT_LEAVE, end: day.end };
  const split = mainInterval(rows, day);
  return type === 'morning' ? { start: day.start, end: split.end } : { start: split.start, end: day.end };
}

export function lessonsForLeave(snap: TeacherSnapshot, day: DayIndex, type: LeaveType): SnapshotCell[] {
  const rows = snap.rows[day] ?? [];
  const bounds = dayBounds(rows);
  if (!bounds) return [];
  const today = snap.cells.filter((c) => c.day === day);
  if (type === 'morning') {
    const split = mainInterval(rows, bounds);
    return today.filter((c) => toMinutes(c.end) <= split.start);
  }
  if (type === 'afternoon') {
    const split = mainInterval(rows, bounds);
    return today.filter((c) => toMinutes(c.start) >= split.end);
  }
  const w = leaveWindow(type, rows);
  return today.filter((c) => overlaps(w, { start: toMinutes(c.start), end: toMinutes(c.end) }));
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
