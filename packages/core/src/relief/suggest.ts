// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { SnapshotCell, TeacherSnapshot } from '../publish';
import { overlaps, toMinutes } from '../time';
import type { DayIndex, Leave, Relief, ReliefDay, Teacher } from '../types';
import { leaveWindow } from './window';

export interface ReliefCtx { teachers: Teacher[]; snaps: Map<string, TeacherSnapshot>; gradeOfClass: Map<string, number>; day: DayIndex; leaves: Leave[]; counts: Record<string, number> }
export interface Candidate { teacherId: string; teachesClass: boolean; teachesSubject: boolean; yearCount: number; todayCount: number; noLessonsToday: boolean }
export type ReliefError = { code: 'not-on-leave-lesson' | 'on-leave' | 'busy' | 'over-limit' | 'wrong-grade' | 'double-booked' | 'unknown-teacher'; entryId: string; teacherId: string };

type Ineligible = 'on-leave' | 'busy' | 'over-limit' | 'wrong-grade';
type Span = { start: number; end: number };

const span = (x: { start: string; end: string }): Span => ({ start: toMinutes(x.start), end: toMinutes(x.end) });

function assess(t: Teacher, slot: Relief, others: Relief[], ctx: ReliefCtx): Candidate | Ineligible {
  const snap = ctx.snaps.get(t.id);
  const cells: SnapshotCell[] = snap?.cells ?? [];
  const today = cells.filter((c) => c.day === ctx.day);
  const mine = others.filter((r) => r.reliefTeacherId === t.id);
  const at = span(slot);

  if (t.id === slot.absentTeacherId) return 'on-leave';
  const leave = ctx.leaves.find((l) => l.teacherId === t.id);
  if (leave && overlaps(leaveWindow(leave.type, snap?.rows[ctx.day] ?? []), at)) return 'on-leave';
  if (today.some((c) => overlaps(span(c), at)) || mine.some((r) => overlaps(span(r), at))) return 'busy';
  const todayCount = today.length + mine.length;
  if (todayCount + 1 > t.maxPerDay) return 'over-limit';
  if (!slot.classIds.every((id) => { const g = ctx.gradeOfClass.get(id); return g !== undefined && t.grades.includes(g); })) return 'wrong-grade';

  return {
    teacherId: t.id,
    teachesClass: cells.some((c) => (c.classIds ?? []).some((id) => slot.classIds.includes(id))),
    teachesSubject: slot.subjectId !== '' && cells.some((c) => c.subjectId === slot.subjectId),
    yearCount: (ctx.counts[t.id] ?? 0) + mine.length,
    todayCount,
    noLessonsToday: today.length === 0,
  };
}

export function candidatesFor(slot: Relief, others: Relief[], ctx: ReliefCtx): Candidate[] {
  const name = new Map(ctx.teachers.map((t) => [t.id, t.name || t.nameSi || '']));
  const out: Candidate[] = [];
  for (const t of ctx.teachers) {
    const a = assess(t, slot, others, ctx);
    if (typeof a !== 'string') out.push(a);
  }
  const knows = (c: Candidate) => (c.teachesClass || c.teachesSubject ? 0 : 1);
  return out.sort((a, b) =>
    knows(a) - knows(b)
    || a.yearCount - b.yearCount
    || a.todayCount - b.todayCount
    || Number(a.noLessonsToday) - Number(b.noLessonsToday)
    || (name.get(a.teacherId) ?? '').localeCompare(name.get(b.teacherId) ?? ''));
}

export function suggestRelief(slots: Relief[], ctx: ReliefCtx): Relief[] {
  const out = slots.map((s) => ({ ...s }));
  const open = out.map((_, i) => i).filter((i) => out[i]!.reliefTeacherId === null)
    .sort((a, b) => toMinutes(out[a]!.start) - toMinutes(out[b]!.start) || a - b);
  for (const i of open) {
    const others = out.filter((r, j) => j !== i && r.reliefTeacherId !== null);
    out[i]!.reliefTeacherId = candidatesFor(out[i]!, others, ctx)[0]?.teacherId ?? null;
  }
  return out;
}

export function validateRelief(day: Pick<ReliefDay, 'leaves' | 'reliefs'>, ctx: ReliefCtx): ReliefError[] {
  const c = { ...ctx, leaves: day.leaves };
  const errors: ReliefError[] = [];
  const teachers = new Map(ctx.teachers.map((t) => [t.id, t]));

  for (const l of day.leaves) {
    const own = new Set((ctx.snaps.get(l.teacherId)?.cells ?? []).filter((x) => x.day === ctx.day).map((x) => x.entryId));
    for (const id of l.entryIds) if (!own.has(id)) errors.push({ code: 'not-on-leave-lesson', entryId: id, teacherId: l.teacherId });
  }

  day.reliefs.forEach((r, i) => {
    const leave = day.leaves.find((l) => l.teacherId === r.absentTeacherId);
    if (!leave?.entryIds.includes(r.entryId)) {
      errors.push({ code: 'not-on-leave-lesson', entryId: r.entryId, teacherId: r.absentTeacherId });
      return;
    }
    const tid = r.reliefTeacherId;
    if (tid === null) return;
    const t = teachers.get(tid);
    if (!t) {
      errors.push({ code: 'unknown-teacher', entryId: r.entryId, teacherId: tid });
      return;
    }
    const others = day.reliefs.filter((o, j) => j !== i && o.reliefTeacherId !== null);
    if (others.some((o) => o.reliefTeacherId === tid && overlaps(span(o), span(r)))) {
      errors.push({ code: 'double-booked', entryId: r.entryId, teacherId: tid });
      return;
    }
    const a = assess(t, r, others, c);
    if (typeof a === 'string') errors.push({ code: a, entryId: r.entryId, teacherId: tid });
  });
  return errors;
}
