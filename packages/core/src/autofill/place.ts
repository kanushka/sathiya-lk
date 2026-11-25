// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { isExemptPlacement, teachesSubject } from '../availability';
import { entryWindow } from '../clash';
import { DAYS, gradeOf, templateOf } from '../lookup';
import { effectivePlan, entryPlanKey, planKey } from '../plan';
import { classPlacement } from '../progress';
import { isMinutes, staffingFor } from '../staffing';
import { rowsFor, toMinutes } from '../time';
import type { DayIndex, Entry, EntryDraft, Grade, Lesson, PlanItem, SchoolClass, SchoolContext, StaffingMode } from '../types';
import type { Allocation } from './allocate';
import { combos } from './combos';
import { classSlots, type Slot } from './slots';

export type UnplacedReason = 'no-free-teacher' | 'teacher-at-limit' | 'no-room' | 'minutes-unbuildable' | 'block-unavailable';

export interface Unplaced {
  classId: string;
  planKey: string;
  missing: number;
  unit: 'periods' | 'minutes';
  reason: UnplacedReason;
  params: Record<string, string | number>;
}

const REASON_RANK: UnplacedReason[] = ['no-free-teacher', 'teacher-at-limit', 'minutes-unbuildable', 'block-unavailable', 'no-room'];
const MAX_SUBJECTS_PER_CLASS = 2;
const SPREAD_MAX_PER_WEEK = 5;
const CANDIDATES_PER_ITEM = 30;
const SEARCH_NODES = 3000;
const KEPT = -1;

type Block = 'first' | 'class' | 'teacher' | 'limit' | 'cap';

interface ClassInfo {
  cls: SchoolClass;
  grade: Grade;
  plan: PlanItem[];
  mode: StaffingMode;
  specialist: string[];
  ct: string | undefined;
  freeFirst: boolean;
  byDay: Slot[][];
  avgMinutes: number;
}

interface Task {
  classIds: string[];
  infos: ClassInfo[];
  key: string;
  item: PlanItem;
  lessons: Lesson[];
  teachers: string[];
  exempt: boolean[];
  group: boolean;
  minutes: boolean;
  capped: boolean;
  need: number;
  dayNeed: number[] | null;
  tie: number;
}

interface Placed {
  task: Task;
  slot: Slot;
  first: boolean;
}

interface Busy {
  start: number;
  end: number;
  ref: number;
}

interface DayOption {
  amount: number;
  slots: Slot[];
}

function overlap(list: Busy[] | undefined, s: { start: number; end: number }): boolean {
  return list !== undefined && list.some((b) => b.start < s.end && s.start < b.end);
}

function runsOf(slots: Slot[]): number {
  let runs = 0;
  slots.forEach((s, i) => {
    if (i === 0 || slots[i - 1]!.nextPeriod !== s.period) runs += 1;
  });
  return runs;
}

export function place(args: {
  ctx: SchoolContext;
  kept: Entry[];
  allocation: Allocation[];
  classIds: string[];
  random: () => number;
  stepBudget: number;
}): { drafts: EntryDraft[]; unplaced: Unplaced[] } {
  const { ctx, kept, random } = args;
  const unplaced: Unplaced[] = [];
  const maxPerDay = new Map(ctx.teachers.map((t) => [t.id, t.maxPerDay]));
  let steps = 0;
  const spend = (): boolean => {
    steps += 1;
    return steps <= args.stepBudget;
  };

  const requested = new Set(args.classIds);
  const infos: ClassInfo[] = [];
  for (const cls of ctx.classes) {
    if (!requested.has(cls.id)) continue;
    const grade = gradeOf(ctx, cls);
    const tpl = templateOf(ctx, cls);
    if (!grade || !tpl) continue;
    const plan = effectivePlan(cls, grade);
    const { mode, specialistSubjectIds } = staffingFor(grade, ctx);
    const ctTeacher = ctx.teachers.find((t) => t.id === cls.classTeacherId);
    const onlyGroup = ctTeacher !== undefined && !plan.some((i) => i.kind === 'subject' && teachesSubject(ctTeacher, i.subjectId, grade.number));
    const slots = classSlots(ctx, cls.id);
    infos.push({
      cls,
      grade,
      plan,
      mode,
      specialist: specialistSubjectIds,
      ct: cls.classTeacherId,
      freeFirst: mode === 'subjectTeachers' && onlyGroup,
      byDay: DAYS.map((d) => slots.filter((s) => s.day === d)),
      avgMinutes: slots.length === 0 ? 1 : slots.reduce((n, s) => n + s.minutes, 0) / slots.length,
    });
  }
  infos.sort((a, b) => a.grade.number - b.grade.number || a.cls.name.localeCompare(b.cls.name, undefined, { numeric: true }));
  const infoOf = new Map(infos.map((i) => [i.cls.id, i]));
  const classOrder = new Map(infos.map((i, n) => [i.cls.id, n]));

  const busy = new Map<string, Busy[][]>();
  const busyOf = (k: string): Busy[][] => {
    let v = busy.get(k);
    if (!v) {
      v = DAYS.map(() => []);
      busy.set(k, v);
    }
    return v;
  };
  const load = new Map<string, number[]>();
  const loadOf = (t: string): number[] => {
    let v = load.get(t);
    if (!v) {
      v = DAYS.map(() => 0);
      load.set(t, v);
    }
    return v;
  };
  const capSets = new Map<string, Map<string, Map<string, number>>>();
  const capOf = (classId: string, teacherId: string): Map<string, number> => {
    let byTeacher = capSets.get(classId);
    if (!byTeacher) {
      byTeacher = new Map();
      capSets.set(classId, byTeacher);
    }
    let set = byTeacher.get(teacherId);
    if (!set) {
      set = new Map();
      byTeacher.set(teacherId, set);
    }
    return set;
  };
  const bump = (m: Map<string, number>, k: string, by: number): void => {
    const n = (m.get(k) ?? 0) + by;
    if (n === 0) m.delete(k);
    else m.set(k, n);
  };
  const itemStarts = new Map<string, Array<{ day: number; start: number; period: number; ref: number }>>();
  const startsOf = (classId: string, key: string): Array<{ day: number; start: number; period: number; ref: number }> => {
    const k = `${classId}|${key}`;
    let v = itemStarts.get(k);
    if (!v) {
      v = [];
      itemStarts.set(k, v);
    }
    return v;
  };

  for (const e of kept) {
    const teachers = [...new Set(e.lessons.flatMap((l) => (l.teacherId === null ? [] : [l.teacherId])))];
    for (const t of teachers) if (!isExemptPlacement(t, e.classIds, ctx)) loadOf(t)[e.day]! += 1;
    const w = entryWindow(e, ctx);
    if (w) {
      for (const c of new Set(e.classIds)) busyOf(`c:${c}`)[e.day]!.push({ ...w, ref: KEPT });
      for (const t of teachers) busyOf(`t:${t}`)[e.day]!.push({ ...w, ref: KEPT });
    }
    for (const c of e.classIds) {
      const info = infoOf.get(c);
      if (!info) continue;
      if (e.groupKey === undefined && info.mode === 'subjectTeachers') {
        for (const l of e.lessons) if (l.teacherId !== null) bump(capOf(c, l.teacherId), l.subjectId, 1);
      }
      const key = entryPlanKey(e, info.plan);
      const slot = info.byDay[e.day]?.find((s) => s.period === e.period);
      if (key !== null && slot) startsOf(c, key).push({ day: e.day, start: slot.start, period: slot.period, ref: KEPT });
    }
  }

  const allocOf = new Map(args.allocation.map((a) => [`${a.classId}|${a.planKey}|${a.subjectId}`, a.teacherId]));
  const teacherKnown = (t: string | null | undefined): t is string => typeof t === 'string' && maxPerDay.has(t);

  const remaining = (info: ClassInfo, item: PlanItem): { need: number; dayNeed: number[] | null } => {
    const key = planKey(item);
    const row = classPlacement(info.cls, kept, ctx).rows.find((r) => r.key === key);
    const need = Math.max(0, (row?.needed ?? item.perWeek) - (row?.placed ?? 0));
    if (!isMinutes(item) || item.perDay === undefined) return { need, dayNeed: null };
    const tpl = templateOf(ctx, info.cls)!;
    const dayNeed = DAYS.map((d) => {
      if (info.byDay[d]!.length === 0) return 0;
      const credit = item.kind === 'subject' ? rowsFor(tpl, d).reduce((n, r) => (r.type === 'activity' && r.subjectId === item.subjectId ? n + toMinutes(r.end) - toMinutes(r.start) : n), 0) : 0;
      const have = startsOf(info.cls.id, key)
        .filter((s) => s.day === d)
        .reduce((n, s) => n + info.byDay[d]!.find((x) => x.period === s.period)!.minutes, 0);
      return Math.max(0, item.perDay! - credit - have);
    });
    return { need, dayNeed };
  };

  const report = (classIds: string[], key: string, missing: number, minutes: boolean, reason: UnplacedReason, params: Record<string, string | number>): void => {
    if (missing <= 0) return;
    for (const classId of classIds) unplaced.push({ classId, planKey: key, missing, unit: minutes ? 'minutes' : 'periods', reason, params });
  };

  const makeTask = (classIds: string[], item: PlanItem, lessons: Lesson[], need: number, dayNeed: number[] | null): Task => {
    const teachers = [...new Set(lessons.map((l) => l.teacherId!))];
    const first = infoOf.get(classIds[0]!)!;
    return {
      classIds,
      infos: classIds.map((c) => infoOf.get(c)!),
      key: planKey(item),
      item,
      lessons,
      teachers,
      exempt: teachers.map((t) => isExemptPlacement(t, classIds, ctx)),
      group: item.kind === 'group',
      minutes: isMinutes(item),
      capped: item.kind === 'subject' && first.mode === 'subjectTeachers',
      need,
      dayNeed,
      tie: random(),
    };
  };

  const groupTasks: Task[] = [];
  const subjectTasks: Task[] = [];
  const doneBlocks = new Set<string>();
  for (const info of infos) {
    for (const item of info.plan) {
      const key = planKey(item);
      if (item.kind === 'group') {
        const blockId = `${info.grade.id}|${info.cls.templateId}|${item.key}`;
        if (doneBlocks.has(blockId)) continue;
        doneBlocks.add(blockId);
        const block = infos.filter((x) => x.cls.gradeId === info.grade.id && x.cls.templateId === info.cls.templateId && x.plan.some((p) => p.kind === 'group' && p.key === item.key));
        const lessons = item.optionSubjectIds.map((subjectId) => ({ subjectId, teacherId: allocOf.get(`${info.cls.id}|${key}|${subjectId}`) ?? null }));
        const parts = new Map<string, { ids: string[]; need: number; dayNeed: number[] | null }>();
        for (const x of block) {
          const r = remaining(x, item);
          if (r.need <= 0) continue;
          const sig = `${r.need}|${r.dayNeed?.join(',') ?? ''}`;
          const part = parts.get(sig) ?? { ids: [], need: r.need, dayNeed: r.dayNeed };
          part.ids.push(x.cls.id);
          parts.set(sig, part);
        }
        for (const part of parts.values()) {
          if (!lessons.every((l) => teacherKnown(l.teacherId))) report(part.ids, key, part.need, isMinutes(item), 'no-free-teacher', { reason: 'unallocated' });
          else groupTasks.push(makeTask(part.ids, item, lessons, part.need, part.dayNeed));
        }
        continue;
      }
      const r = remaining(info, item);
      if (r.need <= 0) continue;
      const teacherId = allocOf.get(`${info.cls.id}|${key}|${item.subjectId}`);
      if (!teacherKnown(teacherId)) {
        report([info.cls.id], key, r.need, isMinutes(item), 'no-free-teacher', { reason: 'unallocated' });
        continue;
      }
      const special = info.specialist.includes(item.subjectId);
      const staffed =
        info.ct === undefined ||
        info.mode === 'subjectTeachers' ||
        (info.mode === 'classTeacherAll' ? teacherId === info.ct : special ? teacherId !== info.ct : teacherId === info.ct);
      if (!staffed) {
        report([info.cls.id], key, r.need, isMinutes(item), 'no-free-teacher', { reason: 'staffing' });
        continue;
      }
      subjectTasks.push(makeTask([info.cls.id], item, [{ subjectId: item.subjectId, teacherId }], r.need, r.dayNeed));
    }
  }

  const placed: Array<Placed | null> = [];
  const owned = new Map<Task, number[]>();
  const ownedBy = (t: Task): number[] => {
    let v = owned.get(t);
    if (!v) {
      v = [];
      owned.set(t, v);
    }
    return v;
  };
  const amountOf = (task: Task, slot: Slot): number => (task.minutes ? slot.minutes : 1);

  const check = (task: Task, slot: Slot): Block | null => {
    if (slot.first) {
      if (task.group) return 'first';
      for (const info of task.infos) if (!info.freeFirst && info.ct !== undefined && !task.teachers.includes(info.ct)) return 'first';
    }
    for (const c of task.classIds) if (overlap(busy.get(`c:${c}`)?.[slot.day], slot)) return 'class';
    for (const t of task.teachers) if (overlap(busy.get(`t:${t}`)?.[slot.day], slot)) return 'teacher';
    for (let i = 0; i < task.teachers.length; i++) {
      const t = task.teachers[i]!;
      if (!task.exempt[i] && (load.get(t)?.[slot.day] ?? 0) + 1 > maxPerDay.get(t)!) return 'limit';
    }
    if (task.capped) {
      const subjectId = task.lessons[0]!.subjectId;
      for (const t of task.teachers) {
        const set = capSets.get(task.classIds[0]!)?.get(t);
        if (set && set.size + (set.has(subjectId) ? 0 : 1) > MAX_SUBJECTS_PER_CLASS) return 'cap';
      }
    }
    return null;
  };

  const room = (task: Task, day: number): number => {
    let r = Infinity;
    task.teachers.forEach((t, i) => {
      if (!task.exempt[i]) r = Math.min(r, maxPerDay.get(t)! - (load.get(t)?.[day] ?? 0));
    });
    return r;
  };

  const add = (task: Task, slot: Slot, first = false): number => {
    const ref = placed.length;
    placed.push({ task, slot, first });
    for (const c of task.classIds) {
      busyOf(`c:${c}`)[slot.day]!.push({ start: slot.start, end: slot.end, ref });
      startsOf(c, task.key).push({ day: slot.day, start: slot.start, period: slot.period, ref });
    }
    task.teachers.forEach((t, i) => {
      busyOf(`t:${t}`)[slot.day]!.push({ start: slot.start, end: slot.end, ref });
      if (!task.exempt[i]) loadOf(t)[slot.day]! += 1;
    });
    if (task.capped) for (const t of task.teachers) bump(capOf(task.classIds[0]!, t), task.lessons[0]!.subjectId, 1);
    task.need -= amountOf(task, slot);
    if (task.dayNeed) task.dayNeed[slot.day]! -= slot.minutes;
    if (!first) ownedBy(task).push(ref);
    return ref;
  };

  const remove = (ref: number): Placed => {
    const p = placed[ref]!;
    placed[ref] = null;
    const { task, slot } = p;
    const drop = (list: Array<{ ref: number }>): void => {
      const i = list.findIndex((b) => b.ref === ref);
      if (i >= 0) list.splice(i, 1);
    };
    for (const c of task.classIds) {
      drop(busyOf(`c:${c}`)[slot.day]!);
      drop(startsOf(c, task.key));
    }
    task.teachers.forEach((t, i) => {
      drop(busyOf(`t:${t}`)[slot.day]!);
      if (!task.exempt[i]) loadOf(t)[slot.day]! -= 1;
    });
    if (task.capped) for (const t of task.teachers) bump(capOf(task.classIds[0]!, t), task.lessons[0]!.subjectId, -1);
    task.need += amountOf(task, slot);
    if (task.dayNeed) task.dayNeed[slot.day]! += slot.minutes;
    const list = owned.get(task);
    if (list) {
      const i = list.indexOf(ref);
      if (i >= 0) list.splice(i, 1);
    }
    return p;
  };

  const pickTie = <T>(list: T[]): T => list[list.length === 1 ? 0 : Math.floor(random() * list.length)]!;
  const bestBy = <T>(list: T[], key: (x: T) => number[]): T | undefined => {
    let best: T[] = [];
    let bestKey: number[] = [];
    for (const x of list) {
      const k = key(x);
      let cmp = 0;
      for (let i = 0; i < k.length && cmp === 0; i++) cmp = best.length === 0 ? -1 : k[i]! - bestKey[i]!;
      if (best.length === 0 || cmp < 0) {
        best = [x];
        bestKey = k;
      } else if (cmp === 0) best.push(x);
    }
    return best.length === 0 ? undefined : pickTie(best);
  };

  const homeInfo = (task: Task): ClassInfo => task.infos[0]!;
  const freeCount = (task: Task, day: number): number => homeInfo(task).byDay[day]!.filter((s) => !task.classIds.some((c) => overlap(busy.get(`c:${c}`)?.[day], s))).length;
  const dayItems = (task: Task, day: number): Array<{ period: number; start: number }> => startsOf(task.classIds[0]!, task.key).filter((s) => s.day === day);
  const slotAt = (task: Task, day: number, period: number | null): Slot | undefined => (period === null ? undefined : homeInfo(task).byDay[day]!.find((s) => s.period === period));

  const fallbackKey = (task: Task, slot: Slot): number[] => {
    const here = dayItems(task, slot.day);
    const usedStart = startsOf(task.classIds[0]!, task.key).some((s) => s.start === slot.start);
    const adjacent = here.some((h) => h.period === slot.nextPeriod || slotAt(task, slot.day, h.period)?.nextPeriod === slot.period);
    const doubles = task.item.perWeek > SPREAD_MAX_PER_WEEK;
    let value = 0;
    if (here.length === 0) value += (usedStart ? 1000 : 0) + 50;
    else if (adjacent) value += doubles ? 100 : 10;
    else value -= 500;
    return [-value, -freeCount(task, slot.day)];
  };

  const fallbackPeriods = (task: Task): void => {
    while (task.need > 0) {
      const options = DAYS.flatMap((d) => homeInfo(task).byDay[d]!.filter((s) => check(task, s) === null));
      const best = bestBy(options, (s) => fallbackKey(task, s));
      if (!best) return;
      add(task, best);
    }
  };

  const patternPeriods = (task: Task): Slot[] | null => {
    const n = task.need;
    const info = homeInfo(task);
    const used = startsOf(task.classIds[0]!, task.key);
    const starts = used.length > 0 ? [...new Set(used.map((u) => u.start))] : [...new Set(DAYS.flatMap((d) => info.byDay[d]!.map((s) => s.start)))];
    const found: Array<{ slots: Slot[]; key: number[] }> = [];
    starts.sort((a, b) => a - b);
    for (const start of starts) {
      const singles: Slot[] = [];
      const doubles = new Map<Slot, Slot>();
      for (const d of DAYS) {
        if (dayItems(task, d).length > 0) continue;
        const s = info.byDay[d]!.find((x) => x.start === start);
        if (!s || check(task, s) !== null) continue;
        singles.push(s);
        if (room(task, d) < 2) continue;
        const next = slotAt(task, d, s.nextPeriod);
        const prev = info.byDay[d]!.find((x) => x.nextPeriod === s.period);
        const pair = [next, prev].find((x) => x !== undefined && check(task, x) === null);
        if (pair) doubles.set(s, pair);
      }
      if (singles.length === 0 || n > singles.length * 2) continue;
      const byFree = [...singles].sort((a, b) => freeCount(task, b.day) - freeCount(task, a.day) || a.day - b.day);
      if (n <= singles.length) {
        found.push({ slots: byFree.slice(0, n), key: [0, singles.length - n] });
        continue;
      }
      const extra = n - singles.length;
      const pairs = byFree.filter((s) => doubles.has(s));
      if (pairs.length < extra) continue;
      found.push({ slots: [...singles, ...pairs.slice(0, extra).map((s) => doubles.get(s)!)], key: [extra, 0] });
    }
    return bestBy(found, (f) => f.key)?.slots ?? null;
  };

  const blockersAt = (task: Task, slot: Slot): Set<number> => {
    const refs = new Set<number>();
    const scan = (list: Busy[] | undefined): void => {
      for (const b of list ?? []) if (b.start < slot.end && slot.start < b.end) refs.add(b.ref);
    };
    for (const c of task.classIds) scan(busy.get(`c:${c}`)?.[slot.day]);
    for (const t of task.teachers) scan(busy.get(`t:${t}`)?.[slot.day]);
    return refs;
  };

  const ejectRepair = (task: Task): void => {
    let progress = true;
    while (task.need > 0 && progress && steps < args.stepBudget) {
      progress = false;
      const info = homeInfo(task);
      const candidates = DAYS.flatMap((d) => info.byDay[d]!).sort((a, b) => {
        const ka = fallbackKey(task, a);
        const kb = fallbackKey(task, b);
        return ka[0]! - kb[0]! || ka[1]! - kb[1]! || a.day - b.day || a.period - b.period;
      });
      for (const x of candidates) {
        if (room(task, x.day) < 1) continue;
        const refs = blockersAt(task, x);
        if (refs.size !== 1 || refs.has(KEPT)) continue;
        const ref = [...refs][0]!;
        const victim = placed[ref]!;
        if (victim.first || victim.task.minutes) continue;
        if (!spend()) return;
        remove(ref);
        if (check(task, x) !== null) {
          add(victim.task, victim.slot);
          continue;
        }
        const mine = add(task, x);
        const moveTo = bestBy(
          DAYS.flatMap((d) => homeInfo(victim.task).byDay[d]!.filter((s) => check(victim.task, s) === null)),
          (s) => fallbackKey(victim.task, s),
        );
        if (moveTo) {
          add(victim.task, moveTo);
          progress = true;
          break;
        }
        remove(mine);
        add(victim.task, victim.slot);
      }
    }
  };

  const placePeriods = (task: Task): void => {
    const pattern = patternPeriods(task);
    if (pattern) for (const s of pattern) add(task, s);
    fallbackPeriods(task);
    if (task.need > 0) ejectRepair(task);
  };

  const usableByDay = (task: Task): Slot[][] => DAYS.map((d) => homeInfo(task).byDay[d]!.filter((s) => check(task, s) === null));

  const searchDays = (options: DayOption[][], target: number, limit: number): DayOption[][] => {
    const out: DayOption[][] = [];
    const chosen: DayOption[] = [];
    const maxFrom: number[] = new Array(options.length + 1).fill(0);
    for (let i = options.length - 1; i >= 0; i--) maxFrom[i] = maxFrom[i + 1]! + Math.max(0, ...options[i]!.map((o) => o.amount));
    let nodes = 0;
    const walk = (i: number, left: number): void => {
      if (out.length >= limit || nodes++ > SEARCH_NODES) return;
      if (left === 0) {
        out.push([...chosen, ...options.slice(i).map(() => ({ amount: 0, slots: [] }))]);
        return;
      }
      if (i >= options.length || maxFrom[i]! < left) return;
      const aim = left / (options.length - i);
      const sorted = options[i]!.filter((o) => o.amount <= left).sort((a, b) => Math.abs(a.amount - aim) - Math.abs(b.amount - aim) || a.amount - b.amount);
      for (const o of sorted) {
        chosen.push(o);
        walk(i + 1, left - o.amount);
        chosen.pop();
      }
    };
    walk(0, target);
    return out;
  };

  const solutionKey = (days: DayOption[]): number[] => {
    const used = days.filter((o) => o.slots.length > 0);
    const starts = new Set(used.map((o) => o.slots[0]!.start)).size;
    const runs = used.reduce((n, o) => n + runsOf(o.slots), 0);
    const count = used.reduce((n, o) => n + o.slots.length, 0);
    const amounts = used.map((o) => o.amount);
    const spread = amounts.length === 0 ? 0 : Math.max(...amounts) - Math.min(...amounts);
    return [starts, runs, count, spread];
  };
  const compareKeys = (a: number[], b: number[]): number => {
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! - b[i]!;
    return 0;
  };

  const weeklyCandidates = (task: Task): Slot[][] => {
    const target = task.need;
    if (target <= 0) return [];
    const usable = usableByDay(task);
    const rooms = DAYS.map((d) => room(task, d));
    const used = new Set(startsOf(task.classIds[0]!, task.key).map((s) => s.start));
    const starts = [...new Set(usable.flat().map((s) => s.start))].sort((a, b) => Number(used.has(b)) - Number(used.has(a)) || a - b);

    const patterns: Array<{ slots: Slot[]; key: number[] }> = [];
    for (const start of starts) {
      const options = DAYS.map((d) => {
        const opts: DayOption[] = [{ amount: 0, slots: [] }];
        const list = usable[d]!;
        let s = list.find((x) => x.start === start);
        const run: Slot[] = [];
        while (s && run.length < rooms[d]!) {
          run.push(s);
          opts.push({ amount: run.reduce((n, x) => n + x.minutes, 0), slots: [...run] });
          const next = s.nextPeriod;
          s = next === null ? undefined : list.find((x) => x.period === next);
        }
        return opts;
      });
      const sols = searchDays(options, target, CANDIDATES_PER_ITEM).map((days) => ({ slots: days.flatMap((o) => o.slots), key: [used.has(start) ? 0 : 1, ...solutionKey(days).slice(1)] }));
      sols.sort((a, b) => compareKeys(a.key, b.key));
      if (sols[0]) patterns.push(sols[0]);
    }
    patterns.sort((a, b) => compareKeys(a.key, b.key));

    const options = DAYS.map((d) => {
      const list = usable[d]!;
      const sums = new Set<number>([0]);
      for (const s of list) for (const v of [...sums]) if (v + s.minutes <= target) sums.add(v + s.minutes);
      const opts: DayOption[] = [{ amount: 0, slots: [] }];
      for (const amount of [...sums].filter((v) => v > 0).sort((a, b) => a - b)) {
        const c = combos(list, amount, 4).find((x) => x.length <= rooms[d]!);
        if (c) opts.push({ amount, slots: c });
      }
      return opts;
    });
    const fallback = searchDays(options, target, CANDIDATES_PER_ITEM)
      .map((days) => ({ slots: days.flatMap((o) => o.slots), key: solutionKey(days) }))
      .sort((a, b) => compareKeys(a.key, b.key));
    return [...patterns, ...fallback].map((x) => x.slots);
  };

  const perDayCandidates = (task: Task): Array<{ slots: Slot[]; missing: number }> => {
    const dayNeed = task.dayNeed!;
    const usable = usableByDay(task);
    const lists = DAYS.map((d) => (dayNeed[d]! > 0 ? combos(usable[d]!, dayNeed[d]!, 20).filter((c) => c.length <= room(task, d)) : []));
    const used = new Set(startsOf(task.classIds[0]!, task.key).map((s) => s.start));
    const counts = new Map<number, number>();
    for (const list of lists) for (const start of new Set(list.map((c) => c[0]!.start))) counts.set(start, (counts.get(start) ?? 0) + 1);
    const starts = [...counts.keys()].sort((a, b) => Number(used.has(b)) - Number(used.has(a)) || counts.get(b)! - counts.get(a)! || a - b);
    const out: Array<{ slots: Slot[]; missing: number; key: number[] }> = [];
    const seen = new Set<string>();
    for (const start of starts.length > 0 ? starts : [-1]) {
      const days = DAYS.map((d) => {
        const list = lists[d]!;
        const c = list.find((x) => x[0]!.start === start) ?? list[0];
        return { amount: c ? dayNeed[d]! : 0, slots: c ?? [] };
      });
      const slots = days.flatMap((o) => o.slots);
      const sig = slots.map((s) => `${s.day}.${s.period}`).join(',');
      if (seen.has(sig)) continue;
      seen.add(sig);
      const missing = DAYS.reduce<number>((n, d) => n + (dayNeed[d]! > 0 && days[d]!.slots.length === 0 ? dayNeed[d]! : 0), 0);
      const total = slots.reduce((n, s) => n + s.minutes, 0);
      if (total > task.need) continue;
      out.push({ slots, missing, key: [missing, ...solutionKey(days)] });
    }
    return out.sort((a, b) => compareKeys(a.key, b.key));
  };

  const minuteTasksOf = new Map<string, Task[]>();
  for (const t of subjectTasks) {
    if (!t.minutes) continue;
    const list = minuteTasksOf.get(t.classIds[0]!) ?? [];
    list.push(t);
    minuteTasksOf.set(t.classIds[0]!, list);
  }
  const handled = new Set<Task>();
  const repairedClasses = new Set<string>();

  const freeMinutes = (classId: string): number => {
    const info = infoOf.get(classId)!;
    return DAYS.reduce<number>((n, d) => n + info.byDay[d]!.filter((s) => !overlap(busy.get(`c:${classId}`)?.[d], s)).reduce((m, s) => m + s.minutes, 0), 0);
  };

  const classMinutesRepair = (classId: string): boolean => {
    repairedClasses.add(classId);
    const tasks = [...(minuteTasksOf.get(classId) ?? [])].sort((a, b) => Number(b.dayNeed !== null) - Number(a.dayNeed !== null));
    const info = infoOf.get(classId)!;
    const classBusy = (slot: Slot): boolean => overlap(busy.get(`c:${classId}`)?.[slot.day], slot);
    const firsts = DAYS.flatMap((d) => info.byDay[d]!.filter((x) => x.first && classBusy(x)));
    const mine = new Set(tasks);
    const saved: Array<{ task: Task; slot: Slot; first: boolean }> = [];
    placed.forEach((p, ref) => {
      if (!p || !mine.has(p.task)) return;
      saved.push({ task: p.task, slot: p.slot, first: p.first });
      remove(ref);
    });
    const order = [...tasks.filter((t) => t.dayNeed !== null), ...tasks.filter((t) => t.dayNeed === null).sort((a, b) => b.need - a.need)];
    const walk = (i: number): boolean => {
      if (i === order.length) return firsts.every(classBusy);
      const t = order[i]!;
      if (t.need <= 0) return walk(i + 1);
      const rest = order.slice(i).reduce((n, x) => n + Math.max(0, x.need), 0);
      if (rest > freeMinutes(classId)) return false;
      const cands = t.dayNeed ? perDayCandidates(t).filter((c) => c.missing === 0).map((c) => c.slots) : weeklyCandidates(t);
      for (const c of cands) {
        if (!spend()) return false;
        const refs = c.map((s) => add(t, s));
        if (walk(i + 1)) return true;
        for (const r of refs.reverse()) remove(r);
      }
      return false;
    };
    for (const t of tasks) handled.add(t);
    if (walk(0)) return true;
    for (const t of tasks) for (const ref of [...ownedBy(t)]) remove(ref);
    for (const s of saved) add(s.task, s.slot, s.first);
    for (const t of tasks) handled.delete(t);
    return false;
  };

  const placeMinutes = (task: Task, allowRepair: boolean): void => {
    if (task.dayNeed) {
      const best = perDayCandidates(task)[0];
      if (best && best.missing === 0) {
        for (const s of best.slots) add(task, s);
        return;
      }
      if (allowRepair && !task.group && !repairedClasses.has(task.classIds[0]!) && classMinutesRepair(task.classIds[0]!)) return;
      if (best) for (const s of best.slots) add(task, s);
      return;
    }
    const best = weeklyCandidates(task)[0];
    if (best) {
      for (const s of best) add(task, s);
      return;
    }
    if (allowRepair && !task.group && !repairedClasses.has(task.classIds[0]!)) classMinutesRepair(task.classIds[0]!);
  };

  const run = (task: Task, allowRepair = true): void => {
    if (handled.has(task) || task.need <= 0) return;
    handled.add(task);
    if (task.minutes) placeMinutes(task, allowRepair);
    else placePeriods(task);
  };

  for (const task of groupTasks) run(task);

  const opened = new Set<Task>();

  for (const info of infos) {
    if (info.ct === undefined || info.freeFirst) continue;
    const mine = subjectTasks.filter((t) => t.classIds[0] === info.cls.id && t.teachers.includes(info.ct!));
    const daily = (t: Task): boolean => (t.minutes ? t.dayNeed !== null : t.item.perWeek >= SPREAD_MAX_PER_WEEK);
    const firsts = DAYS.map((d) => info.byDay[d]!.find((s) => s.first)).filter((s): s is Slot => s !== undefined && !overlap(busy.get(`c:${info.cls.id}`)?.[s.day], s));
    const fits = (t: Task, s: Slot): Slot[] | null => {
      if (check(t, s) !== null) return null;
      if (t.dayNeed) {
        const need = t.dayNeed[s.day]!;
        if (need <= 0) return null;
        const usable = info.byDay[s.day]!.filter((x) => check(t, x) === null);
        return combos(usable, need, 20).find((c) => c.includes(s) && c.length <= room(t, s.day)) ?? null;
      }
      return amountOf(t, s) <= t.need ? [s] : null;
    };
    const coverage = (t: Task): number => {
      let budget = t.need;
      let n = 0;
      for (const s of firsts) {
        const f = fits(t, s);
        const amount = f ? f.reduce((m, x) => m + amountOf(t, x), 0) : 0;
        if (f && amount <= budget) {
          budget -= amount;
          n += 1;
        }
      }
      return n;
    };
    const periodsLeft = (t: Task): number => (t.minutes ? t.need / info.avgMinutes : t.need);
    const ranked = [...mine].sort((a, b) => Number(daily(b)) - Number(daily(a)) || coverage(b) - coverage(a) || periodsLeft(b) - periodsLeft(a));
    for (const s of firsts) {
      for (const t of ranked) {
        const f = fits(t, s);
        if (!f) continue;
        for (const x of f) add(t, x, true);
        opened.add(t);
        break;
      }
    }
  }
  for (const task of opened) if (!task.dayNeed) run(task);

  for (const task of subjectTasks) if (task.dayNeed) run(task);

  const capacity = (task: Task): number =>
    DAYS.reduce<number>((n, d) => n + Math.min(room(task, d), homeInfo(task).byDay[d]!.filter((s) => check(task, s) === null).length), 0);
  const rest = subjectTasks
    .filter((t) => !t.dayNeed && t.need > 0)
    .map((t) => ({ t, ratio: (t.minutes ? t.need / homeInfo(t).avgMinutes : t.need) / Math.max(capacity(t), 0.5) }))
    .sort((a, b) => b.ratio - a.ratio || a.t.tie - b.t.tie)
    .map((x) => x.t);
  for (const task of rest) run(task);
  for (const task of [...groupTasks, ...subjectTasks]) if (!handled.has(task)) run(task, false);

  for (const task of [...groupTasks, ...subjectTasks]) {
    const missing = task.dayNeed ? Math.min(task.need, task.dayNeed.reduce((n, v) => n + Math.max(0, v), 0)) : task.need;
    if (missing <= 0) continue;
    const seen = new Map<UnplacedReason, Record<string, string | number>>();
    const info = homeInfo(task);
    const base: Record<string, string | number> = task.item.kind === 'group' ? { groupKey: task.item.key } : { subjectId: task.item.subjectId };
    const note = (reason: UnplacedReason, extra: Record<string, string | number>): void => {
      if (!seen.has(reason)) seen.set(reason, { ...base, ...extra });
    };
    let usableMinutes = 0;
    for (const d of DAYS) {
      if (task.dayNeed && task.dayNeed[d]! <= 0) continue;
      const before = usableMinutes;
      for (const s of info.byDay[d]!) {
        const b = check(task, s);
        if (b === 'first') continue;
        if (b === 'class') note(task.group ? 'block-unavailable' : 'no-room', { day: d });
        else if (b === 'teacher' || b === 'cap') {
          const t = task.teachers.find((x) => overlap(busy.get(`t:${x}`)?.[d], s)) ?? task.teachers[0]!;
          note(task.group ? 'block-unavailable' : 'no-free-teacher', { day: d, teacherId: t });
        } else if (b === 'limit') {
          const t = task.teachers.find((x, i) => !task.exempt[i] && (load.get(x)?.[d] ?? 0) + 1 > maxPerDay.get(x)!) ?? task.teachers[0]!;
          note('teacher-at-limit', { day: d, teacherId: t });
        } else usableMinutes += s.minutes;
      }
      if (task.minutes && task.dayNeed && usableMinutes > before) note('minutes-unbuildable', { day: d, minutes: task.dayNeed[d]! });
    }
    if (task.minutes && !task.dayNeed && usableMinutes >= missing) note('minutes-unbuildable', { minutes: missing });
    const reason = REASON_RANK.find((r) => seen.has(r)) ?? (task.group ? 'block-unavailable' : 'no-room');
    report(task.classIds, task.key, missing, task.minutes, reason, seen.get(reason) ?? base);
  }

  const drafts: EntryDraft[] = placed
    .filter((p): p is Placed => p !== null)
    .map((p) => ({
      day: p.slot.day as DayIndex,
      period: p.slot.period,
      classIds: [...p.task.classIds],
      lessons: p.task.lessons.map((l) => ({ ...l })),
      ...(p.task.group && p.task.item.kind === 'group' ? { groupKey: p.task.item.key } : {}),
    }))
    .sort((a, b) => classOrder.get(a.classIds[0]!)! - classOrder.get(b.classIds[0]!)! || a.day - b.day || a.period - b.period);
  unplaced.sort((a, b) => (classOrder.get(a.classId) ?? 0) - (classOrder.get(b.classId) ?? 0) || a.planKey.localeCompare(b.planKey));
  return { drafts, unplaced };
}
