// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { busyDetail, teacherDayLoad, type BusyDetail } from './availability';
import { findConflicts } from './clash';
import { DAYS, findClass, gradeOf, templateOf } from './lookup';
import { effectivePlan } from './plan';
import { classProgress } from './progress';
import { periodsFor } from './time';
import type { DayIndex, Entry, SchoolContext } from './types';

export interface PinTarget { ctx: SchoolContext; entries: Entry[]; classId: string; subjectId: string; teacherId: string }
export type PinCell =
  | { kind: 'pinned'; entry: Entry }
  | { kind: 'taken'; entry: Entry }
  | { kind: 'busy'; busy: BusyDetail }
  | { kind: 'free'; load: number; max: number; limit: boolean; subjectThatDay: boolean };
export interface PinSlot { day: DayIndex; period: number; cell: PinCell }
export interface PinProgress { placed: number; needed: number; left: number; over: number }

export function isPinnedLesson(e: Entry, t: Pick<PinTarget, 'classId' | 'subjectId' | 'teacherId'>): boolean {
  const l = e.lessons[0];
  return e.groupKey === undefined && e.classIds.length === 1 && e.classIds[0] === t.classId && e.lessons.length === 1 && l?.subjectId === t.subjectId && l.teacherId === t.teacherId;
}

export function pinSlots(args: PinTarget): PinSlot[] {
  const { ctx, entries, classId, subjectId, teacherId } = args;
  const cls = findClass(ctx, classId);
  const template = cls && templateOf(ctx, cls);
  const teacher = ctx.teachers.find((t) => t.id === teacherId);
  if (!template || !teacher) return [];
  const out: PinSlot[] = [];
  for (const day of DAYS) {
    const load = teacherDayLoad(teacherId, day, entries);
    const subjectThatDay = entries.some((e) => e.day === day && e.classIds.includes(classId) && e.lessons.some((l) => l.subjectId === subjectId));
    for (const { period } of periodsFor(template, day)) {
      const own = entries.find((e) => e.day === day && e.period === period && e.classIds.includes(classId));
      if (own) {
        out.push({ day, period, cell: { kind: isPinnedLesson(own, args) ? 'pinned' : 'taken', entry: own } });
        continue;
      }
      const conflicts = findConflicts({ day, period, classIds: [classId], lessons: [{ subjectId, teacherId }] }, entries, ctx);
      const hit = conflicts.map((c) => entries.find((e) => e.id === c.entryId)).find((e) => e !== undefined);
      if (hit) {
        const kind = hit.lessons.some((l) => l.teacherId === teacherId) ? 'teacher' : 'class';
        out.push({ day, period, cell: { kind: 'busy', busy: busyDetail(hit, kind, teacherId) } });
        continue;
      }
      out.push({ day, period, cell: { kind: 'free', load, max: teacher.maxPerDay, limit: load >= teacher.maxPerDay, subjectThatDay } });
    }
  }
  return out;
}

export function suggestPins(args: PinTarget & { count: number }): Array<{ day: DayIndex; period: number }> {
  const slots = pinSlots(args).filter((s) => s.cell.kind === 'free');
  const teacher = args.ctx.teachers.find((t) => t.id === args.teacherId);
  if (!teacher) return [];
  const load = new Map<DayIndex, number>();
  const subjectCount = new Map<DayIndex, number>();
  for (const day of DAYS) {
    load.set(day, teacherDayLoad(args.teacherId, day, args.entries));
    subjectCount.set(day, args.entries.filter((e) => e.day === day && e.classIds.includes(args.classId) && e.lessons.some((l) => l.subjectId === args.subjectId)).length);
  }
  const picks: Array<{ day: DayIndex; period: number }> = [];
  const left = [...slots];
  while (picks.length < args.count) {
    let best = -1;
    for (let i = 0; i < left.length; i++) {
      const s = left[i]!;
      if (load.get(s.day)! >= teacher.maxPerDay) continue;
      const b = left[best];
      if (!b || subjectCount.get(s.day)! < subjectCount.get(b.day)! || (subjectCount.get(s.day) === subjectCount.get(b.day) && (s.day < b.day || (s.day === b.day && s.period < b.period)))) best = i;
    }
    if (best < 0) break;
    const [s] = left.splice(best, 1);
    picks.push({ day: s!.day, period: s!.period });
    load.set(s!.day, load.get(s!.day)! + 1);
    subjectCount.set(s!.day, subjectCount.get(s!.day)! + 1);
  }
  return picks;
}

export function pinProgress(args: { ctx: SchoolContext; entries: Entry[]; classId: string; subjectId: string }): PinProgress {
  const cls = findClass(args.ctx, args.classId);
  const grade = cls && gradeOf(args.ctx, cls);
  const plan = cls && grade ? effectivePlan(cls, grade) : [];
  const row = classProgress(args.classId, args.entries, plan).find((r) => r.item.kind === 'subject' && r.item.subjectId === args.subjectId);
  const placed = row?.placed ?? 0;
  const needed = row?.needed ?? 0;
  return { placed, needed, left: Math.max(0, needed - placed), over: Math.max(0, placed - needed) };
}
