// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type School } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useCollection, type CollectionState } from '../../lib/firestore';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { formatActivity } from './format';
import { useUsageCounts } from './source';

export function UsagePage({ schools: injected }: { schools?: CollectionState<School> }) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const live = useCollection<School>(injected ? null : 'schools');
  const state = injected ?? live;
  const schools = [...state.data].sort((a, b) => pickName(a, 'en').localeCompare(pickName(b, 'en')));
  const counts = useUsageCounts(state.data);
  const dash = t('usage.noData');

  const rows = schools.map((s) => counts[s.id]);
  const anyError = rows.some((c) => c?.status === 'error');
  const complete = rows.every((c) => c?.status === 'ready');
  const sum = (pick: (c: { teachers: number; classes: number; entries: number | null }) => number | null) =>
    rows.reduce((n, c) => n + (c?.status === 'ready' ? (pick(c.counts) ?? 0) : 0), 0);
  const total = (pick: Parameters<typeof sum>[0]) =>
    complete ? (
      sum(pick)
    ) : anyError ? (
      <span title={t('usage.countError')}>{dash}</span>
    ) : (
      t('usage.loading')
    );

  return (
    <div>
      <h1 className="mb-1 text-[26px] font-bold">{t('usage.title')}</h1>
      <p className="mb-5 text-sm text-ink-muted">{t('usage.intro')}</p>
      {state.loading ? (
        <LoadingState />
      ) : state.error ? (
        <EmptyState icon="search" title={t('schools.loadError')} />
      ) : (
        <Table className="md:min-w-[720px]">
          <THead>
            <tr>
              <Th>{t('usage.columns.school')}</Th>
              <Th>{t('usage.columns.teachers')}</Th>
              <Th>{t('usage.columns.classes')}</Th>
              <Th>{t('usage.columns.entries')}</Th>
              <Th>{t('usage.columns.lastActivity')}</Th>
            </tr>
          </THead>
          <TBody>
            {schools.map((s) => {
              const c = counts[s.id];
              const ready = c?.status === 'ready' ? c.counts : undefined;
              const fallback = !c || c.status === 'loading' ? t('usage.loading') : t('usage.countError');
              return (
                <Tr key={s.id}>
                  <Td>
                    <strong>{pickName(s, lang)}</strong>
                  </Td>
                  <Td>{ready ? ready.teachers : fallback}</Td>
                  <Td>{ready ? ready.classes : fallback}</Td>
                  <Td>{ready ? (ready.entries ?? dash) : fallback}</Td>
                  <Td>{ready ? formatActivity(ready.lastActivity, lang, t('usage.never'), dash) : fallback}</Td>
                </Tr>
              );
            })}
            <Tr className="font-bold">
              <Td>{t('usage.totals')}</Td>
              <Td>{total((c) => c.teachers)}</Td>
              <Td>{total((c) => c.classes)}</Td>
              <Td>{total((c) => c.entries)}</Td>
              <Td />
            </Tr>
          </TBody>
        </Table>
      )}
    </div>
  );
}
