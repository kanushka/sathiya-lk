// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Button } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { Select } from '../../ui/Select';
import { colomboNow, greetingKey } from '../teacher/colomboNow';
import * as api from './api';
import { attentionItems, classChips, dashboardStats, publishProblems, type ChipStatus } from './model';
import { NewYearModal } from './NewYearModal';
import { PublishModal } from './PublishModal';

const chipClass: Record<ChipStatus, string> = {
  complete: 'bg-success-soft text-success',
  partial: 'bg-warning-soft text-warning',
  empty: 'bg-surface-3 text-ink-soft',
};

function useBase(): string {
  const { pathname } = useLocation();
  return /^\/s\/[^/]+/.exec(pathname)?.[0] ?? '/admin';
}

export function DashboardPage() {
  const { t, i18n } = useTranslation('dashboard');
  const { t: tc } = useTranslation('common');
  const lang = i18n.language === 'si' ? 'si' : 'en';
  const school = useSchool();
  const { years, yearId, setYearId, entries } = useYear();
  const readOnly = useReadOnly();
  const { user } = useAuth();
  const base = useBase();
  const [dialog, setDialog] = useState<'new' | 'publish' | null>(null);

  const sid = school.school.id;
  const year = years.find((y) => y.id === yearId);
  const stats = dashboardStats(school, entries);
  const groups = classChips(school, entries);
  const items = attentionItems(school, entries, lang);
  const firstClass = groups[0]?.classes[0];

  const newYear = !readOnly && (
    <Button onClick={() => setDialog('new')}>{t('year.new')}</Button>
  );

  const statCards = [
    { label: t('stats.complete'), value: `${stats.classesComplete} / ${stats.classCount}`, sub: t('stats.completeSub'), tone: 'text-ink' },
    { label: t('stats.empty'), value: String(stats.emptySlots), sub: t('stats.emptySub'), tone: 'text-ink' },
    { label: t('stats.clashes'), value: String(stats.clashes), sub: t('stats.clashesSub'), tone: stats.clashes === 0 ? 'text-success' : 'text-danger' },
    { label: t('stats.over'), value: String(stats.overLimit), sub: t('stats.overSub'), tone: stats.overLimit === 0 ? 'text-success' : 'text-danger' },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {!readOnly && (
            <p className="m-0 text-sm text-ink-soft">
              {t(`teacher:greeting.${greetingKey(colomboNow(new Date()).getHours())}`)}
              {user?.displayName ? `, ${user.displayName}` : ''}
            </p>
          )}
          <h1 className="mb-0 mt-1 text-[28px] font-bold tracking-tight text-ink">
            {year ? t('page.title', { year: year.label }) : t('page.noYear')}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {years.length > 0 && (
            <Select
              aria-label={t('year.select')}
              value={yearId}
              onChange={setYearId}
              className="w-[200px]"
              options={years.map((y) => ({
                value: y.id,
                label: `${y.label} · ${t(y.status === 'published' ? 'year.published' : 'year.draft')}`,
              }))}
            />
          )}
          {newYear}
          {firstClass && (
            <Link
              to={`${base}/timetable/class?c=${firstClass.id}`}
              className="inline-flex h-10 items-center rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand no-underline"
            >
              {t('page.continue')}
            </Link>
          )}
          {!readOnly && year && <Button onClick={() => setDialog('publish')}>{t('publish.button')}</Button>}
        </div>
      </div>

      {!year ? (
        <EmptyState icon="calendar" title={t('page.noYear')} body={t('page.noYearBody')} action={newYear || undefined} />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-[14px] border border-line-soft bg-white px-5 py-[18px]">
                <p className="m-0 text-[13px] text-ink-soft">{s.label}</p>
                <p className={cx('mb-0 mt-1.5 text-[28px] font-extrabold', s.tone)}>{s.value}</p>
                <p className="mb-0 mt-1 text-[13px] text-ink-soft">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-start gap-5">
            <section className="min-w-[420px] flex-[2_1_480px] rounded-[14px] border border-line-soft bg-white p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="m-0 text-[17px] font-bold">{t('classes.title')}</h2>
                <span className="text-[13px] text-ink-soft">{t('classes.legend')}</span>
              </div>
              {groups.length === 0 && <p className="m-0 text-sm text-ink-muted">{t('classes.none')}</p>}
              {groups.map((g) => (
                <div key={g.gradeId} className="flex items-center gap-3.5 border-t border-line-soft py-2.5">
                  <strong className="w-[90px] text-sm">{t('classes.grade', { n: g.number })}</strong>
                  <div className="flex flex-1 flex-wrap gap-2">
                    {g.classes.map((c) => (
                      <Link
                        key={c.id}
                        to={`${base}/timetable/class?c=${c.id}`}
                        className={cx('inline-flex gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-bold no-underline', chipClass[c.status])}
                      >
                        {c.name} <span className="font-medium opacity-80">{c.placed}/{c.needed}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </section>

            <section className="min-w-[280px] flex-[1_1_300px] rounded-[14px] border border-line-soft bg-white p-5">
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
      {dialog === 'publish' && year && (
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
