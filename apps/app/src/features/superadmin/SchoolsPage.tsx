// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type School } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useCollection, type CollectionState } from '../../lib/firestore';
import { Badge } from '../../ui/Badge';
import { buttonClass } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { cx } from '../../ui/cx';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Select } from '../../ui/Select';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { StatusButton, StatusPill } from './StatusControl';
import { useUsageCounts, type CountState } from './source';
import { defaultSetStatus, type SetStatusFn } from './status';

export interface SchoolsPageProps {
  schools?: CollectionState<School>;
  setStatus?: SetStatusFn;
}

export function SchoolSwatch({ school }: { school: School }) {
  if (!school.logoUrl) return null;
  return <img src={school.logoUrl} alt="" className="h-7 w-7 shrink-0 rounded-lg object-contain" />;
}

export function countCell(state: CountState | undefined, pick: (c: Extract<CountState, { status: 'ready' }>['counts']) => string): string {
  if (!state || state.status === 'loading') return '…';
  if (state.status === 'error') return '—';
  return pick(state.counts);
}

const linkBtn = buttonClass({ variant: 'secondary', size: 'sm' });

type StatusFilter = 'all' | School['status'] | 'nameChange';
const statusFilters: StatusFilter[] = ['all', 'pending', 'nameChange', 'active', 'disabled', 'rejected'];
const renaming = (s: School) => s.nameChange?.status === 'pending';
const needsReview = (s: School) => s.status === 'pending' || renaming(s);

export function SchoolsPage({ schools: injected, setStatus = defaultSetStatus }: SchoolsPageProps) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const live = useCollection<School>(injected ? null : 'schools');
  const state = injected ?? live;
  const [search, setSearch] = useState('');
  const [status, setStatusFilter] = useState<StatusFilter>('all');
  const [district, setDistrict] = useState('all');
  const isPhone = useMediaQuery(PHONE_QUERY);
  const filterLabel = (f: StatusFilter) =>
    f === 'all' ? t('schools.all') : f === 'nameChange' ? t('schools.nameChangeFilter') : t(`status.${f}`);

  const statusCounts = useMemo(() => {
    const c: Record<StatusFilter, number> = { all: state.data.length, pending: 0, nameChange: 0, active: 0, disabled: 0, rejected: 0 };
    for (const s of state.data) {
      if (s.status in c) c[s.status] += 1;
      if (renaming(s)) c.nameChange += 1;
    }
    return c;
  }, [state.data]);
  const districts = useMemo(() => [...new Set(state.data.map((s) => s.district))].filter(Boolean).sort(), [state.data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.data
      .filter((s) => status === 'all' || (status === 'nameChange' ? renaming(s) : s.status === status))
      .filter((s) => district === 'all' || s.district === district)
      .filter(
        (s) =>
          !q || [s.nameEn, s.nameSi ?? '', s.staffPrefix, s.city ?? '', s.censusNo ?? ''].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => pickName(a, 'en').localeCompare(pickName(b, 'en')));
  }, [state.data, search, status, district]);
  const counts = useUsageCounts(visible);

  return (
    <div>
      <h1 className="mb-5 text-[22px] font-bold md:text-[26px]">{t('schools.title')}</h1>
      <div className="mb-3 grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-2.5">
        {isPhone ? (
          <Select
            aria-label={t('schools.statusLabel')}
            className="min-w-0"
            value={status}
            onChange={setStatusFilter}
            options={statusFilters.map((f) => ({ value: f, label: t('schools.filterCount', { label: filterLabel(f), count: statusCounts[f] }) }))}
          />
        ) : (
        <SegmentedControl
          aria-label={t('schools.statusLabel')}
          value={status}
          onChange={setStatusFilter}
          options={statusFilters.map((f) => {
            const label = filterLabel(f);
            return {
              value: f,
              ariaLabel: t('schools.filterCount', { label, count: statusCounts[f] }),
              label: (
                <span className="inline-flex items-center gap-1.5">
                  {label}
                  <span
                    className={cx(
                      'rounded-full px-1.5 text-[11px] font-bold',
                      (f === 'pending' || f === 'nameChange') && statusCounts[f] > 0 ? 'bg-warning-soft text-warning' : 'bg-white/70 text-ink-muted',
                    )}
                  >
                    {statusCounts[f]}
                  </span>
                </span>
              ),
            };
          })}
        />
        )}
        <input
          aria-label={t('schools.searchLabel')}
          placeholder={t('schools.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="order-first col-span-2 h-11 w-full min-w-0 rounded-lg md:order-none md:h-10 md:w-auto md:min-w-[280px] md:flex-1 border border-line-strong bg-white px-3 text-sm focus:border-brand focus:outline-hidden focus:ring-[3px] focus:ring-brand/30"
        />
        <Select
          aria-label={t('schools.districtLabel')}
          className="min-w-0 md:w-52"
          value={district}
          onChange={setDistrict}
          options={[{ value: 'all', label: t('schools.allDistricts') }, ...districts.map((d) => ({ value: d, label: d }))]}
        />
      </div>
      {state.loading ? (
        <LoadingState />
      ) : state.error ? (
        <EmptyState icon="search" title={t('schools.loadError')} />
      ) : visible.length === 0 ? (
        <EmptyState icon="search" title={t('schools.empty')} body={t('schools.emptyBody')} />
      ) : (
        <Table className="md:min-w-[820px]">
          <THead>
            <tr>
              <Th>{t('schools.columns.school')}</Th>
              <Th>{t('schools.columns.district')}</Th>
              <Th>{t('schools.columns.teachers')}</Th>
              <Th>{t('schools.columns.classes')}</Th>
              <Th>{t('schools.columns.status')}</Th>
              <Th>{t('schools.columns.actions')}</Th>
            </tr>
          </THead>
          <TBody>
            {visible.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <SchoolSwatch school={s} />
                    <div className="min-w-0">
                      <strong className="block">{pickName(s, lang)}</strong>
                      {s.city && <span className="block text-xs text-ink-muted">{s.city}</span>}
                      {(s.type || s.censusNo) && (
                        <span className="block text-xs text-ink-muted">
                          {[s.type && t(`schoolTypes.${s.type}`), s.censusNo && t('schools.censusShort', { no: s.censusNo })].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </div>
                </Td>
                <Td>{s.district}</Td>
                <Td>{countCell(counts[s.id], (c) => String(c.teachers))}</Td>
                <Td>{countCell(counts[s.id], (c) => String(c.classes))}</Td>
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill status={s.status} />
                    {renaming(s) && <Badge tone="warning">{t('schools.nameChangeFilter')}</Badge>}
                  </div>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/super/schools/${s.id}/admin`} className={linkBtn}>
                      {t('schools.open')}
                    </Link>
                    <Link to={`/super/schools/${s.id}`} className={linkBtn}>
                      {t(needsReview(s) ? 'schools.review' : 'schools.details')}
                    </Link>
                    <StatusButton school={s} setStatus={setStatus} />
                  </div>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
