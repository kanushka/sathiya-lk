// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { isExemptPlacement, preferredTeacherFor, teacherDayLoad, teacherLoad, teachesSubject } from '../availability';
import { DAYS, findClass, gradeOf } from '../lookup';
import { effectivePlan, planKey } from '../plan';
import { staffingFor, isMinutes } from '../staffing';
import type { Entry, PlanItem, SchoolClass, SchoolContext, Teacher } from '../types';
import { classSlots } from './slots';

export interface Allocation {
  classId: string;
  planKey: string;
  subjectId: string;
  teacherId: string | null;
}

export interface AllocationProblem {
  classId: string;
  planKey: string;
  reason: string;
}

interface Demand {
  minutes: number;
  periods: number;
}

const MAX_SUBJECTS_PER_CLASS = 2;
const FALLBACK_SLOT_MINUTES = 40;

export function allocate(args: {
  ctx: SchoolContext;
  entries: Entry[];
  classIds: string[];
  overrides?: Allocation[];
  random: () => number;
}): { allocation: Allocation[]; problems: AllocationProblem[] } {
  const { ctx, entries, random } = args;
  const allocation: Allocation[] = [];
  const problems: AllocationProblem[] = [];

  const teacherById = new Map(ctx.teachers.map((t) => [t.id, t]));
  const overrideKey = (classId: string, key: string, subjectId: string): string => `${classId}|${key}|${subjectId}`;
  const overrideMap = new Map<string, string>();
  for (const o of args.overrides ?? []) {
    if (o.teacherId !== null && teacherById.has(o.teacherId)) overrideMap.set(overrideKey(o.classId, o.planKey, o.subjectId), o.teacherId);
  }

  const load = new Map<string, { minutes: number; periods: number }>();
  for (const t of ctx.teachers) {
    load.set(t.id, {
      minutes: teacherLoad(t.id, entries, ctx).minutes,
      periods: DAYS.reduce<number>((n, d) => n + teacherDayLoad(t.id, d, entries, ctx), 0),
    });
  }

  const teaching = new Map<string, Set<string>>();
  const subjectsTaught = new Map<string, Map<string, Set<string>>>();
  const noteTeaching = (classId: string, teacherId: string, subjectId: string | null): void => {
    const set = teaching.get(classId) ?? new Set<string>();
    set.add(teacherId);
    teaching.set(classId, set);
    if (subjectId === null) return;
    const byTeacher = subjectsTaught.get(classId) ?? new Map<string, Set<string>>();
    const subjects = byTeacher.get(teacherId) ?? new Set<string>();
    subjects.add(subjectId);
    byTeacher.set(teacherId, subjects);
    subjectsTaught.set(classId, byTeacher);
  };
  for (const e of entries) {
    for (const classId of e.classIds) {
      for (const l of e.lessons) {
        if (l.teacherId !== null) noteTeaching(classId, l.teacherId, e.groupKey === undefined ? l.subjectId : null);
      }
    }
  }

  const avgSlot = new Map<string, number>();
  const slotMinutes = (classId: string): number => {
    const cached = avgSlot.get(classId);
    if (cached !== undefined) return cached;
    const slots = classSlots(ctx, classId);
    const avg = slots.length === 0 ? FALLBACK_SLOT_MINUTES : slots.reduce((n, s) => n + s.minutes, 0) / slots.length;
    avgSlot.set(classId, avg);
    return avg;
  };
  const demandOf = (item: PlanItem, classId: string): Demand => {
    const avg = slotMinutes(classId);
    return isMinutes(item) ? { minutes: item.perWeek, periods: Math.ceil(item.perWeek / avg) } : { minutes: item.perWeek * avg, periods: item.perWeek };
  };

  const commit = (teacherId: string, classIds: string[], subjectId: string, demand: Demand, countsToCap: boolean): void => {
    const state = load.get(teacherId);
    if (state) {
      state.minutes += demand.minutes;
      if (!classIds.some((id) => isExemptPlacement(teacherId, [id], ctx))) state.periods += demand.periods;
    }
    for (const id of classIds) noteTeaching(id, teacherId, countsToCap ? subjectId : null);
  };

  const pick = (p: {
    classIds: string[];
    subjectId: string;
    gradeNumber: number;
    exclude: ReadonlySet<string>;
    demand: Demand;
    preferred: string | null;
    capClassId?: string;
  }): string | null => {
    const pool = ctx.teachers.filter((t) => !p.exclude.has(t.id) && teachesSubject(t, p.subjectId, p.gradeNumber));
    if (pool.length === 0) return null;
    const preferred = p.preferred === null ? undefined : pool.find((t) => t.id === p.preferred);
    if (preferred) return preferred.id;

    const subjectCount = (t: Teacher): number => {
      const set = p.capClassId === undefined ? undefined : subjectsTaught.get(p.capClassId)?.get(t.id);
      return set === undefined ? 0 : set.size - (set.has(p.subjectId) ? 1 : 0);
    };
    let cands = p.capClassId === undefined ? pool : pool.filter((t) => subjectCount(t) < MAX_SUBJECTS_PER_CLASS);
    if (cands.length === 0) cands = pool;

    const exempt = (t: Teacher): boolean => p.classIds.some((id) => isExemptPlacement(t.id, [id], ctx));
    const projPeriods = (t: Teacher): number => (load.get(t.id)?.periods ?? 0) + (exempt(t) ? 0 : p.demand.periods);
    const projMinutes = (t: Teacher): number => (load.get(t.id)?.minutes ?? 0) + p.demand.minutes;
    const withinCapacity = cands.filter((t) => projPeriods(t) <= t.maxPerDay * DAYS.length);
    if (withinCapacity.length > 0) cands = withinCapacity;

    const key = (t: Teacher): number[] => [
      t.minPerWeek !== undefined && projPeriods(t) <= t.minPerWeek ? 0 : 1,
      projMinutes(t),
      p.classIds.some((id) => teaching.get(id)?.has(t.id)) ? 0 : 1,
    ];
    const cmp = (a: number[], b: number[]): number => {
      for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i]! - b[i]!;
      return 0;
    };
    let best: Teacher[] = [];
    let bestKey: number[] = [];
    for (const t of cands) {
      const k = key(t);
      if (best.length === 0 || cmp(k, bestKey) < 0) {
        best = [t];
        bestKey = k;
      } else if (cmp(k, bestKey) === 0) best.push(t);
    }
    return (best.length === 1 ? best[0]! : best[Math.floor(random() * best.length)]!).id;
  };

  const requested = new Set(args.classIds);
  const classes = ctx.classes
    .filter((c) => requested.has(c.id))
    .map((c) => ({ cls: c, grade: gradeOf(ctx, c) }))
    .filter((x): x is { cls: SchoolClass; grade: NonNullable<typeof x.grade> } => x.grade !== undefined)
    .sort((a, b) => a.grade.number - b.grade.number || a.cls.name.localeCompare(b.cls.name, undefined, { numeric: true }));

  const doneBlocks = new Set<string>();

  for (const { cls, grade } of classes) {
    const plan = effectivePlan(cls, grade);
    const { mode, specialistSubjectIds } = staffingFor(grade, ctx);
    const classTeacher = cls.classTeacherId === undefined ? undefined : teacherById.get(cls.classTeacherId);

    const assignSubject = (item: Extract<PlanItem, { kind: 'subject' }>, forced?: Teacher): void => {
      const key = planKey(item);
      const demand = demandOf(item, cls.id);
      const overridden = overrideMap.get(overrideKey(cls.id, key, item.subjectId));
      let teacherId: string | null;
      if (overridden !== undefined) teacherId = overridden;
      else if (forced) teacherId = forced.id;
      else if (mode === 'classTeacherAll' || (mode === 'classTeacherPlusSpecialists' && !specialistSubjectIds.includes(item.subjectId))) teacherId = classTeacher?.id ?? null;
      else {
        teacherId = pick({
          classIds: [cls.id],
          subjectId: item.subjectId,
          gradeNumber: grade.number,
          exclude: new Set(mode === 'classTeacherPlusSpecialists' && classTeacher ? [classTeacher.id] : []),
          demand,
          preferred: preferredTeacherFor({ entries, classId: cls.id, subjectId: item.subjectId }),
          ...(mode === 'subjectTeachers' ? { capClassId: cls.id } : {}),
        });
      }
      allocation.push({ classId: cls.id, planKey: key, subjectId: item.subjectId, teacherId });
      if (teacherId === null) problems.push({ classId: cls.id, planKey: key, reason: 'no-qualified-teacher' });
      else commit(teacherId, [cls.id], item.subjectId, demand, mode === 'subjectTeachers');
    };

    const assignGroup = (item: Extract<PlanItem, { kind: 'group' }>): void => {
      const key = planKey(item);
      const blockId = `${grade.id}|${cls.templateId}|${item.key}`;
      if (doneBlocks.has(blockId)) return;
      doneBlocks.add(blockId);
      const block = classes
        .filter((x) => x.cls.gradeId === grade.id && x.cls.templateId === cls.templateId && effectivePlan(x.cls, x.grade).some((p) => p.kind === 'group' && p.key === item.key))
        .map((x) => x.cls.id);
      const demand = demandOf(item, cls.id);
      const chosen = new Set<string>();
      for (const subjectId of item.optionSubjectIds) {
        const overridden = block.map((id) => overrideMap.get(overrideKey(id, key, subjectId))).find((t) => t !== undefined);
        let teacherId: string | null;
        if (overridden !== undefined) teacherId = overridden;
        else {
          const preferred = block.map((id) => preferredTeacherFor({ entries, classId: id, subjectId })).find((t) => t !== null) ?? null;
          teacherId = pick({ classIds: block, subjectId, gradeNumber: grade.number, exclude: chosen, demand, preferred });
        }
        if (teacherId !== null) {
          chosen.add(teacherId);
          commit(teacherId, block, subjectId, demand, false);
        }
        for (const classId of block) {
          allocation.push({ classId, planKey: key, subjectId, teacherId });
          if (teacherId === null) problems.push({ classId, planKey: key, reason: 'no-qualified-teacher' });
        }
      }
    };

    let daily: Extract<PlanItem, { kind: 'subject' }> | undefined;
    if (mode === 'subjectTeachers' && classTeacher) {
      for (const item of plan) {
        if (item.kind !== 'subject' || !(isMinutes(item) ? item.perDay !== undefined : item.perWeek >= 5)) continue;
        if (!teachesSubject(classTeacher, item.subjectId, grade.number)) continue;
        const overridden = overrideMap.get(overrideKey(cls.id, planKey(item), item.subjectId));
        if (overridden !== undefined && overridden !== classTeacher.id) continue;
        if (!daily || item.perWeek > daily.perWeek) daily = item;
      }
      if (daily) assignSubject(daily, classTeacher);
      else {
        const groupQualified = plan.some((i) => i.kind === 'group' && i.optionSubjectIds.some((id) => teachesSubject(classTeacher, id, grade.number)));
        if (!groupQualified) problems.push({ classId: cls.id, planKey: '', reason: 'class-teacher-no-daily-subject' });
      }
    }

    for (const item of plan) {
      if (item.kind === 'group') assignGroup(item);
      else if (item !== daily) assignSubject(item);
    }
  }

  return { allocation, problems };
}
