// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  pickName,
  reliefSlots,
  teacherDisplayName,
  type DayIndex,
  type Lang,
  type Leave,
  type Relief,
  type ReliefDay,
  type ReliefNotified,
  type ReliefStats,
  type SchoolContext,
  type Teacher,
  type TeacherSnapshot,
} from '@sathiya/core';

export interface DayDraft {
  leaves: Leave[];
  reliefs: Relief[];
}

export const reliefKey = (r: Pick<Relief, 'entryId' | 'absentTeacherId'>): string => `${r.entryId}|${r.absentTeacherId}`;

export function withLeaves(leaves: Leave[], prev: Relief[], snaps: Map<string, TeacherSnapshot>, day: DayIndex): DayDraft {
  const picks = new Map(prev.map((r) => [reliefKey(r), r.reliefTeacherId]));
  const reliefs = reliefSlots(leaves, snaps, day).map((s) => ({ ...s, reliefTeacherId: picks.get(reliefKey(s)) ?? null }));
  return { leaves, reliefs };
}

function countsOf(reliefs: Relief[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of reliefs) if (r.reliefTeacherId !== null) out[r.reliefTeacherId] = (out[r.reliefTeacherId] ?? 0) + 1;
  return out;
}

export function countsExcludingSaved(stats: ReliefStats, saved: ReliefDay | null): Record<string, number> {
  const out = { ...stats.counts };
  for (const [t, n] of Object.entries(countsOf(saved?.reliefs ?? []))) out[t] = Math.max(0, (out[t] ?? 0) - n);
  return out;
}

function canonical(d: DayDraft): string {
  const leaves = d.leaves.map((l) => [l.teacherId, l.type, [...l.entryIds].sort()] as const).sort((a, b) => a[0].localeCompare(b[0]));
  const reliefs = d.reliefs.map((r) => [reliefKey(r), r.reliefTeacherId] as const).sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify([leaves, reliefs]);
}

export const sameDraft = (a: DayDraft, b: DayDraft): boolean => canonical(a) === canonical(b);

export function weekdayOf(date: string): DayIndex | null {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return Number.isNaN(d) || d === 0 || d === 6 ? null : ((d - 1) as DayIndex);
}

export const isIsoDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
export const colomboTime = (ms: number): string => timeFmt.format(ms);

export function formatDate(date: string, lang: Lang): string {
  const fmt = new Intl.DateTimeFormat(lang === 'si' ? 'si-LK' : 'en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
  return fmt.format(new Date(`${date}T00:00:00Z`)).replace(',', '');
}

export type EmailStatus = { kind: 'pending' } | { kind: 'sent'; at: number } | { kind: 'noEmail' } | null;

export function emailStatus(tid: string, notified: ReliefNotified | null, teacher: Teacher | undefined): EmailStatus {
  if (notified?.pending?.[tid] !== undefined) return { kind: 'pending' };
  const sent = notified?.sent?.[tid];
  if (sent) return { kind: 'sent', at: sent.at };
  if (teacher && !teacher.email?.trim() && !teacher.uid) return { kind: 'noEmail' };
  return null;
}

export interface Names {
  teacher(id: string): string;
  lesson(x: { period: number; start: string; classIds?: string[]; subjectId?: string; title?: string }): string;
}

export function namesFor(school: Pick<SchoolContext, 'teachers' | 'classes' | 'subjects'>, lang: Lang, saved: ReliefDay | null, snaps: Map<string, TeacherSnapshot>, period: (n: number) => string): Names {
  const teachers = new Map(school.teachers.map((t) => [t.id, t]));
  const classes = new Map(school.classes.map((c) => [c.id, c.name]));
  const subjects = new Map(school.subjects.map((s) => [s.id, s]));
  return {
    teacher(id) {
      const t = teachers.get(id);
      if (t) return teacherDisplayName(t, lang);
      const n = saved?.names[id];
      if (n) return (lang === 'si' && n.si) || n.en;
      const s = snaps.get(id);
      return (s && ((lang === 'si' && s.nameSi) || s.name)) || id;
    },
    lesson(x) {
      const cls = x.classIds?.length ? x.classIds.map((c) => classes.get(c) ?? c).join('+') : (x.title ?? '');
      const subject = x.subjectId ? subjects.get(x.subjectId) : undefined;
      return [period(x.period), x.start, [cls, subject && pickName(subject, lang)].filter(Boolean).join(' ')].join(' · ');
    },
  };
}
