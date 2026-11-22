// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { DayIndex, Entry, Lang, PinProgress, SchoolContext, TeacherPinCell } from '@sathiya/core';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Icon } from '../../ui/Icon';
import { cx } from '../../ui/cx';
import { CellBody, type CellView } from './Cell';
import { busyLabel } from './conflictLabel';
import type { GridOverlay } from './TimetableGrid';

const pinCell = 'box-border border-[1.5px] border-dashed items-center px-2.5 text-center';
const pinFree = `${pinCell} border-[#2E8B4A] bg-[#F5FBF6] text-[#1F6B34]`;
const pinWarn = `${pinCell} border-[#B7831F] bg-[#FFF6E2] text-[#6B4A0E]`;
const pinOver = `${pinCell} border-[#C2410C] bg-[#FDECEA] text-[#9A3412]`;
const pinSuggested = 'items-center border-[1.5px] border-solid border-[#2E8B4A] bg-[#E4F2E7] px-2.5 text-center text-[#1F6B34]';
const pinBusy = 'border-line bg-[repeating-linear-gradient(135deg,#F1F2F5_0_6px,#E4E6EC_6px_12px)] px-2.5 text-ink-muted';
const pinNone = 'border-line bg-[#F6F7F9] px-2.5 text-ink-muted';

function PinGlyph({ sub }: { sub: string }) {
  return (
    <span className="flex flex-col items-center gap-0.5">
      <Icon name="pin" size={18} strokeWidth={2} />
      <span className="text-[11px] font-semibold">{sub}</span>
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
  names: { subject: string; teacher: string; classes: string };
  progress: PinProgress | null;
  suggested: boolean;
  classNote?: string;
  group?: boolean;
  entryView(e: Entry): CellView;
}

export function pinOverlayCell(a: PinOverlayInput): GridOverlay | null {
  const { cell: c, day, n, time, ctx, lang, t, tc, names, progress, suggested, classNote, group, entryView } = a;
  if (!c) return null;
  const where = { day: tc(`days.long.${day}`), n, time };
  if (c.kind === 'none') {
    return {
      label: t('pin.cellNone', { ...where, class: names.classes }),
      className: pinNone,
      content: <span className="text-[11px]">{t('pin.noPeriod', { class: names.classes })}</span>,
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
      label: group ? t('pin.cellPinnedGroup', { ...where, group: view.title, classes: names.classes }) : t('pin.cellPinned', { ...where, subject: view.title, teacher: view.sub }),
      className: 'border-transparent text-ink ring-2 ring-brand ring-offset-2',
      content: <CellBody cells={[{ ...view, sub: t('pin.clickUnpin') }]} />,
    };
  }
  if (c.kind === 'busy') {
    const reasons = c.blockers.map((b) => busyLabel(t, b, ctx, lang));
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
  const base = group ? t('pin.cellPinGroup', { ...where, group: names.subject, classes: names.classes }) : t('pin.cellPin', { ...where, subject: names.subject, teacher: names.teacher });
  const label = classNote ? `${base}, ${classNote}` : base;
  if (progress && progress.left === 0) {
    return { label: `${label}, ${t('pin.noteOver')}`, className: pinOver, content: <PinGlyph sub={t('pin.overPlan')} /> };
  }
  if (suggested) {
    return {
      label: `${label}, ${t('pin.noteSuggested')}`,
      className: pinSuggested,
      content: (
        <span className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold">{t('pin.suggested')}</span>
          <span className="text-[11px]">{t('pin.clickPin')}</span>
        </span>
      ),
    };
  }
  if (c.limit) {
    return { label: `${label}, ${t('pin.noteLimit', { load: c.load, max: c.max })}`, className: pinWarn, content: <PinGlyph sub={t('pin.limit', { load: c.load, max: c.max })} /> };
  }
  if (c.subjectThatDay) {
    const note = t('pin.subjectDay', { subject: names.subject, day: tc(`days.short.${day}`) });
    return { label: `${label}, ${note}`, className: pinWarn, content: <PinGlyph sub={note} /> };
  }
  return { label, className: pinFree, content: <PinGlyph sub={group ? t('pin.freeGroup') : t('pin.free')} /> };
}

function Swatch({ className, children }: { className: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
      <i aria-hidden="true" className={cx('inline-block h-3.5 w-3.5 rounded', className)} />
      {children}
    </span>
  );
}

export function PinLegend({ teacher, group }: { teacher: string; group?: { count: number; classes: string } }) {
  const { t } = useTranslation('timetable');
  return (
    <div aria-label={t('pin.legendLabel')} className="mb-3 ml-1 flex flex-wrap gap-3.5">
      <Swatch className="border-[1.5px] border-dashed border-[#2E8B4A] bg-[#F5FBF6]">{group ? t('pin.legendFreeGroup', group) : t('pin.legendFree', { teacher })}</Swatch>
      <Swatch className="border-[1.5px] border-dashed border-[#B7831F] bg-[#FFF6E2]">{t('pin.legendSubjectDay')}</Swatch>
      <Swatch className="border-[1.5px] border-dashed border-[#C2410C] bg-[#FDECEA]">{t('pin.legendOver')}</Swatch>
      <Swatch className="border-[1.5px] border-[#2E8B4A] bg-[#E4F2E7]">{t('pin.legendSuggested')}</Swatch>
      <Swatch className="bg-[repeating-linear-gradient(135deg,#EEF0F3_0_4px,#DADDE4_4px_8px)]">{t('pin.legendBusy')}</Swatch>
    </div>
  );
}
