// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, Entry, Lang, PinProgress, SchoolContext, TeacherPinCell } from '@sathiya/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../ui/Icon';
import { cx } from '../../ui/cx';
import { CellBody, type CellView } from './Cell';
import { blockerText, busyLabel } from './conflictLabel';
import type { GridOverlay } from './TimetableGrid';

const pinCell = 'box-border border-[1.5px] border-dashed items-center px-2.5 text-center';
const pinFree = `${pinCell} border-fill-success bg-success-soft/50 text-success`;
const pinWarn = `${pinCell} border-fill-warning-strong bg-warning-soft text-warning`;
const pinOver = `${pinCell} border-fill-over bg-danger-soft text-danger`;
const pinSuggested = 'items-center border-[1.5px] border-solid border-fill-success bg-success-soft px-2.5 text-center text-success';
const pinBusy = 'border-line bg-[repeating-linear-gradient(135deg,theme(colors.surface.3)_0_6px,theme(colors.line.DEFAULT)_6px_12px)] px-2.5 text-ink-muted';
const pinNone = 'border-line bg-surface-2 px-2.5 text-ink-muted';

function PinGlyph({ sub, note }: { sub: string; note?: string | undefined }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <Icon name="pin" size={18} strokeWidth={2} />
      <span className="text-[11px] font-semibold">{sub}</span>
      {note && <span className="text-[11px]">{note}</span>}
    </span>
  );
}

export interface PinOverlayInput {
  cell: TeacherPinCell | undefined;
  day: DayIndex;
  n: number;
  time: string;
  ctx: SchoolContext;
  lang: Lang;
  t: TFunction;
  tc: TFunction;
  names: { subject: string; teacher: string; classes: string; base: string };
  progress: PinProgress | null;
  slotMinutes?: number | null;
  suggested: boolean;
  classNote?: string;
  group?: boolean;
  teacherView?: boolean;
  entryView(e: Entry): CellView;
}

export function pinOverlayCell(a: PinOverlayInput): GridOverlay | null {
  const { cell: c, day, n, time, ctx, lang, t, tc, names, progress, slotMinutes, suggested, classNote, group, teacherView, entryView } = a;
  if (!c) return null;
  const where = { day: tc(`days.long.${day}`), n, time };
  if (c.kind === 'none') {
    return {
      label: t('pin.cellNone', { ...where, class: names.base }),
      className: pinNone,
      content: <span className="text-[11px]">{t('pin.noPeriod', { class: names.base })}</span>,
      disabled: true,
    };
  }
  if (c.kind === 'taken') {
    const view = entryView(c.entry);
    return { label: t('grid.cell', { ...where, title: `${view.title} ${view.sub}` }), className: 'border-transparent text-ink opacity-40', content: <CellBody cells={[view]} />, disabled: true };
  }
  if (c.kind === 'pinned') {
    const view = entryView(c.entry);
    return {
      label: group ? t('pin.cellPinnedGroup', { ...where, group: names.subject, classes: names.classes }) : t('pin.cellPinned', { ...where, subject: view.title, teacher: view.sub }),
      className: 'border-transparent text-ink ring-2 ring-brand ring-offset-2',
      content: <CellBody cells={[{ ...view, sub: t('pin.clickUnpin') }]} />,
    };
  }
  if (c.kind === 'busy') {
    const reasons = c.blockers.map((b) => (group ? blockerText(t, b, ctx, lang) : busyLabel(t, b, ctx, lang)));
    const all = reasons.join('; ');
    return {
      label: t('pin.cellBusy', { ...where, reason: all }),
      title: all,
      className: pinBusy,
      content: (
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold">{t('pin.busy')}</span>
          <span className="text-[11px]">{reasons[0]}</span>
          {reasons.length > 1 && <span className="text-[11px] font-semibold">{t('pin.moreBlockers', { count: reasons.length - 1 })}</span>}
        </span>
      ),
      disabled: true,
    };
  }
  const base = group
    ? t('pin.cellPinGroup', { ...where, group: names.subject, classes: names.classes })
    : teacherView
      ? t('pin.cellPinFor', { ...where, subject: names.subject, classes: names.classes })
      : t('pin.cellPin', { ...where, subject: names.subject, teacher: names.teacher });
  const label = classNote ? `${base}, ${classNote}` : base;
  if (progress && progress.left === 0) {
    return {
      label: `${label}, ${t('pin.noteOver')}`,
      className: pinOver,
      content: <PinGlyph sub={t('pin.overPlan')} note={classNote} />,
      ...(progress.full.length > 0 ? { disabled: true } : {}),
    };
  }
  if (progress && progress.unit === 'minutes' && slotMinutes != null && slotMinutes > progress.left) {
    return {
      label: `${label}, ${t('pin.noteTooLong')}`,
      className: pinOver,
      content: <PinGlyph sub={t('pin.tooLongCell')} note={classNote} />,
      disabled: true,
    };
  }
  if (suggested) {
    return {
      label: `${label}, ${t('pin.noteSuggested')}`,
      className: pinSuggested,
      content: (
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold">{t('pin.suggested')}</span>
          <span className="text-[11px]">{t('pin.clickPin')}</span>
          {classNote && <span className="text-[11px]">{classNote}</span>}
        </span>
      ),
    };
  }
  if (c.limit) {
    return { label: `${label}, ${t('pin.noteLimit', { load: c.load, max: c.max })}`, className: pinWarn, content: <PinGlyph sub={t('pin.limit', { load: c.load, max: c.max })} note={classNote} /> };
  }
  if (c.subjectThatDay) {
    const note = t('pin.subjectDay', { subject: names.subject, day: tc(`days.short.${day}`) });
    return { label: `${label}, ${note}`, className: pinWarn, content: <PinGlyph sub={note} note={classNote} /> };
  }
  return { label, className: pinFree, content: <PinGlyph sub={group ? t('pin.freeGroup') : t('pin.free')} note={classNote} /> };
}

function Swatch({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      <i aria-hidden="true" className={cx('inline-block h-3.5 w-3.5 rounded-sm', className)} />
      {children}
    </span>
  );
}

export interface PinLegendProps {
  teacher: string;
  group?: { count: number; classes: string };
  teacherRows?: { classes: string; base: string };
}

export function PinLegend({ teacher, group, teacherRows }: PinLegendProps) {
  const { t } = useTranslation('timetable');
  const free = group
    ? t('pin.legendFreeGroup', group)
    : teacherRows
      ? t('pin.legendFreeWith', { teacher, classes: teacherRows.classes })
      : t('pin.legendFree', { teacher });
  return (
    <div aria-label={t('pin.legendLabel')} className="mb-3 ml-1 flex flex-wrap gap-3.5">
      <Swatch className="border-[1.5px] border-dashed border-fill-success bg-success-soft/50">{free}</Swatch>
      <Swatch className="border-[1.5px] border-dashed border-fill-warning-strong bg-warning-soft">{t('pin.legendSubjectDay')}</Swatch>
      <Swatch className="border-[1.5px] border-dashed border-fill-over bg-danger-soft">{t('pin.legendOver')}</Swatch>
      <Swatch className="border-[1.5px] border-fill-success bg-success-soft">{t('pin.legendSuggested')}</Swatch>
      <Swatch className="bg-[repeating-linear-gradient(135deg,theme(colors.surface.3)_0_4px,theme(colors.line.DEFAULT)_4px_8px)]">{t('pin.legendBusy')}</Swatch>
      {teacherRows && <Swatch className="border border-line bg-surface-2">{t('pin.legendNone', { class: teacherRows.base })}</Swatch>}
    </div>
  );
}
