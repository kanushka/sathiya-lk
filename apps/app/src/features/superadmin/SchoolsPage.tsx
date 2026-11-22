// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type School } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useCollection, type CollectionState } from '../../lib/firestore';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Select } from '../../ui/Select';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { StatusButton, StatusPill } from './StatusControl';
import { useUsageCounts, type CountState } from './source';
import { defaultSetStatus, type SetStatusFn } from './status';

export interface SchoolsPageProps {
  schools?: CollectionState<School>;
  setStatus?: SetStatusFn;
}

export function SchoolSwatch({ school, lang }: { school: School; lang: 'en' | 'si' }) {
  const name = pickName(school, lang);
  return (
    <span
      aria-hidden="true"
      style={{ background: school.colors.primary }}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold text-white"
    >
      {school.staffPrefix.slice(0, 3) || name.slice(0, 2)}
    </span>
  );
}

export function countCell(state: CountState | undefined, pick: (c: Extract<CountState, { status: 'ready' }>['counts']) => string): string {
  if (!state || state.status === 'loading') return '…';
  if (state.status === 'error') return '—';
  return pick(state.counts);
}

const linkBtn =
  'inline-flex h-8 items-center rounded-lg border border-line-strong bg-white px-3 text-[13px] font-semibold text-ink hover:bg-slate-50';

export function SchoolsPage({ schools: injected, setStatus = defaultSetStatus }: SchoolsPageProps) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const live = useCollection<School>(injected ? null : 'schools');
  const state = injected ?? live;
  const [search, setSearch] = useState('');
  const [status, setStatusFilter] = useState<'all' | School['status']>('all');
  const [district, setDistrict] = useState('all');

  const districts = useMemo(() => [...new Set(state.data.map((s) => s.district))].filter(Boolean).sort(), [state.data]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return state.data
      .filter((s) => status === 'all' || s.status === status)
      .filter((s) => district === 'all' || s.district === district)
      .filter(
        (s) =>
          !q || [s.nameEn, s.nameSi ?? '', s.staffPrefix, s.city ?? '', s.censusNo ?? ''].some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.nameEn.localeCompare(b.nameEn));
  }, [state.data, search, status, district]);
  const counts = useUsageCounts(visible);

  return (
    <div>
      <h1 className="mb-5 text-[26px] font-bold">{t('schools.title')}</h1>
      <div className="mb-3 flex flex-wrap gap-2.5">
        <input
          aria-label={t('schools.searchLabel')}
          placeholder={t('schools.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 min-w-[280px] flex-1 rounded-lg border border-line-strong bg-white px-3 text-sm focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/30"
        />
        <Select
          aria-label={t('schools.statusLabel')}
          className="w-44"
          value={status}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: t('schools.allStatuses') },
            { value: 'active', label: t('status.active') },
            { value: 'disabled', label: t('status.disabled') },
          ]}
        />
        <Select
          aria-label={t('schools.districtLabel')}
          className="w-52"
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
        <Table className="min-w-[820px]">
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
                    <SchoolSwatch school={s} lang={lang} />
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
                  <StatusPill status={s.status} />
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <Link to={`/s/${s.id}`} className={linkBtn}>
                      {t('schools.open')}
                    </Link>
                    <Link to={`/super/schools/${s.id}`} className={linkBtn}>
                      {t('schools.details')}
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
