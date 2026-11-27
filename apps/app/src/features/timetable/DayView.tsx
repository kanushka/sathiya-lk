// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { activityName, type DayIndex, type Lang, type TemplateRow } from '@sathiya/core';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useMaybeLang } from '../../app/LangProvider';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { Icon } from '../../ui/Icon';
import { rovingKeyDown } from '../../ui/roving';
import type { CellView } from './Cell';
import type { GridOverlay } from './TimetableGrid';

const DAYS: DayIndex[] = [0, 1, 2, 3, 4];

export type TimetableMode = 'day' | 'week';

/** Today on a school day, else Monday. */
export function defaultDay(now = new Date()): DayIndex {
  const d = now.getDay() - 1;
  return (d >= 0 && d <= 4 ? d : 0) as DayIndex;
}

/** A first-run note: true the first time a viewer opens this page on this browser. */
export function firstRun(key: string): boolean {
  try {
    if (localStorage.getItem(key) === '1') return false;
    localStorage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

function Radios<V extends string>({ label, value, values, onChange, className, children }: {
  label: string;
  value: V;
  values: V[];
  onChange: (v: V) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => rovingKeyDown({ event: e, values, current: value, select: onChange, itemRole: 'radio' })}
      className={className}
    >
      {children}
    </div>
  );
}

export function ModeToggle({ value, onChange }: { value: TimetableMode; onChange: (v: TimetableMode) => void }) {
  const { t } = useTranslation('timetable');
  const modes: TimetableMode[] = ['day', 'week'];
  return (
    <Radios label={t('phone.view')} value={value} values={modes} onChange={onChange} className="inline-flex rounded-[10px] bg-surface-3">
      {modes.map((m) => (
        <Button
          key={m}
          role="radio"
          aria-checked={value === m}
          data-value={m}
          tabIndex={value === m ? 0 : -1}
          size="lg"
          variant={value === m ? 'secondary' : 'ghost'}
          onClick={() => onChange(m)}
        >
          {t(`phone.${m}`)}
        </Button>
      ))}
    </Radios>
  );
}

export function DayPicker({ value, onChange, stat }: { value: DayIndex; onChange: (d: DayIndex) => void; stat: (d: DayIndex) => { done: number; total: number } }) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const values = DAYS.map(String);
  return (
    <Radios label={t('phone.dayLabel')} value={String(value)} values={values} onChange={(v) => onChange(Number(v) as DayIndex)} className="mb-3 flex gap-1.5">
      {DAYS.map((d) => {
        const s = stat(d);
        const on = d === value;
        return (
          <Button
            key={d}
            role="radio"
            aria-checked={on}
            aria-label={t('phone.dayStat', { day: tc(`days.long.${d}`), done: s.done, total: s.total })}
            data-value={String(d)}
            tabIndex={on ? 0 : -1}
            size="lg"
            square
            variant={on ? 'primary' : 'secondary'}
            onClick={() => onChange(d)}
            className="min-w-0 flex-1 flex-col !gap-0 leading-tight"
          >
            <span className="text-sm">{tc(`days.short.${d}`)}</span>
            <span className="text-[10px] font-medium opacity-80">{t('phone.dayCount', { done: s.done, total: s.total })}</span>
          </Button>
        );
      })}
    </Radios>
  );
}

export interface DayViewProps {
  rows: Record<DayIndex, TemplateRow[]>;
  day: DayIndex;
  cellsFor(day: DayIndex, period: number): CellView | CellView[] | null;
  onSelect(day: DayIndex, period: number): void;
  onActivate?(day: DayIndex, period: number): void;
  onClear?(day: DayIndex, period: number): void;
  readOnly?: boolean;
  overlay?(day: DayIndex, period: number): GridOverlay | null;
}

/** One school day as full-width rows, one per period, for phones. */
export function DayView({ rows, day, cellsFor, onSelect, onActivate, onClear, readOnly, overlay }: DayViewProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const lang: Lang = useMaybeLang()?.lang ?? 'en';
  const root = useRef<HTMLUListElement>(null);

  function step(e: KeyboardEvent<HTMLButtonElement>, by: 1 | -1) {
    const all = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button[data-period]') ?? []);
    const next = all[all.indexOf(e.currentTarget) + by];
    if (next) {
      e.preventDefault();
      next.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, period: number, disabled: boolean) {
    if (e.key === 'ArrowDown') step(e, 1);
    else if (e.key === 'ArrowUp') step(e, -1);
    else if ((e.key === 'Delete' || e.key === 'Backspace') && onClear && !readOnly && !disabled) {
      e.preventDefault();
      onClear(day, period);
    }
  }

  let n = 0;
  return (
    <ul ref={root} aria-label={t('phone.dayList', { day: tc(`days.long.${day}`) })} className="m-0 flex list-none flex-col gap-1.5 p-0">
      {rows[day].map((r, i) => {
        if (r.type !== 'period') {
          const name = activityName(r, lang);
          return (
            <li key={`b${i}`} className="py-1 text-center text-[11px] font-bold uppercase tracking-[.06em] text-warning">
              {name ? `${name} · ${r.start}–${r.end}` : t('grid.interval', { time: `${r.start}–${r.end}` })}
            </li>
          );
        }
        const p = ++n;
        const raw = cellsFor(day, p);
        const cells = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
        const ov = overlay?.(day, p) ?? null;
        const label = { day: tc(`days.long.${day}`), n: p, time: `${r.start}–${r.end}`, title: cells.map((c) => `${c.title} ${c.sub}`).join(', ') };
        const single = !ov && cells.length === 1 ? cells[0] : undefined;
        return (
          <li key={`p${p}`}>
            <button
              type="button"
              data-period={p}
              aria-disabled={ov?.disabled || undefined}
              title={ov?.title}
              aria-label={ov ? ov.label : cells.length ? t('grid.cell', label) : t(readOnly ? 'grid.cellEmpty' : 'grid.cellAdd', label)}
              onClick={() => {
                onSelect(day, p);
                if (!readOnly && !ov?.disabled) onActivate?.(day, p);
              }}
              onKeyDown={(e) => onKeyDown(e, p, !!ov?.disabled)}
              style={single ? { background: single.color } : undefined}
              className={cx(
                'flex min-h-14 w-full items-center gap-3 rounded-[10px] border px-3 py-2 text-left text-ink focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand',
                ov ? ov.className : cells.length === 0 ? 'border-[1.5px] border-dashed border-line-strong bg-white' : single ? 'border-transparent' : 'border-line bg-white',
                readOnly || ov?.disabled ? 'cursor-default' : 'cursor-pointer',
              )}
            >
              <span className="flex w-11 shrink-0 flex-col">
                <b className="text-sm">{tc('periods.periodN', { n: p })}</b>
                <span className="text-[11px] text-ink-muted">{r.start}</span>
              </span>
              <span className="min-w-0 flex-1">
                {ov ? (
                  ov.content
                ) : cells.length === 0 ? (
                  <span className="text-[15px] text-ink-soft">{readOnly ? tc('periods.free') : t('phone.addLesson')}</span>
                ) : single ? (
                  <>
                    <span className="block text-[15px] font-semibold [overflow-wrap:anywhere]">{single.title}</span>
                    <span className="block text-[13px] text-ink-soft [overflow-wrap:anywhere]">{single.sub}</span>
                  </>
                ) : (
                  <span className="flex flex-col gap-1">
                    {cells.map((c, k) => (
                      <span key={k} className="rounded-md px-2 py-1" style={{ background: c.color }}>
                        <span className="block text-[13px] font-semibold [overflow-wrap:anywhere]">{c.title}</span>
                        <span className="block text-[11px] text-ink-soft [overflow-wrap:anywhere]">{c.sub}</span>
                      </span>
                    ))}
                  </span>
                )}
              </span>
              {!ov && cells.length > 0 && !readOnly && <Icon name="edit" size={16} className="shrink-0 text-ink-soft" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
