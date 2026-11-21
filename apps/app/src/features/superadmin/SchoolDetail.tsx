// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, pickName } from '@sathiya/core';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useDoc, type DocState } from '../../lib/firestore';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { StatusButton, StatusPill } from './StatusControl';
import { formatActivity, formatDate } from './format';
import type { SchoolRecord } from './school';
import { useUsageCounts } from './source';
import { defaultSetStatus, type SetStatusFn } from './status';

export interface SchoolDetailProps {
  school?: DocState<SchoolRecord>;
  setStatus?: SetStatusFn;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-4 border-b border-[#F0F1F4] py-3 text-sm">
      <dt className="w-56 shrink-0 text-ink-muted">{label}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

export function SchoolDetail({ school: injected, setStatus = defaultSetStatus }: SchoolDetailProps) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const { sid } = useParams();
  const live = useDoc<SchoolRecord>(injected || !sid ? null : paths.school(sid));
  const state = injected ?? live;
  const school = state.data;
  const list = useMemo(() => (school ? [school] : []), [school]);
  const counts = useUsageCounts(list);

  if (state.loading) return <LoadingState />;
  if (state.error) return <EmptyState icon="search" title={t('schools.loadError')} />;
  if (!school) return <EmptyState icon="search" title={t('detail.notFound')} />;
  const c = counts[school.id];
  const ready = c?.status === 'ready' ? c.counts : undefined;
  const pending = !c || c.status === 'loading' ? '…' : c.status === 'error' ? t('usage.countError') : t('usage.noData');

  return (
    <div className="max-w-3xl">
      <Link to="/super" className="mb-3 inline-block text-sm font-semibold text-teal underline-offset-2 hover:underline">
        {t('detail.back')}
      </Link>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 text-[26px] font-bold">{pickName(school, lang)}</h1>
        <div className="flex gap-2">
          <Link
            to={`/s/${school.id}`}
            className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-white px-3 text-[13px] font-semibold hover:bg-slate-50"
          >
            {t('detail.openReadOnly')}
          </Link>
          <StatusButton school={school} setStatus={setStatus} />
        </div>
      </div>
      <dl className="m-0 rounded-[14px] border border-line bg-white px-5">
        <Row label={t('detail.name')}>{school.nameEn}</Row>
        <Row label={t('detail.nameSi')}>{school.nameSi || t('usage.noData')}</Row>
        <Row label={t('detail.city')}>{school.city || t('usage.noData')}</Row>
        <Row label={t('detail.type')}>{school.type || t('usage.noData')}</Row>
        <Row label={t('detail.censusNo')}>{school.censusNo || t('usage.noData')}</Row>
        <Row label={t('detail.district')}>{school.district}</Row>
        {school.address && <Row label={t('detail.address')}>{school.address}</Row>}
        {school.phone && <Row label={t('detail.phone')}>{school.phone}</Row>}
        <Row label={t('detail.status')}>
          <StatusPill status={school.status} />
        </Row>
        <Row label={t('detail.created')}>{school.createdAt ? formatDate(school.createdAt, lang) : t('usage.noData')}</Row>
        <Row label={t('detail.terms')}>{school.termsVersion || t('usage.noData')}</Row>
        <Row label={t('detail.activeYear')}>{school.activeYearId ?? t('detail.noActiveYear')}</Row>
        <Row label={t('usage.columns.teachers')}>{ready ? ready.teachers : pending}</Row>
        <Row label={t('usage.columns.classes')}>{ready ? ready.classes : pending}</Row>
        <Row label={t('usage.columns.entries')}>{ready ? (ready.entries ?? t('usage.noData')) : pending}</Row>
        <Row label={t('usage.columns.lastActivity')}>
          {ready ? formatActivity(ready.lastActivity, lang, t('usage.never'), t('usage.noData')) : pending}
        </Row>
      </dl>
    </div>
  );
}
