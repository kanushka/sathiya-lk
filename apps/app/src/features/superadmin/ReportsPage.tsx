// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type School, type SchoolReport } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useCollection, type CollectionState } from '../../lib/firestore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Modal } from '../../ui/Modal';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { errorMessage } from './errors';
import { formatDate } from './format';
import { firestoreReportWriter, useOpenReports, type ReportWriter } from './reports';
import { defaultReleaseCensus, ReleaseCensusButton, type ReleaseCensusFn } from './ReleaseCensus';
import { StatusPill } from './StatusControl';
import { defaultSetStatus, type SetStatusFn } from './status';

export interface ReportsPageProps {
  reports?: CollectionState<SchoolReport>;
  schools?: CollectionState<School>;
  writer?: ReportWriter;
  setStatus?: SetStatusFn;
  releaseCensus?: ReleaseCensusFn;
}

export function ReportsPage({
  reports: injected,
  schools: injectedSchools,
  writer = firestoreReportWriter,
  setStatus = defaultSetStatus,
  releaseCensus = defaultReleaseCensus,
}: ReportsPageProps) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const state = useOpenReports(injected);
  const liveSchools = useCollection<School>(injectedSchools ? null : 'schools');
  const schools = injectedSchools ?? liveSchools;
  const byId = useMemo(() => new Map(schools.data.map((s) => [s.id, s])), [schools.data]);
  const rows = useMemo(
    () => state.data.filter((r) => r.status === 'open').sort((a, b) => b.createdAt - a.createdAt),
    [state.data],
  );

  return (
    <div>
      <h1 className="mb-1 text-[22px] font-bold md:text-[26px]">{t('reports.title')}</h1>
      <p className="mb-5 text-sm text-ink-muted">{t('reports.intro')}</p>
      {state.loading ? (
        <LoadingState />
      ) : state.error ? (
        <EmptyState icon="search" title={t('reports.loadError')} />
      ) : rows.length === 0 ? (
        <EmptyState icon="search" title={t('reports.empty')} body={t('reports.emptyBody')} />
      ) : (
        <Table className="md:min-w-[900px]">
          <THead>
            <tr>
              <Th>{t('reports.columns.school')}</Th>
              <Th>{t('reports.columns.reason')}</Th>
              <Th>{t('reports.columns.details')}</Th>
              <Th>{t('reports.columns.email')}</Th>
              <Th>{t('reports.columns.created')}</Th>
              <Th>{t('reports.columns.actions')}</Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((r) => {
              const school = byId.get(r.schoolId);
              return (
                <Tr key={r.id}>
                  <Td>
                    <Link to={`/super/schools/${r.schoolId}/admin`} className="font-semibold text-teal underline-offset-2 hover:underline">
                      {school ? pickName(school, lang) : r.schoolId}
                    </Link>
                    {school?.status === 'disabled' && (
                      <span className="ml-2">
                        <StatusPill status="disabled" />
                      </span>
                    )}
                  </Td>
                  <Td>{t(`reports.reasons.${r.reason}`, { defaultValue: r.reason })}</Td>
                  <Td>{r.details || t('usage.noData')}</Td>
                  <Td>
                    {r.email ? (
                      <a href={`mailto:${r.email}`} className="text-teal underline-offset-2 hover:underline">
                        {r.email}
                      </a>
                    ) : (
                      t('usage.noData')
                    )}
                  </Td>
                  <Td>{formatDate(r.createdAt, lang)}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <CloseButton report={r} writer={writer} />
                      {school && school.status === 'active' && <SuspendButton school={school} setStatus={setStatus} />}
                      {school && <ReleaseCensusButton school={school} release={releaseCensus} />}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}

function CloseButton({ report, writer }: { report: SchoolReport; writer: ReportWriter }) {
  const { t } = useTranslation('superadmin');
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  async function close() {
    setBusy(true);
    try {
      await writer.closeReport(report.id);
      toast.show(t('reports.toast.closed'), 'success');
    } catch (err) {
      toast.show(t('reports.toast.closeFailed', { message: errorMessage(t, err) }), 'error');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" loading={busy} onClick={() => void close()}>
      {t('reports.close')}
    </Button>
  );
}

function SuspendButton({ school, setStatus }: { school: School; setStatus: SetStatusFn }) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = pickName(school, lang);

  async function apply() {
    setBusy(true);
    try {
      await setStatus({ schoolId: school.id, status: 'disabled' });
      toast.show(t('toast.disabled', { name }), 'success');
    } catch (err) {
      toast.show(t('toast.failed', { message: errorMessage(t, err) }), 'error');
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => setConfirming(true)}>
        {t('reports.suspend')}
      </Button>
      <Modal
        open={confirming}
        title={t('confirmDisable.title', { name })}
        width={460}
        onClose={() => setConfirming(false)}
        busy={busy}
        footer={
          <>
            <Button onClick={() => setConfirming(false)} disabled={busy}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button variant="dangerSolid" loading={busy} onClick={() => void apply()}>
              {t('confirmDisable.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{t('confirmDisable.body')}</p>
      </Modal>
    </>
  );
}
