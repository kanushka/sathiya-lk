// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { TeacherSnapshot } from '@sathiya/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { buttonClass } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { Icon } from '../../ui/Icon';
import { LoadingState } from '../../ui/LoadingState';
import { clock } from './cells';
import { useTeacherData } from './teacherData';

/** Renders the page once the teacher's published timetable is in, else the loading, error or not-published state. */
export function SnapshotGate({ children }: { children: (base: TeacherSnapshot) => ReactNode }) {
  const { t } = useTranslation('teacher');
  const { snapshot } = useTeacherData();
  if (snapshot.loading) return <LoadingState />;
  if (snapshot.error) return <EmptyState title={t('loadError')} />;
  if (!snapshot.data) return <EmptyState icon="calendar" title={t('notPublished.title')} body={t('notPublished.body')} />;
  return <>{children(snapshot.data)}</>;
}

/** P3 over 9:10, the lead of a period row. */
export function PeriodLead({ n, start }: { n: number; start: string }) {
  const { t } = useTranslation('common');
  return (
    <span className="w-10 shrink-0">
      <b className="block text-sm text-ink">{t('periods.periodN', { n })}</b>
      <span className="block text-[11px] font-normal text-ink-muted">{clock(start)}</span>
    </span>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-[22px] font-bold leading-tight md:text-2xl">{title}</h1>
        {sub && <span className="mt-0.5 block text-[13px] text-ink-muted md:text-sm">{sub}</span>}
      </div>
      {action}
    </div>
  );
}

/** A square 44 px print link for a title row. */
export function PrintIconLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} aria-label={label} title={label} className={cx(buttonClass({ variant: 'secondary', size: 'lg', square: true }), 'shrink-0 no-underline')}>
      <Icon name="print" size={20} />
    </Link>
  );
}

export const printTimetablePath = (sid: string) => `/s/${sid}/me/print/timetable?auto=1`;
export const printClassPath = (sid: string, cid: string) => `/s/${sid}/me/print/class/${encodeURIComponent(cid)}?auto=1`;
