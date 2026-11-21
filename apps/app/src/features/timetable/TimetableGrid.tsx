import type { DayIndex, TemplateRow } from '@sathiya/core';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../ui/cx';
import { CellBody, type CellView } from './Cell';

export type { CellView } from './Cell';

export interface Slot {
  day: DayIndex;
  period: number;
}

export interface TimetableGridProps {
  rows: Record<DayIndex, TemplateRow[]>;
  cellsFor(day: DayIndex, period: number): CellView | CellView[] | null;
  selected?: Slot;
  onSelect(day: DayIndex, period: number): void;
  onActivate?(day: DayIndex, period: number): void;
  onClear?(day: DayIndex, period: number): void;
  readOnly?: boolean;
  headerExtra?(day: DayIndex): ReactNode;
}

const DAYS: DayIndex[] = [0, 1, 2, 3, 4];

type RefRow = { kind: 'interval'; start: string; end: string } | { kind: 'period'; n: number };

function periodTimes(rows: TemplateRow[]): Map<number, { start: string; end: string }> {
  const map = new Map<number, { start: string; end: string }>();
  let n = 0;
  for (const r of rows) if (r.type === 'period') map.set(++n, { start: r.start, end: r.end });
  return map;
}

export function TimetableGrid({ rows, cellsFor, selected, onSelect, onActivate, onClear, readOnly, headerExtra }: TimetableGridProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const root = useRef<HTMLDivElement>(null);

  const refDay = DAYS.reduce((best, d) => (rows[d].length > rows[best].length ? d : best), 0 as DayIndex);
  const times = Object.fromEntries(DAYS.map((d) => [d, periodTimes(rows[d])])) as Record<DayIndex, ReturnType<typeof periodTimes>>;
  let n = 0;
  const refRows: RefRow[] = rows[refDay].map((r) =>
    r.type === 'interval' ? { kind: 'interval', start: r.start, end: r.end } : { kind: 'period', n: ++n },
  );
  const periodRows = refRows.filter((r): r is Extract<RefRow, { kind: 'period' }> => r.kind === 'period');

  const exists = (day: DayIndex, period: number) => times[day].has(period);
  const tabSlot: Slot | undefined =
    selected && exists(selected.day, selected.period)
      ? selected
      : DAYS.flatMap((d) => periodRows.map((r) => ({ day: d, period: r.n }))).find((s) => exists(s.day, s.period));

  function focusSlot(day: DayIndex, period: number) {
    root.current?.querySelector<HTMLButtonElement>(`[data-day="${day}"][data-period="${period}"]`)?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, day: DayIndex, period: number) {
    let next: Slot | null = null;
    if (e.key === 'ArrowRight') next = { day: (day + 1) as DayIndex, period };
    else if (e.key === 'ArrowLeft') next = { day: (day - 1) as DayIndex, period };
    else if (e.key === 'ArrowDown') next = { day, period: period + 1 };
    else if (e.key === 'ArrowUp') next = { day, period: period - 1 };
    if (next) {
      e.preventDefault();
      if (next.day >= 0 && next.day <= 4 && exists(next.day, next.period)) {
        onSelect(next.day, next.period);
        focusSlot(next.day, next.period);
      }
      return;
    }
    if (readOnly) return;
    if (e.key === 'Enter' && onActivate) {
      e.preventDefault();
      onActivate(day, period);
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && onClear) {
      e.preventDefault();
      onClear(day, period);
    }
  }

  function onClick(day: DayIndex, period: number) {
    if (selected && selected.day === day && selected.period === period) {
      if (!readOnly) onActivate?.(day, period);
    } else onSelect(day, period);
  }

  return (
    <div ref={root} role="group" aria-label={t('grid.label')} className="overflow-x-auto">
      <div className="grid min-w-[660px] gap-1.5" style={{ gridTemplateColumns: '92px repeat(5,minmax(110px,1fr))' }}>
        <span />
        {DAYS.map((d) => (
          <div key={d} className="flex flex-col items-center py-1.5">
            <b className="text-[13px] text-ink-muted">{tc(`days.short.${d}`)}</b>
            {headerExtra?.(d)}
          </div>
        ))}
        {refRows.map((r, i) => {
          if (r.kind === 'interval') {
            return (
              <div
                key={`i${i}`}
                className="flex items-center gap-2.5 rounded-lg bg-[#FBF1DC] px-2.5 py-1 text-xs font-bold text-[#7A5410]"
                style={{ gridColumn: '1 / -1' }}
              >
                {t('grid.interval', { time: `${r.start}–${r.end}` })}
              </div>
            );
          }
          const refTime = times[refDay].get(r.n);
          return [
            <div key={`l${i}`} className="flex flex-col justify-center pl-1">
              <b className="text-sm">{tc('periods.periodN', { n: r.n })}</b>
              <span className="text-[11px] text-[#8A91A3]">{refTime ? `${refTime.start}–${refTime.end}` : ''}</span>
            </div>,
            ...DAYS.map((d) => {
              const time = times[d].get(r.n);
              if (!time) return <span key={`${i}-${d}`} />;
              const raw = cellsFor(d, r.n);
              const cells = raw === null ? [] : Array.isArray(raw) ? raw : [raw];
              const on = selected?.day === d && selected.period === r.n;
              const label = {
                day: tc(`days.long.${d}`),
                n: r.n,
                time: `${time.start}–${time.end}`,
                title: cells.map((c) => `${c.title} ${c.sub}`).join(', '),
              };
              return (
                <button
                  key={`${i}-${d}`}
                  type="button"
                  data-day={d}
                  data-period={r.n}
                  tabIndex={tabSlot && tabSlot.day === d && tabSlot.period === r.n ? 0 : -1}
                  aria-pressed={on}
                  aria-label={cells.length ? t('grid.cell', label) : t(readOnly ? 'grid.cellEmpty' : 'grid.cellAdd', label)}
                  onClick={() => onClick(d, r.n)}
                  onKeyDown={(e) => onKeyDown(e, d, r.n)}
                  className={cx(
                    'box-border flex min-h-[58px] flex-col justify-center rounded-[10px] border p-1 text-left text-ink',
                    cells.length === 0 ? 'border-[1.5px] border-dashed border-[#C9CDD6] bg-white text-[#8A91A3] px-2.5 items-center' : 'border-transparent',
                    on && 'shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--brand)]',
                    readOnly ? 'cursor-default' : 'cursor-pointer',
                  )}
                >
                  <CellBody cells={cells} readOnly={readOnly} />
                </button>
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}
