// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, pickName, type Member, type School } from '@sathiya/core';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useCollection, useDoc, type CollectionState, type DocState } from '../../lib/firestore';
import { EmptyState } from '../../ui/EmptyState';
import { ActionMenu, type ActionMenuItem } from '../../ui/ActionMenu';
import { Button, buttonClass } from '../../ui/Button';
import { LoadingState } from '../../ui/LoadingState';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { defaultReleaseCensus, useReleaseCensus, type ReleaseCensusFn } from './ReleaseCensus';
import { defaultReview, type ReviewFn } from './review';
import { defaultDecideName, type DecideNameFn } from './nameChange';
import { NameChangeSection } from './NameChangeSection';
import { MoeBadge, ReviewSection } from './ReviewSection';
import { StatusPill, useStatusToggle } from './StatusControl';
import { formatActivity, formatDate } from './format';
import { useUsageCounts } from './source';
import { defaultSetStatus, type SetStatusFn } from './status';

export interface SchoolDetailProps {
  school?: DocState<School>;
  setStatus?: SetStatusFn;
  releaseCensus?: ReleaseCensusFn;
  schools?: CollectionState<School>;
  members?: CollectionState<Member>;
  review?: ReviewFn;
  decideName?: DecideNameFn;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line-soft py-2.5 text-sm last:border-b-0 sm:flex-row sm:gap-4 sm:py-3 sm:last:border-b">
      <dt className="shrink-0 text-xs text-ink-muted sm:w-56 sm:text-sm">{label}</dt>
      <dd className="m-0 min-w-0 break-words">{children}</dd>
    </div>
  );
}

function DetailActions({ school, setStatus, releaseCensus }: { school: School; setStatus: SetStatusFn; releaseCensus: ReleaseCensusFn }) {
  const { t } = useTranslation('superadmin');
  const isPhone = useMediaQuery(PHONE_QUERY);
  // One owner for each action's state, so an open confirmation survives a resize across the phone breakpoint.
  const toggle = useStatusToggle(school, setStatus);
  const census = useReleaseCensus(school, releaseCensus);
  const readOnly = `/super/schools/${school.id}/admin`;
  const items: ActionMenuItem[] = [];
  if (toggle.visible)
    items.push({ key: 'status', label: toggle.label, tone: toggle.disabling ? 'danger' : 'default', disabled: toggle.busy, onSelect: toggle.start });
  if (census.visible) items.push({ key: 'census', label: census.label, tone: 'danger', disabled: census.busy, onSelect: census.start });
  return (
    <>
      {isPhone ? (
        <div className="flex shrink-0 items-center gap-2">
          <Link to={readOnly} aria-label={t('detail.openReadOnly')} className={buttonClass({ variant: 'secondary', size: 'md' })}>
            {t('schools.open')}
          </Link>
          {items.length > 0 && <ActionMenu items={items} />}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Link
            to={readOnly}
            className="inline-flex h-8 items-center rounded-lg border border-line-strong bg-white px-3 text-[13px] font-semibold hover:bg-surface"
          >
            {t('detail.openReadOnly')}
          </Link>
          {toggle.visible && (
            <Button
              size="sm"
              variant={toggle.disabling ? 'danger' : 'secondary'}
              loading={toggle.busy && !toggle.confirming}
              disabled={toggle.busy && toggle.confirming}
              onClick={toggle.start}
            >
              {toggle.label}
            </Button>
          )}
          {census.visible && (
            <Button size="sm" variant="danger" disabled={census.busy} onClick={census.start}>
              {census.label}
            </Button>
          )}
        </div>
      )}
      {toggle.modal}
      {census.modal}
    </>
  );
}

export function SchoolDetail({
  school: injected,
  setStatus = defaultSetStatus,
  releaseCensus = defaultReleaseCensus,
  schools: injectedSchools,
  members: injectedMembers,
  review = defaultReview,
  decideName = defaultDecideName,
}: SchoolDetailProps) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const { sid } = useParams();
  const live = useDoc<School>(injected || !sid ? null : paths.school(sid));
  const state = injected ?? live;
  const school = state.data;
  const list = useMemo(() => (school ? [school] : []), [school]);
  const counts = useUsageCounts(list);
  const reviewing = school?.status === 'pending';
  const liveSchools = useCollection<School>(injectedSchools || !reviewing ? null : 'schools');
  const liveMembers = useCollection<Member>(injectedMembers || !reviewing || !school ? null : paths.members(school.id));
  const schools = injectedSchools ?? liveSchools;
  const members = injectedMembers ?? liveMembers;

  if (state.loading) return <LoadingState />;
  if (state.error) return <EmptyState icon="search" title={t('schools.loadError')} />;
  if (!school) return <EmptyState icon="search" title={t('detail.notFound')} />;
  const c = counts[school.id];
  const ready = c?.status === 'ready' ? c.counts : undefined;
  const pending = !c || c.status === 'loading' ? '…' : c.status === 'error' ? t('usage.countError') : t('usage.noData');

  return (
    <div className="max-w-3xl">
      <Link to="/super" className="mb-1 inline-flex min-h-11 items-center text-sm font-semibold text-teal underline-offset-2 hover:underline md:mb-3 md:min-h-0">
        {t('detail.back')}
      </Link>
      <div className="mb-4 flex items-center justify-between gap-3 md:mb-5 md:flex-wrap">
        <h1 className="m-0 min-w-0 text-[22px] font-bold md:text-[26px]">{pickName(school, lang)}</h1>
        <DetailActions school={school} setStatus={setStatus} releaseCensus={releaseCensus} />
      </div>
      {(reviewing || school.review?.decidedAt) && <ReviewSection school={school} schools={schools} members={members} review={review} />}
      {school.nameChange && <NameChangeSection school={school} change={school.nameChange} decide={decideName} />}
      <dl className="m-0 rounded-[14px] border border-line bg-white px-4 sm:px-5">
        <Row label={t('detail.name')}>{pickName(school, 'en')}</Row>
        <Row label={t('detail.nameSi')}>{school.nameSi || t('usage.noData')}</Row>
        <Row label={t('detail.city')}>{school.city || t('usage.noData')}</Row>
        <Row label={t('detail.type')}>{school.type ? t(`schoolTypes.${school.type}`) : t('usage.noData')}</Row>
        <Row label={t('detail.censusNo')}>{school.censusNo || t('usage.noData')}</Row>
        {school.review && (
          <Row label={t('review.moe')}>
            <MoeBadge matched={school.review.moeMatched} />
          </Row>
        )}
        {school.releasedCensusNo && school.censusReleasedAt && (
          <Row label={t('detail.censusReleased')}>
            {t('detail.censusReleasedValue', { censusNo: school.releasedCensusNo, date: formatDate(school.censusReleasedAt, lang) })}
          </Row>
        )}
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
