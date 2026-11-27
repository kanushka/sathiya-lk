// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { addDays, currentAndNext, toMinutes, type Lang } from '@sathiya/core';
import { Trans, useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { LinkButton } from '../../ui/LinkButton';
import { ListSection } from '../../ui/GroupedList';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { cellText, clock } from './cells';
import { greetingKey } from './colomboNow';
import { PageTitle, SnapshotGate, printTimetablePath } from './parts';
import type { OverlayCell, OverlaySnapshot } from './reliefOverlay';
import { useTeacherData } from './teacherData';
import { LessonRow, ModeSwitch, TimetableView, useDateLabels, useTimetableState } from './TimetableView';

export function TodayPage() {
  return <SnapshotGate>{() => <TodayBody />}</SnapshotGate>;
}

function TodayBody() {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang } = useLang();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const { now, today, next, snapFor, base, sid } = useTeacherData();
  const snap = snapFor(today.date)!;
  const nextSnap = snapFor(next.date)!;
  const minutes = now.getHours() * 60 + now.getMinutes();
  const { current, next: nextCell, minutesLeft } = currentAndNext(snap.cells, snap.rows, now);

  const todays = today.day === null ? [] : snap.cells.filter((c) => c.day === today.day);
  const reliefToday = todays.filter((c) => c.relief);
  const rest = todays.filter((c) => !c.relief && c !== current && toMinutes(c.end) > minutes);
  const reliefNext = nextSnap.cells.filter((c) => c.day === next.day && c.relief);
  const nextIsTomorrow = next.date === addDays(today.date, 1);
  const nextName = nextIsTomorrow ? t('today.tomorrow') : t(`common:days.long.${next.day}`);

  const fullName = base ? (lang === 'si' && base.nameSi) || base.name : '';
  const heading = (
    <PageTitle
      title={`${t(`greeting.${greetingKey(now.getHours())}`)}${fullName ? `, ${fullName}` : ''}`}
      sub={`${t(`common:weekdays.${now.getDay()}`)} ${now.getDate()} ${t(`common:months.${now.getMonth()}`)}`}
    />
  );
  const nowCard = <NowCard isSchoolDay={today.day !== null} current={current} next={nextCell} minutesLeft={minutesLeft} lang={lang} />;
  const reliefSection = reliefToday.length > 0 && (
    <ListSection title={t('today.reliefToday')} count={reliefToday.length} tone="brand">
      {reliefToday.map((c, i) => (
        <LessonRow key={i} cell={c} lang={lang} />
      ))}
    </ListSection>
  );

  if (isPhone) {
    return (
      <div className="flex flex-col gap-3 [&>section]:mb-0">
        {heading}
        {nowCard}
        {reliefSection}
        {today.day !== null && (
          <ListSection title={t('today.rest')} bare={rest.length === 0}>
            {rest.length === 0 ? (
              <p className="m-0 text-[13px] text-ink-muted">{t('today.nothingMore')}</p>
            ) : (
              rest.map((c, i) => <LessonRow key={i} cell={c} lang={lang} />)
            )}
          </ListSection>
        )}
        {reliefNext.length > 0 && (
          <div className="flex items-center gap-2.5 rounded-[14px] border border-line bg-white px-3.5 py-2.5">
            <span className="flex-1 text-[13px] text-ink-soft">
              <Trans t={t} i18nKey="today.plannedNext" count={reliefNext.length} values={{ when: nextName }} components={{ b: <b className="text-ink" /> }} />
            </span>
            <Link to={`/s/${sid}/me/timetable`} className="inline-flex min-h-11 items-center px-1 text-[13px] font-bold text-brand no-underline hover:underline">
              {t('today.view')}
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[340px_minmax(0,1fr)] items-start gap-6">
      <div className="flex flex-col gap-3 [&>section]:mb-0">
        {heading}
        {nowCard}
        {reliefSection}
        <ListSection title={nextName} count={reliefNext.length} tone="brand" bare={reliefNext.length === 0}>
          {reliefNext.length === 0 ? (
            <p className="m-0 text-[13px] text-ink-muted">{t('today.noReliefPlanned')}</p>
          ) : (
            reliefNext.map((c, i) => <LessonRow key={i} cell={c} lang={lang} />)
          )}
        </ListSection>
      </div>
      <WeekPanel printTo={printTimetablePath(sid)} />
    </div>
  );
}

function WeekPanel({ printTo }: { printTo: string }) {
  const { t } = useTranslation('teacher');
  const state = useTimetableState('week');
  const labels = useDateLabels();
  return (
    <section aria-label={t('today.thisWeek')} className="flex flex-col gap-3 rounded-[14px] border border-line bg-white px-[18px] py-4">
      <div className="flex items-center gap-2.5">
        <b className="flex-1 text-[17px]">{state.mode === 'week' ? t('today.thisWeek') : labels.long(state.start)}</b>
        <ModeSwitch value={state.mode} onChange={state.setMode} className="w-[300px]" />
        <LinkButton to={printTo} size="sm">
          {t('print')}
        </LinkButton>
      </div>
      <TimetableView mode={state.mode} start={state.start} onStart={state.setStart} compactWeek={false} />
    </section>
  );
}

interface NowCardProps {
  isSchoolDay: boolean;
  current: ReturnType<typeof currentAndNext>['current'];
  next: OverlayCell | undefined;
  minutesLeft: number | undefined;
  lang: Lang;
}

function NowCard({ isSchoolDay, current, next, minutesLeft, lang }: NowCardProps) {
  const { t } = useTranslation(['teacher', 'common']);
  const box = 'rounded-[14px] border-2 border-fill-warning bg-white px-3.5 py-3';

  if (!isSchoolDay) {
    return (
      <section data-testid="now-card" aria-label={t('now')} className={box}>
        <p className="m-0 text-lg font-extrabold">{t('noClassesToday')}</p>
        <p className="m-0 mt-1 text-[13px] text-ink-muted">{t('noClassesTodayBody')}</p>
      </section>
    );
  }

  const nextLine = next && (
    <p className="m-0 mt-1.5 text-[13px] text-ink-muted">
      {t('next')}:{' '}
      <b className="text-ink">
        {t('common:periods.periodN', { n: next.period })} · {cellText(next, lang).sub} · {cellText(next, lang).title}
      </b>{' '}
      {clock(next.start)}
    </p>
  );

  if (!current || 'free' in current) {
    return (
      <section data-testid="now-card" aria-label={t('now')} className={box}>
        <p className="m-0 text-lg font-extrabold">{current ? t('freePeriod') : t('noClassNow')}</p>
        {nextLine}
      </section>
    );
  }

  const cell = current as OverlayCell;
  const text = cellText(cell, lang);
  return (
    <section data-testid="now-card" aria-label={t('now')} className={box}>
      <div className="flex items-center justify-between gap-2">
        <Badge tone="warning" className="tracking-wider">
          {t('now')} · {t('common:periods.periodN', { n: cell.period })}
        </Badge>
        <span className="text-[13px] text-ink-muted">
          {clock(cell.start)}–{clock(cell.end)} · {t('minLeft', { n: minutesLeft ?? 0 })}
        </span>
      </div>
      <p className="m-0 mt-2 text-xl font-extrabold leading-tight">
        {text.sub} · {text.title}
      </p>
      {cell.relief && <p className="m-0 mt-1 text-[13px] text-ink-muted">{t('relief.covering', { name: cell.relief.forTeacher })}</p>}
      {nextLine}
    </section>
  );
}
