// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { busyDetail, teacherDayLoad, type BusyDetail } from './availability';
import { entryWindow, findConflicts } from './clash';
import { DAYS, findClass, gradeOf, templateOf } from './lookup';
import { effectivePlan } from './plan';
import { classProgress } from './progress';
import { bestOverlapPeriod, periodsFor, windowOf } from './time';
import type { DayIndex, Entry, SchoolContext } from './types';

export interface PinSpec { classIds: string[]; lessons: Array<{ subjectId: string; teacherId: string }>; groupKey?: string }
export interface PinArgs { ctx: SchoolContext; entries: Entry[]; spec: PinSpec }
export type PinCell =
  | { kind: 'pinned'; entry: Entry }
  | { kind: 'taken'; entry: Entry }
  | { kind: 'busy'; busy: BusyDetail; blockers: BusyDetail[] }
  | { kind: 'free'; load: number; max: number; limit: boolean; teacherId: string; subjectThatDay: boolean };
export interface PinSlot { day: DayIndex; period: number; cell: PinCell }
export interface PinProgress { placed: number; needed: number; left: number; over: number }
export type TeacherPinCell = PinCell | { kind: 'none' };
export interface TeacherPinSlot { day: DayIndex; row: number; period: number | null; cell: TeacherPinCell }

export function singleSpec(classId: string, subjectId: string, teacherId: string): PinSpec {
  return { classIds: [classId], lessons: [{ subjectId, teacherId }] };
}

const lessonKey = (l: { subjectId: string; teacherId: string | null }) => `${l.subjectId}|${l.teacherId ?? ''}`;

export function matchesSpec(e: Entry, spec: PinSpec): boolean {
  if (e.groupKey !== spec.groupKey) return false;
  if (e.classIds.length !== spec.classIds.length || !spec.classIds.every((c) => e.classIds.includes(c))) return false;
  if (e.lessons.length !== spec.lessons.length) return false;
  const a = e.lessons.map(lessonKey).sort();
  const b = spec.lessons.map(lessonKey).sort();
  return a.every((k, i) => k === b[i]);
}

function specTeacherIds(spec: PinSpec): string[] {
  return [...new Set(spec.lessons.map((l) => l.teacherId))];
}

function hasSubjectThatDay(e: Entry, spec: PinSpec): boolean {
  if (spec.groupKey !== undefined) return e.groupKey === spec.groupKey;
  return e.lessons.some((l) => l.subjectId === spec.lessons[0]?.subjectId);
}

function subjectOnDay(entries: Entry[], day: DayIndex, baseClassId: string, spec: PinSpec): boolean {
  return entries.some((e) => e.day === day && e.classIds.includes(baseClassId) && hasSubjectThatDay(e, spec));
}

export function pinSlots(args: PinArgs): PinSlot[] {
  const { ctx, entries, spec } = args;
  const baseId = spec.classIds[0];
  const cls = baseId === undefined ? undefined : findClass(ctx, baseId);
  const template = cls && templateOf(ctx, cls);
  const teachers = specTeacherIds(spec).map((id) => ctx.teachers.find((t) => t.id === id));
  if (!baseId || !template || spec.lessons.length === 0 || teachers.some((t) => !t)) return [];
  const specTeachers = teachers as NonNullable<(typeof teachers)[number]>[];
  const out: PinSlot[] = [];
  for (const day of DAYS) {
    let tight = { teacherId: '', load: 0, max: 0 };
    let tightGap = -Infinity;
    for (const t of specTeachers) {
      const load = teacherDayLoad(t.id, day, entries);
      if (load - t.maxPerDay > tightGap) {
        tightGap = load - t.maxPerDay;
        tight = { teacherId: t.id, load, max: t.maxPerDay };
      }
    }
    const subjectThatDay = subjectOnDay(entries, day, baseId, spec);
    for (const { period } of periodsFor(template, day)) {
      const own = entries.find((e) => e.day === day && e.period === period && e.classIds.includes(baseId));
      if (own) {
        out.push({ day, period, cell: { kind: matchesSpec(own, spec) ? 'pinned' : 'taken', entry: own } });
        continue;
      }
      const draft = { day, period, classIds: spec.classIds, lessons: spec.lessons, ...(spec.groupKey === undefined ? {} : { groupKey: spec.groupKey }) };
      const seen = new Set<string>();
      const blockers: BusyDetail[] = [];
      for (const c of findConflicts(draft, entries, ctx)) {
        if (seen.has(c.entryId)) continue;
        seen.add(c.entryId);
        const hit = entries.find((e) => e.id === c.entryId);
        if (!hit) continue;
        const teacherId = specTeachers.map((t) => t.id).find((id) => hit.lessons.some((l) => l.teacherId === id));
        blockers.push(teacherId === undefined ? busyDetail(hit, 'class', spec.lessons[0]!.teacherId) : busyDetail(hit, 'teacher', teacherId));
      }
      if (blockers.length > 0) {
        out.push({ day, period, cell: { kind: 'busy', busy: blockers[0]!, blockers } });
        continue;
      }
      out.push({ day, period, cell: { kind: 'free', load: tight.load, max: tight.max, limit: tight.load >= tight.max, teacherId: tight.teacherId, subjectThatDay } });
    }
  }
  return out;
}

export function suggestPins(args: PinArgs & { count: number }): Array<{ day: DayIndex; period: number }> {
  const { ctx, entries, spec } = args;
  const baseId = spec.classIds[0];
  const slots = pinSlots(args).filter((s) => s.cell.kind === 'free');
  const teachers = specTeacherIds(spec).map((id) => ctx.teachers.find((t) => t.id === id));
  if (!baseId || teachers.some((t) => !t)) return [];
  const specTeachers = teachers as NonNullable<(typeof teachers)[number]>[];
  const load = new Map<DayIndex, Map<string, number>>();
  const subjectCount = new Map<DayIndex, number>();
  for (const day of DAYS) {
    load.set(day, new Map(specTeachers.map((t) => [t.id, teacherDayLoad(t.id, day, entries)])));
    subjectCount.set(day, entries.filter((e) => e.day === day && e.classIds.includes(baseId) && hasSubjectThatDay(e, spec)).length);
  }
  const atLimit = (day: DayIndex) => specTeachers.some((t) => load.get(day)!.get(t.id)! >= t.maxPerDay);
  const picks: Array<{ day: DayIndex; period: number }> = [];
  const left = [...slots];
  while (picks.length < args.count) {
    let best = -1;
    for (let i = 0; i < left.length; i++) {
      const s = left[i]!;
      if (atLimit(s.day)) continue;
      const b = left[best];
      if (!b || subjectCount.get(s.day)! < subjectCount.get(b.day)! || (subjectCount.get(s.day) === subjectCount.get(b.day) && (s.day < b.day || (s.day === b.day && s.period < b.period)))) best = i;
    }
    if (best < 0) break;
    const [s] = left.splice(best, 1);
    picks.push({ day: s!.day, period: s!.period });
    const dayLoad = load.get(s!.day)!;
    for (const t of specTeachers) dayLoad.set(t.id, dayLoad.get(t.id)! + 1);
    subjectCount.set(s!.day, subjectCount.get(s!.day)! + 1);
  }
  return picks;
}

export function pinProgress(args: PinArgs): PinProgress {
  const { ctx, entries, spec } = args;
  const baseId = spec.classIds[0];
  const cls = baseId === undefined ? undefined : findClass(ctx, baseId);
  const grade = cls && gradeOf(ctx, cls);
  const plan = cls && grade ? effectivePlan(cls, grade) : [];
  const row = baseId === undefined ? undefined : classProgress(baseId, entries, plan).find((r) =>
    spec.groupKey !== undefined
      ? r.item.kind === 'group' && r.item.key === spec.groupKey
      : r.item.kind === 'subject' && r.item.subjectId === spec.lessons[0]?.subjectId,
  );
  const placed = row?.placed ?? 0;
  const needed = row?.needed ?? 0;
  return { placed, needed, left: Math.max(0, needed - placed), over: Math.max(0, placed - needed) };
}

export function teacherPinSlots(args: PinArgs & { teacherId: string }): TeacherPinSlot[] {
  const { ctx, entries, spec, teacherId } = args;
  const baseId = spec.classIds[0];
  const base = baseId === undefined ? undefined : findClass(ctx, baseId);
  const baseTemplate = base && templateOf(ctx, base);
  const def = ctx.templates.find((t) => t.isDefault);
  if (!base || !baseTemplate || !def) return [];
  const cells = pinSlots(args);
  if (cells.length === 0) return [];
  const out: TeacherPinSlot[] = [];
  for (const day of DAYS) {
    const mine = entries.filter((e) => e.day === day && e.lessons.some((l) => l.teacherId === teacherId));
    for (const { period: row } of periodsFor(def, day)) {
      const here = mine.filter((e) => {
        const w = entryWindow(e, ctx);
        return w !== null && bestOverlapPeriod(def, day, w) === row;
      });
      const match = here.find((e) => matchesSpec(e, spec));
      if (match) {
        out.push({ day, row, period: match.period, cell: { kind: 'pinned', entry: match } });
        continue;
      }
      if (here[0]) {
        out.push({ day, row, period: null, cell: { kind: 'taken', entry: here[0] } });
        continue;
      }
      const candidates = periodsFor(baseTemplate, day)
        .filter((p) => {
          const w = windowOf(baseTemplate, day, p.period);
          return w !== null && bestOverlapPeriod(def, day, w) === row;
        })
        .flatMap((p) => cells.filter((c) => c.day === day && c.period === p.period));
      const chosen = candidates.find((c) => c.cell.kind === 'free') ?? candidates[0];
      out.push(chosen ? { day, row, period: chosen.period, cell: chosen.cell } : { day, row, period: null, cell: { kind: 'none' } });
    }
  }
  return out;
}

export function latestGroupSpec(args: { ctx: SchoolContext; entries: Entry[]; classId: string; groupKey: string }): PinSpec | null {
  const { entries, classId, groupKey } = args;
  let latest: Entry | undefined;
  for (const e of entries) {
    if (e.groupKey !== groupKey || !e.classIds.includes(classId)) continue;
    if (!latest || e.day * 100 + e.period > latest.day * 100 + latest.period) latest = e;
  }
  if (!latest) return null;
  const lessons: PinSpec['lessons'] = [];
  for (const l of latest.lessons) {
    if (l.teacherId === null) return null;
    lessons.push({ subjectId: l.subjectId, teacherId: l.teacherId });
  }
  return { classIds: [classId, ...latest.classIds.filter((c) => c !== classId)], lessons, groupKey };
}
