// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { activityName, addDays, addSchoolDays, schoolDayOf, toMinutes, type DayIndex, type Lang } from '@sathiya/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { cx } from '../../ui/cx';
import { IconButton } from '../../ui/IconButton';
import { Modal } from '../../ui/Modal';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { cellText, cellsAt, clock, slotsOf, weekSkeleton, weekdays } from './cells';
import { CellNote, leaveText } from './CellNote';
import { PeriodLead } from './parts';
import type { OverlayCell, OverlaySnapshot } from './reliefOverlay';
import { useTeacherData } from './teacherData';

export type TimetableMode = 'day' | '3days' | 'week';

/** What a grid needs of a snapshot: the teacher's own (with relief laid over it) or a class's. */
export type GridSnap = Pick<OverlaySnapshot, 'rows' | 'cells'>;

export interface Column {
  date: string;
  day: DayIndex;
  isToday: boolean;
  snap: GridSnap;
}

/** The first school day on or after today: today on a weekday, Monday at the weekend. */
export function firstSchoolDay(today: string): string {
  return schoolDayOf(today) === null ? addSchoolDays(today, 1).date : today;
}

export function columnDates(mode: TimetableMode, start: string): string[] {
  if (mode === 'day') return [start];
  if (mode === '3days') return [start, addSchoolDays(start, 1).date, addSchoolDays(start, 2).date];
  const monday = addDays(start, -(schoolDayOf(start) ?? 0));
  return weekdays.map((d) => addDays(monday, d));
}

export function useColumns(mode: TimetableMode, start: string): Column[] {
  const { today, snapFor } = useTeacherData();
  return columnDates(mode, start).flatMap((date) => {
    const snap = snapFor(date);
    const day = schoolDayOf(date);
    return snap && day !== null ? [{ date, day, isToday: date === today.date, snap }] : [];
  });
}

const dayNum = (date: string) => Number(date.slice(8, 10));
const monthOf = (date: string) => Number(date.slice(5, 7)) - 1;

export function useDateLabels() {
  const { t } = useTranslation('common');
  const long = (date: string) => `${t(`days.long.${schoolDayOf(date) ?? 0}`)} ${dayNum(date)} ${t(`months.${monthOf(date)}`)}`;
  const short = (date: string) => `${t(`days.short.${schoolDayOf(date) ?? 0}`)} ${dayNum(date)}`;
  const range = (dates: string[]) => {
    const first = dates[0]!;
    const last = dates[dates.length - 1]!;
    return dates.length === 1 ? long(first) : `${short(first)} – ${short(last)} ${t(`months.${monthOf(last)}`)}`;
  };
  return { long, short, range };
}

export function ModeSwitch({ value, onChange, className }: { value: TimetableMode; onChange: (m: TimetableMode) => void; className?: string }) {
  const { t } = useTranslation('teacher');
  return (
    <SegmentedControl<TimetableMode>
      aria-label={t('timetable.view')}
      value={value}
      onChange={onChange}
      options={[
        { value: 'day', label: t('timetable.day') },
        { value: '3days', label: t('timetable.threeDays') },
        { value: 'week', label: t('timetable.week') },
      ]}
      className={cx('[&>button]:flex-1', className)}
    />
  );
}

/** Day, 3 days or Week of the teacher's own timetable with relief marked, plus the earlier / later arrows. */
export function TimetableView({ mode, start, onStart, compactWeek }: { mode: TimetableMode; start: string; onStart: (date: string) => void; compactWeek: boolean }) {
  const { t } = useTranslation('teacher');
  const columns = useColumns(mode, start);
  const labels = useDateLabels();
  return (
    <div className="flex flex-col gap-2.5">
      {mode !== 'week' && (
        <div className="flex items-center gap-2">
          <IconButton icon="chevronLeft" variant="secondary" label={t('timetable.earlier')} onClick={() => onStart(addSchoolDays(start, -1).date)} className="h-11 w-11" />
          <b className="flex-1 text-center text-[15px]" aria-live="polite">
            {labels.range(columns.map((c) => c.date))}
          </b>
          <IconButton icon="chevronRight" variant="secondary" label={t('timetable.later')} onClick={() => onStart(addSchoolDays(start, 1).date)} className="h-11 w-11" />
        </div>
      )}
      {mode === 'day' && columns[0] ? <DayList column={columns[0]} /> : <TimetableGrid columns={columns} compact={mode === 'week' && compactWeek} />}
      {mode !== 'day' && (
        <p className="m-0 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Badge tone="brand" className="h-4 px-1.5 text-[11px]">
              {t('relief.tag')}
            </Badge>
            {t('timetable.legendRelief')}
          </span>
          <span>{t('timetable.legendFree')}</span>
        </p>
      )}
    </div>
  );
}

function useNowMinutes(): number {
  const { now } = useTeacherData();
  return now.getHours() * 60 + now.getMinutes();
}

const isNowCell = (cell: OverlayCell, column: Column, minutes: number) =>
  column.isToday && toMinutes(cell.start) <= minutes && minutes < toMinutes(cell.end);

/** One school day as a list: every period, free ones too, with relief and leave notes. */
export function DayList({ column }: { column: Column }) {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang } = useLang();
  const minutes = useNowMinutes();
  return (
    <ul aria-label={t('timetable.dayList')} className="m-0 list-none overflow-hidden rounded-[14px] border border-line bg-white p-0">
      {slotsOf(column.snap.rows[column.day] ?? []).map((slot, i) => {
        if (slot.kind === 'interval') {
          return (
            <li key={i} className="border-b border-line-soft bg-warning-soft/60 px-4 py-1 text-center text-[11px] font-bold tracking-[.08em] text-warning">
              {activityName(slot.row, lang) || t('teacher:interval')} · {clock(slot.row.start)}–{clock(slot.row.end)}
            </li>
          );
        }
        const cells = cellsAt(column.snap, column.day, slot.n);
        if (cells.length === 0) {
          return (
            <li key={i} data-testid={`period-${slot.n}`} className="flex min-h-[52px] items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0">
              <PeriodLead n={slot.n} start={slot.row.start} />
              <span className="text-[15px] text-ink-muted">{t('teacher:freePeriod')}</span>
            </li>
          );
        }
        return cells.map((cell, k) => (
          <LessonRow key={`${i}-${k}`} cell={cell} lang={lang} now={isNowCell(cell, column, minutes)} testId={`period-${slot.n}`} />
        ));
      })}
    </ul>
  );
}

/** One of the teacher's lessons as a list row: class · subject, relief or leave under it. */
export function LessonRow({ cell, lang, now, testId, extra }: { cell: OverlayCell; lang: Lang; now?: boolean; testId?: string; extra?: ReactNode }) {
  const { t } = useTranslation('teacher');
  const text = cellText(cell, lang);
  return (
    <li
      data-testid={testId}
      className={cx(
        'flex min-h-[52px] items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0',
        cell.relief && 'bg-brand/5',
        now && 'bg-warning-soft',
        cell.onLeave && 'opacity-60',
      )}
    >
      <PeriodLead n={cell.period} start={cell.start} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">
          {text.title} · {text.sub}
        </span>
        {cell.relief && <span className="block truncate text-[13px] text-ink-muted">{t('relief.covering', { name: cell.relief.forTeacher })}</span>}
        {cell.onLeave && <span className="block truncate text-[13px] font-semibold text-warning">{leaveText(cell, t)}</span>}
        {extra}
      </span>
      {cell.relief && <Badge tone="brand">{t('relief.tag')}</Badge>}
      {now && <span className="text-[11px] font-extrabold text-warning">{t('now')}</span>}
    </li>
  );
}

/** Columns of school days, one row per period. compact shows the class only and opens details on tap. */
export function TimetableGrid({ columns, compact }: { columns: Column[]; compact: boolean }) {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang } = useLang();
  const minutes = useNowMinutes();
  const [detail, setDetail] = useState<{ cell: OverlayCell; column: Column } | null>(null);
  const first = columns[0];
  if (!first) return null;
  const slots = weekSkeleton(first.snap.rows);
  const lead = compact ? 32 : 48;

  return (
    <div
      role="table"
      aria-label={t('teacher:weekGrid')}
      className="grid gap-1"
      style={{ gridTemplateColumns: `${lead}px repeat(${columns.length}, minmax(0, 1fr))` }}
    >
      <div role="row" className="contents">
        <span role="columnheader" />
        {columns.map((c) => (
          <span
            role="columnheader"
            key={c.date}
            className={cx('truncate py-1.5 text-center text-xs font-bold', c.isToday ? 'text-brand' : 'text-ink-soft')}
          >
            {t(`common:days.short.${c.day}`)}
            {columns.length < 5 && c.isToday ? ` · ${t('teacher:timetable.today')}` : columns.length < 5 ? ` ${dayNum(c.date)}` : ''}
          </span>
        ))}
      </div>
      {slots.map((slot, i) =>
        slot.kind === 'interval' ? (
          <div role="row" key={i} className="col-span-full rounded-md bg-warning-soft/60 py-0.5 text-center text-[10px] font-bold tracking-[.08em] text-warning">
            <span role="cell">
              {(slot.row && activityName(slot.row, lang)) || t('teacher:interval')}
              {!compact && slot.start && slot.end ? ` · ${clock(slot.start)}–${clock(slot.end)}` : ''}
            </span>
          </div>
        ) : (
          <div role="row" key={i} className="contents">
            <span role="rowheader" className="py-1 text-[11px] text-ink-muted">
              <b className="block text-xs text-ink">{t('common:periods.periodN', { n: slot.n })}</b>
              {!compact && slot.start && clock(slot.start)}
            </span>
            {columns.map((column) => {
              const cells = cellsAt(column.snap, column.day, slot.n);
              return (
                <div role="cell" key={column.date} data-testid={`cell-${column.date}-${slot.n}`} className="flex min-w-0 flex-col gap-1">
                  {cells.length === 0 ? (
                    <span className={cx('block flex-1 rounded-[7px] border border-dashed border-line-strong', compact ? 'min-h-10' : 'min-h-12')} />
                  ) : (
                    cells.map((cell, k) => (
                      <GridCell
                        key={k}
                        cell={cell}
                        lang={lang}
                        compact={compact}
                        now={isNowCell(cell, column, minutes)}
                        onOpen={compact ? () => setDetail({ cell, column }) : undefined}
                      />
                    ))
                  )}
                </div>
              );
            })}
          </div>
        ),
      )}
      {detail && <CellDetail cell={detail.cell} column={detail.column} lang={lang} onClose={() => setDetail(null)} />}
    </div>
  );
}

function GridCell({ cell, lang, compact, now, onOpen }: { cell: OverlayCell; lang: Lang; compact: boolean; now: boolean; onOpen?: () => void }) {
  const { t } = useTranslation('teacher');
  const text = cellText(cell, lang);
  const box = cx(
    'block w-full min-w-0 overflow-hidden rounded-[7px] px-1.5 py-1 text-left text-[11px] leading-tight',
    compact ? 'min-h-10' : 'min-h-12',
    cell.relief ? 'border border-brand/30 bg-brand/10' : 'bg-surface-2',
    cell.onLeave && 'opacity-55',
    now && 'outline outline-2 outline-fill-warning',
  );
  const body = (
    <>
      <b className="line-clamp-2 block break-words text-xs">{text.title}</b>
      {!compact && <span className="line-clamp-2 block break-words text-ink-muted">{cell.relief ? (cell.relief.note ?? t('relief.tag')) : text.sub}</span>}
      {!compact && cell.onLeave && <CellNote cell={cell} compact />}
    </>
  );
  if (!onOpen) return <div className={box}>{body}</div>;
  const label = [text.title, text.sub, cell.relief ? t('relief.tag') : null].filter(Boolean).join(', ');
  return (
    <button type="button" onClick={onOpen} aria-label={label} className={cx(box, 'focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand')}>
      {body}
    </button>
  );
}

function CellDetail({ cell, column, lang, onClose }: { cell: OverlayCell; column: Column; lang: Lang; onClose: () => void }) {
  const { t } = useTranslation(['teacher', 'common']);
  const labels = useDateLabels();
  const text = cellText(cell, lang);
  return (
    <Modal open title={`${text.title} · ${text.sub}`} subtitle={labels.long(column.date)} onClose={onClose} width={420}>
      <ul className="m-0 list-none overflow-hidden rounded-[14px] border border-line bg-white p-0">
        <li className="flex justify-between gap-3 border-b border-line-soft px-4 py-3 text-sm">
          <span className="text-ink-muted">{t('common:periods.period')}</span>
          <b className="font-semibold">
            {t('common:periods.periodN', { n: cell.period })} · {clock(cell.start)}–{clock(cell.end)}
          </b>
        </li>
        {(cell.relief || cell.onLeave) && (
          <li className="px-4 py-3 text-sm">
            <CellNote cell={cell} />
          </li>
        )}
      </ul>
    </Modal>
  );
}

/** Stateful Day / 3 days / Week with its own start date, starting on today. */
export function useTimetableState(initial: TimetableMode) {
  const { today } = useTeacherData();
  const [mode, setMode] = useState<TimetableMode>(initial);
  const [start, setStart] = useState(() => firstSchoolDay(today.date));
  return { mode, setMode, start, setStart };
}
