// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type School, type SchoolReport } from '@sathiya/core';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { useCollection, type CollectionState } from '../../lib/firestore';
import { Button, buttonClass } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { EmptyState } from '../../ui/EmptyState';
import { ListInitials, ListRow, ListSection } from '../../ui/GroupedList';
import { LoadingState } from '../../ui/LoadingState';
import { Modal } from '../../ui/Modal';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
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
  const isPhone = useMediaQuery(PHONE_QUERY);
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
      ) : isPhone ? (
        <ReportsPhoneList rows={rows} byId={byId} writer={writer} setStatus={setStatus} releaseCensus={releaseCensus} />
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

function useCloseReport(report: SchoolReport, writer: ReportWriter) {
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
  return { busy, close };
}

function CloseButton({ report, writer, size = 'sm' }: { report: SchoolReport; writer: ReportWriter; size?: 'sm' | 'md' }) {
  const { t } = useTranslation('superadmin');
  const { busy, close } = useCloseReport(report, writer);
  return (
    <Button size={size} loading={busy} onClick={() => void close()}>
      {t(size === 'md' ? 'reports.phone.closeReport' : 'reports.close')}
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

interface ReportsPhoneListProps {
  rows: SchoolReport[];
  byId: Map<string, School>;
  writer: ReportWriter;
  setStatus: SetStatusFn;
  releaseCensus: ReleaseCensusFn;
}

function ReportsPhoneList({ rows, byId, writer, setStatus, releaseCensus }: ReportsPhoneListProps) {
  const { t } = useTranslation('superadmin');
  const [openId, setOpenId] = useState<string>();
  const selected = rows.find((r) => r.id === openId);
  return (
    <>
      <ListSection title={t('reports.phone.open')} count={rows.length} tone="warning">
        {rows.map((r) => (
          <ReportRow key={r.id} report={r} school={byId.get(r.schoolId)} writer={writer} onOpen={() => setOpenId(r.id)} />
        ))}
      </ListSection>
      {selected && (
        <ReportSheet
          report={selected}
          school={byId.get(selected.schoolId)}
          writer={writer}
          setStatus={setStatus}
          releaseCensus={releaseCensus}
          onClose={() => setOpenId(undefined)}
        />
      )}
    </>
  );
}

function useReportText(report: SchoolReport, school: School | undefined) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const name = school ? pickName(school, lang) : report.schoolId;
  const line = [
    t(`reports.reasons.${report.reason}`, { defaultValue: report.reason }),
    formatDate(report.createdAt, lang),
    school?.status === 'disabled' && t('status.disabled'),
  ]
    .filter(Boolean)
    .join(' · ');
  return { name, line };
}

function ReportRow({ report, school, writer, onOpen }: { report: SchoolReport; school?: School; writer: ReportWriter; onOpen: () => void }) {
  const { t } = useTranslation('superadmin');
  const { busy, close } = useCloseReport(report, writer);
  const { name, line } = useReportText(report, school);
  return (
    <ListRow
      lead={<ListInitials name={name} />}
      title={name}
      detail={line}
      onOpen={onOpen}
      action={{ label: t('reports.close'), ariaLabel: `${t('reports.close')}: ${name}`, loading: busy, onClick: () => void close() }}
    />
  );
}

interface ReportSheetProps {
  report: SchoolReport;
  school?: School;
  writer: ReportWriter;
  setStatus: SetStatusFn;
  releaseCensus: ReleaseCensusFn;
  onClose: () => void;
}

function ReportSheet({ report, school, writer, setStatus, releaseCensus, onClose }: ReportSheetProps) {
  const { t } = useTranslation('superadmin');
  const { name, line } = useReportText(report, school);
  return (
    <Modal open title={name} subtitle={line} onClose={onClose}>
      <p className="m-0 whitespace-pre-wrap text-sm text-ink">{report.details || t('usage.noData')}</p>
      {report.email && (
        <p className="mb-0 mt-2 text-sm">
          <a href={`mailto:${report.email}`} className="break-all text-teal underline-offset-2 hover:underline">
            {report.email}
          </a>
        </p>
      )}
      <Link
        to={`/super/schools/${report.schoolId}/admin`}
        className={cx(buttonClass({ variant: 'secondary', size: 'md' }), 'mt-4 h-11 w-full')}
      >
        {t('detail.openReadOnly')}
      </Link>
      <div className="mt-2 grid grid-cols-2 gap-2 [&>button]:h-11">
        <CloseButton report={report} writer={writer} size="md" />
        {school && school.status === 'active' && <SuspendButton school={school} setStatus={setStatus} />}
      </div>
      {school && (
        <div className="mt-2 grid [&>button]:h-11">
          <ReleaseCensusButton school={school} release={releaseCensus} />
        </div>
      )}
    </Modal>
  );
}
