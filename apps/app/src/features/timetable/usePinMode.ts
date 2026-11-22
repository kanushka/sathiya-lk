// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import {
  pickName,
  pinProgress,
  pinSlots,
  singleSpec,
  suggestPins,
  teacherDisplayName,
  type DayIndex,
  type Entry,
  type EntryDraft,
  type PinCell,
  type PinProgress,
  type PinSlot,
  type SchoolContext,
} from '@sathiya/core';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import type { PinTarget } from './AssignPicker';
import type { Slot } from './TimetableGrid';

export interface PinMode {
  target: PinTarget | null;
  slots: PinSlot[];
  progress: PinProgress | null;
  suggested: Slot[];
  message: string;
  cellAt(day: DayIndex, period: number): PinCell | undefined;
  isSuggested(day: DayIndex, period: number): boolean;
  start(target: PinTarget): void;
  stop(): void;
  toggle(day: DayIndex, period: number): Promise<void>;
  suggest(): void;
  pinSuggested(): Promise<void>;
}

export function usePinMode(args: {
  ctx: SchoolContext;
  classId: string;
  entries: Entry[];
  save(d: EntryDraft): Promise<boolean>;
  remove(id: string): Promise<boolean>;
}): PinMode {
  const { ctx, classId, entries, save, remove } = args;
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const [target, setTarget] = useState<PinTarget | null>(null);
  const [rawSuggested, setRawSuggested] = useState<Slot[]>([]);
  const [message, setMessage] = useState('');

  const slots = useMemo(() => (target ? pinSlots({ ctx, entries, spec: singleSpec(classId, target.subjectId, target.teacherId) }) : []), [ctx, entries, classId, target]);
  const progress = useMemo(() => (target ? pinProgress({ ctx, entries, spec: singleSpec(classId, target.subjectId, target.teacherId) }) : null), [ctx, entries, classId, target]);
  const cellAt = useCallback((day: DayIndex, period: number) => slots.find((s) => s.day === day && s.period === period)?.cell, [slots]);
  const suggested = useMemo(
    () => rawSuggested.filter((s) => cellAt(s.day, s.period)?.kind === 'free').slice(0, progress?.left ?? 0),
    [rawSuggested, cellAt, progress],
  );
  const seq = useRef(new Map<string, number>());
  const isSuggested = useCallback((day: DayIndex, period: number) => suggested.some((s) => s.day === day && s.period === period), [suggested]);

  const subjectName = useCallback(() => {
    const s = target && ctx.subjects.find((x) => x.id === target.subjectId);
    return s ? pickName(s, lang) : (target?.subjectId ?? '');
  }, [ctx.subjects, target, lang]);

  const draftFor = useCallback(
    (day: DayIndex, period: number, tg: PinTarget): EntryDraft => ({ day, period, classIds: [classId], lessons: [{ subjectId: tg.subjectId, teacherId: tg.teacherId }] }),
    [classId],
  );

  const start = useCallback(
    (next: PinTarget) => {
      const s = ctx.subjects.find((x) => x.id === next.subjectId);
      const teacher = ctx.teachers.find((x) => x.id === next.teacherId);
      setTarget(next);
      setRawSuggested([]);
      setMessage(t('pin.started', { subject: s ? pickName(s, lang) : next.subjectId, teacher: teacher ? teacherDisplayName(teacher, lang) : '' }));
    },
    [ctx.subjects, ctx.teachers, t, lang],
  );

  const stop = useCallback(() => {
    setTarget(null);
    setRawSuggested([]);
    setMessage(t('pin.stopped'));
  }, [t]);

  const toggle = useCallback(
    async (day: DayIndex, period: number) => {
      const c = cellAt(day, period);
      if (!target || !c) return;
      const where = { day: tc(`days.long.${day}`), n: period, subject: subjectName() };
      const key = `${day}-${period}`;
      const mine = (seq.current.get(key) ?? 0) + 1;
      seq.current.set(key, mine);
      const latest = () => seq.current.get(key) === mine;
      if (c.kind === 'pinned') {
        const ok = await remove(c.entry.id);
        if (ok && latest()) setMessage(t('pin.unpinned', where));
      } else if (c.kind === 'free') {
        setRawSuggested((list) => list.filter((s) => s.day !== day || s.period !== period));
        const ok = await save(draftFor(day, period, target));
        if (latest()) setMessage(ok ? t('pin.pinned', where) : '');
      }
    },
    [cellAt, target, tc, subjectName, remove, save, draftFor, t],
  );

  const suggest = useCallback(() => {
    if (!target || !progress) return;
    const picks = suggestPins({ ctx, entries, spec: singleSpec(classId, target.subjectId, target.teacherId), count: progress.left });
    setRawSuggested(picks);
    const teacher = ctx.teachers.find((x) => x.id === target.teacherId);
    setMessage(picks.length > 0 ? t('pin.suggestedMsg', { count: picks.length }) : t('pin.noSuggest', { teacher: teacher ? teacherDisplayName(teacher, lang) : '' }));
  }, [target, progress, ctx, entries, classId, t, lang]);

  const pinSuggested = useCallback(async () => {
    if (!target) return;
    const list = suggested;
    setRawSuggested([]);
    let done = 0;
    for (const s of list) {
      if (!(await save(draftFor(s.day, s.period, target)))) break;
      done += 1;
    }
    setMessage(done > 0 ? t('pin.pinnedMany', { count: done, subject: subjectName() }) : '');
  }, [target, suggested, save, draftFor, t, subjectName]);

  return { target, slots, progress, suggested, message, cellAt, isSuggested, start, stop, toggle, suggest, pinSuggested };
}
