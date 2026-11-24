// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { activityName } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { cx } from '../../ui/cx';
import { cellText, cellsAt, clock, weekSkeleton, weekdays } from './cells';
import { CellNote } from './CellNote';
import type { OverlaySnapshot } from './reliefOverlay';
import { TeacherFrame, type TeacherViewProps } from './TeacherFrame';

export function WeekPage(props: TeacherViewProps) {
  return (
    <TeacherFrame {...props} view="week">
      {(snap, now) => <WeekBody snap={snap} todayWeekday={now.getDay()} />}
    </TeacherFrame>
  );
}

function WeekBody({ snap, todayWeekday }: { snap: OverlaySnapshot; todayWeekday: number }) {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang } = useLang();
  const slots = weekSkeleton(snap.rows);

  return (
    <section aria-label={t('teacher:weekGrid')} className="overflow-x-auto rounded-2xl border border-line bg-white shadow-[0_14px_30px_-18px_rgba(20,33,61,.45)]">
      <div className="grid min-w-[300px] gap-px bg-line-soft" style={{ gridTemplateColumns: '44px repeat(5, minmax(0, 1fr))' }}>
        <div className="bg-white" />
        {weekdays.map((d) => (
          <div
            key={d}
            className={cx('bg-white py-2 text-center text-xs font-bold', d === todayWeekday - 1 ? 'text-brand' : 'text-ink-soft')}
          >
            {t(`common:days.short.${d}`)}
          </div>
        ))}
        {slots.map((slot, i) =>
          slot.kind === 'interval' ? (
            <div key={i} className="col-span-6 bg-warning-soft/60 py-0.5 text-center text-[10px] font-bold tracking-widest text-warning">
              {(slot.row && activityName(slot.row, lang)) || t('teacher:interval')}
              {slot.start && slot.end ? ` · ${clock(slot.start)} – ${clock(slot.end)}` : ''}
            </div>
          ) : (
            <WeekRow key={i} n={slot.n} start={slot.start} snap={snap} lang={lang} />
          ),
        )}
      </div>
    </section>
  );
}

function WeekRow({ n, start, snap, lang }: { n: number; start?: string; snap: OverlaySnapshot; lang: 'en' | 'si' }) {
  const { t } = useTranslation('common');
  return (
    <>
      <div className="bg-white px-1 py-2 text-center">
        <b className="block text-[11px]">{t('periods.periodN', { n })}</b>
        {start && <span className="text-[10px] text-ink-muted">{clock(start)}</span>}
      </div>
      {weekdays.map((d) => {
        const cells = cellsAt(snap, d, n);
        return (
          <div key={d} data-testid={`week-cell-${d}-${n}`} className="flex min-h-[52px] flex-col gap-1 bg-white p-1">
            {cells.length === 0 ? (
              <div className="h-full min-h-[44px] rounded-md border border-dashed border-line-strong" />
            ) : (
              cells.map((cell, k) => {
                const text = cellText(cell, lang);
                return (
                  <div
                    key={k}
                    className={cx('rounded-md border-l-4 bg-surface-2 px-1.5 py-1', cell.onLeave && 'opacity-55')}
                    style={{ borderLeftColor: cell.color || 'var(--brand)' }}
                  >
                    <b className="line-clamp-2 break-words text-xs">{text.title}</b>
                    <span className="line-clamp-2 break-words text-[10px] text-ink-muted">{text.sub}</span>
                    <CellNote cell={cell} compact />
                    {!start && <span className="block text-[10px] text-ink-muted">{clock(cell.start)}</span>}
                  </div>
                );
              })
            )}
          </div>
        );
      })}
    </>
  );
}
