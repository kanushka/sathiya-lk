// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  effectivePlan,
  pickName,
  pinProgress,
  pinSlots,
  specDraft,
  suggestPins,
  teacherDisplayName,
  teacherPinSlots,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type PinProgress,
  type PinSpec,
  type SchoolContext,
  type TeacherPinCell,
} from '@sathiya/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { classNames } from './conflictLabel';
import { planItemColor } from './labels';
import type { Slot } from './TimetableGrid';

export type PinView = { kind: 'class' } | { kind: 'teacher'; teacherId: string };

export interface PinNames {
  title: string;
  detail?: string;
  subject: string;
  teacher: string;
  classes: string;
  color: string;
}

interface RowSlot {
  day: DayIndex;
  period: number;
  classPeriod: number | null;
  cell: TeacherPinCell;
}

export interface PinMode {
  target: PinSpec | null;
  slots: Array<{ day: DayIndex; period: number; cell: TeacherPinCell }>;
  progress: PinProgress | null;
  suggested: Slot[];
  message: string;
  names: PinNames | null;
  cellAt(day: DayIndex, n: number): TeacherPinCell | undefined;
  periodAt(day: DayIndex, n: number): number | null;
  isSuggested(day: DayIndex, n: number): boolean;
  start(target: PinSpec): void;
  stop(): void;
  toggle(day: DayIndex, n: number): Promise<void>;
  suggest(): void;
  pinSuggested(): Promise<void>;
}

export function usePinMode(args: {
  ctx: SchoolContext;
  entries: Entry[];
  save(d: EntryDraft): Promise<boolean>;
  remove(id: string): Promise<boolean>;
  view: PinView;
}): PinMode {
  const { ctx, entries, save, remove, view } = args;
  const teacherViewId = view.kind === 'teacher' ? view.teacherId : null;
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const [target, setTarget] = useState<PinSpec | null>(null);
  const [rawSuggested, setRawSuggested] = useState<Slot[]>([]);
  const [message, setMessage] = useState('');

  const slots = useMemo<RowSlot[]>(() => {
    if (!target) return [];
    if (teacherViewId !== null) {
      return teacherPinSlots({ ctx, entries, spec: target, teacherId: teacherViewId }).map((s) => ({ day: s.day, period: s.row, classPeriod: s.period, cell: s.cell }));
    }
    return pinSlots({ ctx, entries, spec: target }).map((s) => ({ day: s.day, period: s.period, classPeriod: s.period, cell: s.cell }));
  }, [ctx, entries, target, teacherViewId]);
  const progress = useMemo(() => (target ? pinProgress({ ctx, entries, spec: target }) : null), [ctx, entries, target]);
  const slotAt = useCallback((day: DayIndex, n: number) => slots.find((s) => s.day === day && s.period === n), [slots]);
  const cellAt = useCallback((day: DayIndex, n: number) => slotAt(day, n)?.cell, [slotAt]);
  const periodAt = useCallback((day: DayIndex, n: number) => slotAt(day, n)?.classPeriod ?? null, [slotAt]);

  const suggested = useMemo(() => {
    const out: Slot[] = [];
    for (const r of rawSuggested) {
      const s = slots.find((x) => x.day === r.day && x.classPeriod === r.period);
      if (s && s.cell.kind === 'free') out.push({ day: s.day, period: s.period });
    }
    return out.slice(0, progress?.left ?? 0);
  }, [rawSuggested, slots, progress]);
  const seq = useRef(new Map<string, number>());
  const isSuggested = useCallback((day: DayIndex, n: number) => suggested.some((s) => s.day === day && s.period === n), [suggested]);

  const namesFor = useCallback(
    (spec: PinSpec): PinNames => {
      const classes = classNames(ctx, spec.classIds);
      const subjectOf = (id: string) => {
        const s = ctx.subjects.find((x) => x.id === id);
        return s ? pickName(s, lang) : id;
      };
      const teacherOf = (id: string) => {
        const x = ctx.teachers.find((y) => y.id === id);
        return x ? teacherDisplayName(x, lang) : '';
      };
      const base = ctx.classes.find((c) => c.id === spec.classIds[0]);
      const template = teacherViewId !== null && base ? ctx.templates.find((x) => x.id === base.templateId) : undefined;
      const templateNote = base && template && !template.isDefault ? t('pin.otherTemplate', { class: base.name, template: template.name }) : undefined;
      if (spec.groupKey === undefined) {
        const lesson = spec.lessons[0];
        const subject = lesson ? subjectOf(lesson.subjectId) : '';
        const teacher = lesson ? teacherOf(lesson.teacherId) : '';
        const sub = lesson && ctx.subjects.find((x) => x.id === lesson.subjectId);
        return {
          title: teacherViewId !== null ? t('pin.teacherTarget', { subject, classes }) : t('pin.target', { subject, teacher }),
          ...(templateNote ? { detail: templateNote } : {}),
          subject,
          teacher,
          classes,
          color: sub ? sub.color : '#E9E9E9',
        };
      }
      const grade = base && ctx.grades.find((g) => g.id === base.gradeId);
      const item = base && grade ? effectivePlan(base, grade).find((p) => p.kind === 'group' && p.key === spec.groupKey) : undefined;
      const group = item ? pickName(item as { nameEn: string; nameSi?: string }, lang) : spec.groupKey;
      const teachers = [...new Set(spec.lessons.map((l) => teacherOf(l.teacherId)))].join(', ');
      return {
        title: t('pin.targetGroup', { group, classes }),
        detail: [...spec.lessons.map((l) => t('pin.groupLesson', { subject: subjectOf(l.subjectId), teacher: teacherOf(l.teacherId) })), ...(templateNote ? [templateNote] : [])].join(' · '),
        subject: group,
        teacher: teachers,
        classes,
        color: item ? planItemColor(item, ctx) : '#E9E9E9',
      };
    },
    [ctx, lang, t, teacherViewId],
  );
  const names = useMemo(() => (target ? namesFor(target) : null), [target, namesFor]);

  const start = useCallback(
    (next: PinSpec) => {
      const n = namesFor(next);
      setTarget(next);
      setRawSuggested([]);
      setMessage(next.groupKey === undefined ? t('pin.started', { subject: n.subject, teacher: n.teacher }) : t('pin.startedGroup', { group: n.subject, classes: n.classes }));
    },
    [namesFor, t],
  );

  const stop = useCallback(() => {
    setTarget(null);
    setRawSuggested([]);
    setMessage(t('pin.stopped'));
  }, [t]);

  const toggle = useCallback(
    async (day: DayIndex, n: number) => {
      const c = cellAt(day, n);
      const period = periodAt(day, n);
      if (!target || !c || !names) return;
      const where = { day: tc(`days.long.${day}`), n, subject: names.subject };
      const key = `${day}-${n}`;
      const mine = (seq.current.get(key) ?? 0) + 1;
      seq.current.set(key, mine);
      const latest = () => seq.current.get(key) === mine;
      if (c.kind === 'pinned') {
        const ok = await remove(c.entry.id);
        if (ok && latest()) setMessage(t('pin.unpinned', where));
      } else if (c.kind === 'free' && period !== null) {
        setRawSuggested((list) => list.filter((s) => s.day !== day || s.period !== period));
        const ok = await save(specDraft(target, day, period));
        if (latest()) setMessage(ok ? t('pin.pinned', where) : '');
      }
    },
    [cellAt, periodAt, target, names, tc, remove, save, t],
  );

  const suggest = useCallback(() => {
    if (!target || !progress || !names) return;
    const picks = suggestPins({ ctx, entries, spec: target, count: progress.left });
    setRawSuggested(picks);
    setMessage(
      picks.length > 0
        ? t('pin.suggestedMsg', { count: picks.length })
        : target.groupKey === undefined
          ? t('pin.noSuggest', { teacher: names.teacher })
          : t('pin.noSuggestGroup', { group: names.subject }),
    );
  }, [target, progress, names, ctx, entries, t]);

  const pinSuggested = useCallback(async () => {
    if (!target || !names) return;
    const list = suggested;
    setRawSuggested([]);
    let done = 0;
    for (const s of list) {
      const period = periodAt(s.day, s.period);
      if (period === null || !(await save(specDraft(target, s.day, period)))) break;
      done += 1;
    }
    setMessage(done > 0 ? t('pin.pinnedMany', { count: done, subject: names.subject }) : '');
  }, [target, names, suggested, periodAt, save, t]);

  return { target, slots, progress, suggested, message, names, cellAt, periodAt, isSuggested, start, stop, toggle, suggest, pinSuggested };
}
