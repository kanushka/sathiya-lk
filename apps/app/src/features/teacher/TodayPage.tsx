// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { currentAndNext, toMinutes, type DayIndex, type SnapshotCell, type TeacherSnapshot } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { cx } from '../../ui/cx';
import { cellText, cellsAt, clock, slotsOf, weekdays } from './cells';
import { TeacherFrame, type TeacherViewProps } from './TeacherFrame';

export function TodayPage(props: TeacherViewProps) {
  return (
    <TeacherFrame {...props} view="today">
      {(snap, now) => <TodayBody snap={snap} now={now} />}
    </TeacherFrame>
  );
}

function TodayBody({ snap, now }: { snap: TeacherSnapshot; now: Date }) {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang } = useLang();
  const weekday = now.getDay();
  const todayIndex: DayIndex | null = weekday >= 1 && weekday <= 5 ? ((weekday - 1) as DayIndex) : null;
  const [picked, setPicked] = useState<DayIndex | null>(null);
  const day = picked ?? todayIndex ?? 0;
  const isToday = day === todayIndex;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const { current, next, minutesLeft } = currentAndNext(snap.cells, snap.rows, now);

  return (
    <>
      <NowCard
        todayIndex={todayIndex}
        current={current}
        next={next}
        minutesLeft={minutesLeft}
        minutes={minutes}
      />

      <nav aria-label={t('teacher:days')} className="flex gap-1.5 pb-2 pt-4">
        {weekdays.map((d) => (
          <button
            key={d}
            type="button"
            aria-pressed={d === day}
            onClick={() => setPicked(d)}
            className={cx(
              'h-11 flex-1 rounded-lg text-sm font-bold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2',
              d === day ? 'border border-transparent bg-brand text-on-brand' : 'border border-line-strong bg-white text-ink-soft',
            )}
          >
            {t(`common:days.short.${d}`)}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-1.5 pt-1">
        {slotsOf(snap.rows[day] ?? []).map((slot, i) => {
          if (slot.kind === 'interval') {
            return (
              <div key={i} className="py-1 text-center text-[11px] font-bold tracking-widest text-warning">
                {t('teacher:interval')} · {clock(slot.row.start)} – {clock(slot.row.end)}
              </div>
            );
          }
          const cells = cellsAt(snap, day, slot.n);
          const past = (end: string) => isToday && toMinutes(end) <= minutes;
          if (cells.length === 0) {
            const isNow = isToday && !!current && 'free' in current && current.start === slot.row.start;
            return (
              <div
                key={i}
                data-testid={`period-${slot.n}`}
                className={cx(
                  'flex items-center gap-3 rounded-xl border border-dashed border-line-strong px-3.5 py-3',
                  past(slot.row.end) && 'opacity-55',
                )}
              >
                <PeriodLabel n={slot.n} start={slot.row.start} />
                <span className="flex-1 text-[15px] text-ink-muted">{t('teacher:freePeriod')}</span>
                {isNow && <NowTag>{t('teacher:now')}</NowTag>}
              </div>
            );
          }
          return (
            <div key={i} data-testid={`period-${slot.n}`} className="flex flex-col gap-1.5">
              {cells.map((cell, k) => {
                const isNow = isToday && cell === current;
                const text = cellText(cell, lang);
                return (
                  <div
                    key={k}
                    className={cx(
                      'flex items-center gap-3 rounded-xl px-3.5 py-3',
                      isNow ? 'border-2 border-fill-warning bg-warning-soft' : 'border border-line bg-white',
                      past(cell.end) && 'opacity-55',
                    )}
                  >
                    <PeriodLabel n={slot.n} start={cell.start} />
                    <div className="min-w-0 flex-1">
                      <b className="block text-[15px]">{text.title}</b>
                      <span className="text-[13px] text-ink-muted">{text.sub}</span>
                    </div>
                    {isNow && <NowTag>{t('teacher:now')}</NowTag>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PeriodLabel({ n, start }: { n: number; start: string }) {
  const { t } = useTranslation('common');
  return (
    <div className="w-12 shrink-0">
      <b className="block text-sm">{t('periods.periodN', { n })}</b>
      <span className="text-[11px] text-ink-muted">{clock(start)}</span>
    </div>
  );
}

function NowTag({ children }: { children: string }) {
  return <span className="text-[11px] font-extrabold text-warning">{children}</span>;
}

interface NowCardProps {
  todayIndex: DayIndex | null;
  current: ReturnType<typeof currentAndNext>['current'];
  next: SnapshotCell | undefined;
  minutesLeft: number | undefined;
  minutes: number;
}

function NowCard({ todayIndex, current, next, minutesLeft, minutes }: NowCardProps) {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang } = useLang();
  const box = 'rounded-2xl border-2 border-fill-warning bg-white px-4 py-3.5 shadow-[0_14px_30px_-18px_rgba(20,33,61,.45)]';

  if (todayIndex === null) {
    return (
      <section data-testid="now-card" className={box}>
        <p className="text-lg font-extrabold">{t('teacher:noClassesToday')}</p>
        <p className="mt-1 text-[13px] text-ink-muted">{t('teacher:noClassesTodayBody')}</p>
      </section>
    );
  }

  const nextLine = next && (
    <p className="mt-2.5 text-[13px] text-ink-muted">
      {t('teacher:next')}:{' '}
      <b className="text-ink">
        {t('common:periods.periodN', { n: next.period })} · {cellText(next, lang).sub} · {cellText(next, lang).title}
      </b>{' '}
      {clock(next.start)}
    </p>
  );

  if (!current || 'free' in current) {
    return (
      <section data-testid="now-card" className={box}>
        <p className="text-lg font-extrabold">{current ? t('teacher:freePeriod') : t('teacher:noClassNow')}</p>
        {nextLine}
      </section>
    );
  }

  const text = cellText(current, lang);
  const start = toMinutes(current.start);
  const end = toMinutes(current.end);
  const pct = Math.min(100, Math.max(0, Math.round(((minutes - start) / (end - start)) * 100)));
  return (
    <section data-testid="now-card" className={box}>
      <div className="flex items-center justify-between">
        <Badge tone="warning" className="tracking-wider">
          {t('teacher:now')} · {t('common:periods.periodN', { n: current.period })}
        </Badge>
        <span className="text-[13px] text-ink-muted">
          {clock(current.start)} – {clock(current.end)} · {t('teacher:minLeft', { n: minutesLeft ?? 0 })}
        </span>
      </div>
      <p className="mt-2.5 text-[22px] font-extrabold leading-tight">
        {text.sub} · {text.title}
      </p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-3"
      >
        <span className="block h-1.5 bg-fill-warning" style={{ width: `${pct}%` }} />
      </div>
      {nextLine}
    </section>
  );
}
