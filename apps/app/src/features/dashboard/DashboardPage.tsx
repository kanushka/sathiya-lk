// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { formatSummary } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { PendingNote, useSchoolPending } from '../../app/PendingReview';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button, buttonClass } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { Select } from '../../ui/Select';
import { colomboNow, greetingKey } from '../teacher/colomboNow';
import { useAdminBase } from '../timetable/paths';
import * as api from './api';
import { attentionItems, classChips, dashboardStats, publishProblems, type ChipStatus } from './model';
import { NewYearModal } from './NewYearModal';
import { PublishModal } from './PublishModal';

const chipClass: Record<ChipStatus, string> = {
  complete: 'bg-success-soft text-success',
  partial: 'bg-warning-soft text-warning',
  empty: 'bg-surface-3 text-ink-soft',
};

export function DashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const { t: tc } = useTranslation('common');
  const lang = i18n.language === 'si' ? 'si' : 'en';
  const school = useSchool();
  const { years, yearId, setYearId, entries } = useYear();
  const readOnly = useReadOnly();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const pending = useSchoolPending();
  const { user } = useAuth();
  const base = useAdminBase();
  const [dialog, setDialog] = useState<'new' | 'publish' | null>(null);

  const sid = school.school.id;
  const year = years.find((y) => y.id === yearId);
  const stats = dashboardStats(school, entries);
  const groups = classChips(school, entries);
  const items = attentionItems(school, entries, lang);
  const firstClass = groups[0]?.classes[0];

  const newYear = !readOnly && year && (
    <Button onClick={() => setDialog('new')}>{t('year.new')}</Button>
  );
  const firstYear = !readOnly && (
    <Button variant="primary" onClick={() => setDialog('new')}>
      {t('year.new')}
    </Button>
  );
  const title = year ? t('page.title', { year: year.label }) : t('shell:nav.dashboard');

  const statCards = [
    { label: t('stats.complete'), value: `${stats.classesComplete} / ${stats.classCount}`, sub: t('stats.completeSub'), tone: 'text-ink' },
    { label: t('stats.empty'), value: String(stats.emptySlots), sub: t('stats.emptySub'), tone: 'text-ink' },
    { label: t('stats.clashes'), value: String(stats.clashes), sub: t('stats.clashesSub'), tone: stats.clashes === 0 ? 'text-success' : 'text-danger' },
    { label: t('stats.over'), value: String(stats.overLimit), sub: t('stats.overSub'), tone: stats.overLimit === 0 ? 'text-success' : 'text-danger' },
  ];

  const greeting = !readOnly && (
    <p className="m-0 text-sm text-ink-soft">
      {t(`teacher:greeting.${greetingKey(colomboNow(new Date()).getHours())}`)}
      {user?.displayName ? `, ${user.displayName}` : ''}
    </p>
  );
  const yearSelect = years.length > 0 && (
    <Select
      aria-label={t('year.select')}
      value={yearId}
      onChange={setYearId}
      className={isPhone ? 'w-full [&>button]:h-11' : 'w-[200px]'}
      options={years.map((y) => ({
        value: y.id,
        label: `${y.label} · ${t(y.status === 'published' ? 'year.published' : 'year.draft')}`,
      }))}
    />
  );

  const phoneHeader = (
    <div className="mb-4 flex flex-col gap-2.5">
      <div>
        {greeting}
        <h1 className="mb-0 mt-0.5 text-[22px] font-bold tracking-tight text-ink">{title}</h1>
      </div>
      {(yearSelect || newYear) && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{yearSelect}</div>
          {newYear && (
            <Button size="lg" onClick={() => setDialog('new')}>
              {t('year.new')}
            </Button>
          )}
        </div>
      )}
      {(firstClass || (!readOnly && year)) && (
        <div className="grid grid-cols-2 gap-2">
          {firstClass && (
            <Link to={`${base}/timetable/class?c=${firstClass.id}`} className={cx(buttonClass({ variant: 'primary', size: 'lg' }), 'no-underline')}>
              {t('page.continue')}
            </Link>
          )}
          {!readOnly && year && (
            <Button size="lg" aria-label={t('publish.button')} disabled={pending} aria-describedby={pending ? 'publish-locked' : undefined} onClick={() => setDialog('publish')}>
              {t('publish.short')}
            </Button>
          )}
        </div>
      )}
      {!readOnly && year && pending && <PendingNote id="publish-locked" />}
    </div>
  );

  return (
    <div>
      {isPhone ? phoneHeader : (
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {greeting}
          <h1 className="mb-0 mt-1 text-[28px] font-bold tracking-tight text-ink">
            {title}
          </h1>
        </div>
        <div className="flex flex-col items-end gap-1.5">
        <div className="flex flex-wrap items-center gap-2.5">
          {yearSelect}
          {newYear}
          {firstClass && (
            <Link
              to={`${base}/timetable/class?c=${firstClass.id}`}
              className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand no-underline"
            >
              {t('page.continue')}
            </Link>
          )}
          {!readOnly && year && (
            <Button disabled={pending} aria-describedby={pending ? 'publish-locked' : undefined} onClick={() => setDialog('publish')}>
              {t('publish.button')}
            </Button>
          )}
        </div>
        {!readOnly && year && pending && <PendingNote id="publish-locked" />}
        </div>
      </div>
      )}

      {!year ? (
        <EmptyState icon="calendar" title={t('page.noYear')} body={t('page.noYearBody')} action={firstYear || undefined} />
      ) : (
        <>
          {isPhone ? (
            <div className="mb-4 grid grid-cols-2 gap-2.5">
              {statCards.map((s) => (
                <div key={s.label} className="rounded-[14px] border border-line-soft bg-white px-3.5 py-3">
                  <p className="m-0 text-xs text-ink-soft">{s.label}</p>
                  <p className={cx('mb-0 mt-1 text-[22px] font-extrabold leading-tight', s.tone)}>{s.value}</p>
                </div>
              ))}
            </div>
          ) : (
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-[14px] border border-line-soft bg-white px-5 py-[18px]">
                <p className="m-0 text-[13px] text-ink-soft">{s.label}</p>
                <p className={cx('mb-0 mt-1.5 text-[28px] font-extrabold', s.tone)}>{s.value}</p>
                <p className="mb-0 mt-1 text-[13px] text-ink-soft">{s.sub}</p>
              </div>
            ))}
          </div>
          )}

          <div className={cx('flex flex-wrap items-start', isPhone ? 'gap-4' : 'gap-5')}>
            <section className={cx('min-w-0 flex-[2_1_480px] md:min-w-[420px] rounded-[14px] border border-line-soft bg-white', isPhone ? 'p-4' : 'p-5')}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="m-0 text-[17px] font-bold">{t('classes.title')}</h2>
                <span className="text-[13px] text-ink-soft">{t('classes.legend')}</span>
              </div>
              {groups.length === 0 && <p className="m-0 text-sm text-ink-muted">{t('classes.none')}</p>}
              {groups.map((g) => (
                <div key={g.gradeId} className="flex items-center gap-3.5 border-t border-line-soft py-2.5">
                  <strong className={cx('shrink-0 text-sm', isPhone ? 'w-[72px]' : 'w-[90px]')}>{t('classes.grade', { n: g.number })}</strong>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {g.classes.map((c) => (
                      <Link
                        key={c.id}
                        to={`${base}/timetable/class?c=${c.id}`}
                        className={cx('inline-flex gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-bold no-underline', chipClass[c.status])}
                      >
                        {c.name} <span className="font-medium opacity-80">{formatSummary(c.summary, lang)}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className={cx('min-w-[280px] flex-[1_1_300px] rounded-[14px] border border-line-soft bg-white', isPhone ? 'p-4' : 'p-5')}>
              <h2 className="m-0 mb-3 text-[17px] font-bold">{t('attention.title')}</h2>
              {items.length === 0 && <p className="m-0 text-sm text-ink-muted">{t('attention.none')}</p>}
              {items.map((i) => {
                const params = { ...i.params, ...(i.day !== undefined && { dayName: tc(`days.long.${i.day}`) }) };
                return (
                  <Link key={i.key} to={base + i.to} className="flex gap-3 border-t border-line-soft py-3 text-ink no-underline">
                    <span
                      aria-hidden="true"
                      className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', i.severity === 'high' ? 'bg-danger' : 'bg-fill-warning')}
                    />
                    <span>
                      <strong className="block text-sm">{t(`attention.${i.kind}.title`, params)}</strong>
                      <span className="text-[13px] text-ink-soft">{t(`attention.${i.kind}.detail`, params)}</span>
                    </span>
                  </Link>
                );
              })}
            </section>
          </div>
        </>
      )}

      {dialog === 'new' && (
        <NewYearModal
          existingLabels={years.map((y) => y.label)}
          onClose={() => setDialog(null)}
          onCreate={async (label) => {
            setYearId(await api.createYear(sid, label));
          }}
        />
      )}
      {dialog === 'publish' && year && !pending && (
        <PublishModal
          yearLabel={year.label}
          problems={publishProblems(school, entries)}
          onClose={() => setDialog(null)}
          onPublish={async () => {
            const res = await api.publishYear(sid, year.id);
            return t('publish.done', { classes: res.classes, teachers: res.teachers });
          }}
        />
      )}
    </div>
  );
}
