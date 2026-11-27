// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { activityName, schoolDayOf, type ClassSnapshot, type DayIndex, type Lang, type ReliefDay, type SnapshotCell } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { cellText, cellsAt, clock, slotsOf, weekdays } from './cells';
import { PageTitle, PeriodLead, PrintIconLink, printClassPath } from './parts';
import type { OverlayCell } from './reliefOverlay';
import { useClassSnapshot, useTeacherData } from './teacherData';
import { columnDates, firstSchoolDay, TimetableGrid, type Column } from './TimetableView';

export interface ClassRelief {
  absent: string;
  /** null when nobody covers yet. */
  reliefBy: string | null;
}

const nameIn = (day: ReliefDay, id: string, lang: Lang): string => {
  const n = day.names[id];
  return (lang === 'si' && n?.si) || n?.en || '';
};

/** Today's relief on the class's lessons, by entry id: who is away and who covers. */
export function classRelief(day: ReliefDay | null, classId: string, lang: Lang): Map<string, ClassRelief[]> {
  const out = new Map<string, ClassRelief[]>();
  for (const r of day?.reliefs ?? []) {
    if (!r.classIds.includes(classId)) continue;
    const item = { absent: nameIn(day!, r.absentTeacherId, lang), reliefBy: r.reliefTeacherId ? nameIn(day!, r.reliefTeacherId, lang) : null };
    out.set(r.entryId, [...(out.get(r.entryId) ?? []), item]);
  }
  return out;
}

export function MyClassPage() {
  const { t } = useTranslation('teacher');
  const { classes } = useTeacherData();
  const sorted = [...classes.data].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  const [picked, setPicked] = useState<string | null>(null);
  const cls = sorted.find((c) => c.id === picked) ?? sorted[0];

  if (classes.loading) return <LoadingState />;
  if (!cls) return <EmptyState icon="school" title={t('myClass.none')} body={t('myClass.noneBody')} />;
  return (
    <div className="flex flex-col gap-2.5">
      {sorted.length > 1 && (
        <SegmentedControl
          aria-label={t('myClass.which')}
          value={cls.id}
          onChange={setPicked}
          options={sorted.map((c) => ({ value: c.id, label: c.name }))}
          className="w-full md:w-auto [&>button]:flex-1"
        />
      )}
      <ClassBody key={cls.id} classId={cls.id} fallbackName={cls.name} />
    </div>
  );
}

function ClassBody({ classId, fallbackName }: { classId: string; fallbackName: string }) {
  const { t } = useTranslation(['teacher', 'common']);
  const { lang } = useLang();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const { sid, today, reliefOn, base } = useTeacherData();
  const snap = useClassSnapshot(classId);
  const [mode, setMode] = useState<'day' | 'week'>(isPhone ? 'day' : 'week');
  const [day, setDay] = useState<DayIndex>(today.day ?? 0);

  const title = snap.data?.className ?? fallbackName;
  const header = (
    <PageTitle title={title} sub={t('myClass.youAre')} action={<PrintIconLink to={printClassPath(sid, classId)} label={t('myClass.print', { name: title })} />} />
  );
  if (snap.loading) return <LoadingState />;
  if (snap.error) return <EmptyState title={t('loadError')} />;
  if (!snap.data) {
    return (
      <>
        {header}
        <EmptyState icon="calendar" title={t('notPublished.title')} body={t('myClass.notPublishedBody')} />
      </>
    );
  }

  const own = new Set((base?.cells ?? []).flatMap((c) => (c.entryId ? [c.entryId] : [])));
  const reliefs = classRelief(today.day === null ? null : reliefOn(today.date), classId, lang);

  return (
    <>
      {header}
      <SegmentedControl<'day' | 'week'>
        aria-label={t('timetable.view')}
        value={mode}
        onChange={setMode}
        options={[
          { value: 'day', label: t('timetable.day') },
          { value: 'week', label: t('timetable.week') },
        ]}
        className="w-full md:w-[240px] [&>button]:flex-1"
      />
      {mode === 'day' ? (
        <>
          <SegmentedControl<string>
            aria-label={t('days')}
            value={String(day)}
            onChange={(v) => setDay(Number(v) as DayIndex)}
            options={weekdays.map((d) => ({ value: String(d), label: t(`common:days.short.${d}`), ariaLabel: t(`common:days.long.${d}`) }))}
            className="w-full md:w-[400px] [&>button]:flex-1"
          />
          <ClassDayList snap={snap.data} day={day} own={own} reliefs={day === today.day ? reliefs : new Map()} lang={lang} />
        </>
      ) : (
        <div className="md:rounded-[14px] md:border md:border-line md:bg-white md:p-4">
          <TimetableGrid columns={weekColumns(snap.data, today, own, reliefs, {
              you: t('myClass.you'),
              note: (r) => (r.reliefBy ? t('myClass.reliefBy', { name: r.reliefBy }) : t('myClass.noRelief')),
            })} compact={isPhone} />
        </div>
      )}
    </>
  );
}

interface WeekWords {
  you: string;
  note: (r: ClassRelief) => string;
}

function weekColumns(snap: ClassSnapshot, today: { date: string; day: DayIndex | null }, own: Set<string>, reliefs: Map<string, ClassRelief[]>, words: WeekWords): Column[] {
  return columnDates('week', firstSchoolDay(today.date)).map((date) => {
    const day = schoolDayOf(date)!;
    const isToday = date === today.date;
    const cells = snap.cells.map((c): OverlayCell => {
      const named = c.entryId && own.has(c.entryId) ? { ...c, sub: words.you, subSi: words.you } : c;
      const r = isToday && c.day === day && c.entryId ? reliefs.get(c.entryId)?.[0] : undefined;
      return r ? { ...named, relief: { forTeacher: r.absent, note: words.note(r) } } : named;
    });
    return { date, day, isToday, snap: { rows: snap.rows, cells } };
  });
}

function ClassDayList({ snap, day, own, reliefs, lang }: { snap: ClassSnapshot; day: DayIndex; own: Set<string>; reliefs: Map<string, ClassRelief[]>; lang: Lang }) {
  const { t } = useTranslation(['teacher', 'common']);
  return (
    <ul aria-label={t('timetable.dayList')} className="m-0 list-none overflow-hidden rounded-[14px] border border-line bg-white p-0">
      {slotsOf(snap.rows[day] ?? []).map((slot, i) => {
        if (slot.kind === 'interval') {
          return (
            <li key={i} className="border-b border-line-soft bg-warning-soft/60 px-4 py-1 text-center text-[11px] font-bold tracking-[.08em] text-warning">
              {activityName(slot.row, lang) || t('teacher:interval')} · {clock(slot.row.start)}–{clock(slot.row.end)}
            </li>
          );
        }
        const cells = cellsAt(snap, day, slot.n);
        if (cells.length === 0) {
          return (
            <li key={i} className="flex min-h-[52px] items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0">
              <PeriodLead n={slot.n} start={slot.row.start} />
              <span className="text-[15px] text-ink-muted">{t('teacher:freePeriod')}</span>
            </li>
          );
        }
        return cells.map((cell, k) => (
          <ClassRow key={`${i}-${k}`} cell={cell} lang={lang} mine={!!cell.entryId && own.has(cell.entryId)} reliefs={(cell.entryId && reliefs.get(cell.entryId)) || []} />
        ));
      })}
    </ul>
  );
}

function ClassRow({ cell, lang, mine, reliefs }: { cell: SnapshotCell; lang: Lang; mine: boolean; reliefs: ClassRelief[] }) {
  const { t } = useTranslation('teacher');
  const text = cellText(cell, lang);
  const others = cell.otherClasses?.length ? t('myClass.together', { classes: cell.otherClasses.join(' + ') }) : null;
  return (
    <li className={cx('flex min-h-[52px] items-center gap-3 border-b border-line-soft px-4 py-2 last:border-b-0', reliefs.length > 0 && 'bg-brand/5')}>
      <PeriodLead n={cell.period} start={cell.start} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{text.title}</span>
        {reliefs.length === 0 ? (
          <span className="block truncate text-[13px] text-ink-muted">{mine ? t('myClass.you') : cell.isGroup ? (others ?? text.sub) : text.sub}</span>
        ) : (
          reliefs.map((r, i) => (
            <span key={i} className="block">
              <span className="block truncate text-[13px] text-ink-muted">
                <s>{r.absent}</s> · {t('myClass.away')}
              </span>
              <span className={cx('block truncate text-[13px] font-semibold', r.reliefBy ? 'text-brand' : 'text-warning')}>
                {r.reliefBy ? t('myClass.reliefBy', { name: r.reliefBy }) : t('myClass.noRelief')}
              </span>
            </span>
          ))
        )}
      </span>
      {reliefs.length > 0 && <Badge tone="brand">{t('relief.tag')}</Badge>}
    </li>
  );
}
