// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { teacherLoad } from '../availability';
import { findClass, gradeOf, templateOf } from '../lookup';
import { effectivePlan, entryPlanKey, planKey } from '../plan';
import { isMinutes } from '../staffing';
import { windowOf } from '../time';
import type { Entry, SchoolContext } from '../types';
import { classSlots } from './slots';

export interface SoftReport {
  samePattern: number;
  splitDoubles: number;
  minPerWeekShort: Array<{ teacherId: string; short: number }>;
  stacked: number;
}

export type ScoreTuple = [number, number, number, number, number];

const SPREAD_MAX_PER_WEEK = 5;

export function compareScore(a: ScoreTuple, b: ScoreTuple): number {
  for (let i = 0; i < a.length; i++) {
    const d = a[i]! - b[i]!;
    if (d !== 0) return d;
  }
  return 0;
}

export function score(ctx: SchoolContext, entries: Entry[], unplacedAmount: number): { tuple: ScoreTuple; soft: SoftReport } {
  const groups = new Map<string, { entries: Entry[]; perWeek: number; minutes: boolean; classId: string }>();
  for (const cls of ctx.classes) {
    const grade = gradeOf(ctx, cls);
    const tpl = templateOf(ctx, cls);
    if (!grade || !tpl) continue;
    const plan = effectivePlan(cls, grade);
    for (const e of entries) {
      if (!e.classIds.includes(cls.id)) continue;
      const key = entryPlanKey(e, plan);
      if (key === null) continue;
      const gk = `${cls.id}|${key}`;
      let g = groups.get(gk);
      if (!g) {
        const item = plan.find((p) => planKey(p) === key)!;
        g = { entries: [], perWeek: item.perWeek, minutes: isMinutes(item), classId: cls.id };
        groups.set(gk, g);
      }
      g.entries.push(e);
    }
  }

  let pairs = 0;
  let sharing = 0;
  let splitDoubles = 0;
  let stacked = 0;
  for (const g of groups.values()) {
    const cls = findClass(ctx, g.classId)!;
    const tpl = templateOf(ctx, cls)!;
    if (g.entries.length >= 2) {
      const starts = new Set(g.entries.map((e) => windowOf(tpl, e.day, e.period)?.start));
      pairs += 1;
      if (starts.size === 1) sharing += 1;
    }
    const byDay = new Map<number, Entry[]>();
    for (const e of g.entries) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);
    const slots = classSlots(ctx, g.classId);
    for (const [day, list] of byDay) {
      if (list.length < 2) continue;
      if (!g.minutes && g.perWeek <= SPREAD_MAX_PER_WEEK) stacked += 1;
      const periods = list.map((e) => e.period).sort((a, b) => a - b);
      const chained = periods.every((p, i) => i === 0 || slots.find((s) => s.day === day && s.period === periods[i - 1])?.nextPeriod === p);
      if (!chained) splitDoubles += 1;
    }
  }

  const minPerWeekShort: SoftReport['minPerWeekShort'] = [];
  for (const t of ctx.teachers) {
    if (t.minPerWeek === undefined) continue;
    const have = teacherLoad(t.id, entries, ctx).entries;
    if (have < t.minPerWeek) minPerWeekShort.push({ teacherId: t.id, short: t.minPerWeek - have });
  }

  const breaks = pairs - sharing;
  const shortTotal = minPerWeekShort.reduce((n, s) => n + s.short, 0);
  return {
    tuple: [unplacedAmount, breaks, splitDoubles, shortTotal, stacked],
    soft: { samePattern: pairs === 0 ? 1 : sharing / pairs, splitDoubles, minPerWeekShort, stacked },
  };
}
