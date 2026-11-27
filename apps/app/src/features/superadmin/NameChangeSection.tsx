// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Bilingual, School, SchoolNameChange } from '@sathiya/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { useToast } from '../../ui/Toast';
import { errorMessage } from './errors';
import { formatDate } from './format';
import type { DecideNameFn } from './nameChange';
import { RejectModal } from './ReviewSection';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-t border-line-soft py-2.5 text-sm first:border-t-0 sm:flex-row sm:gap-4">
      <dt className="shrink-0 text-xs text-ink-muted sm:w-44 sm:text-sm">{label}</dt>
      <dd className="m-0 min-w-0">{children}</dd>
    </div>
  );
}

function Names({ names }: { names: Bilingual }) {
  const { t } = useTranslation('superadmin');
  return (
    <>
      <span className="block font-semibold">{names.nameEn || '—'}</span>
      <span className="block text-ink-soft" lang="si">
        {names.nameSi || t('nameChange.noSi')}
      </span>
    </>
  );
}

export function NameChangeSection({ school, change, decide }: { school: School; change: SchoolNameChange; decide: DecideNameFn }) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const toast = useToast();
  const [approving, setApproving] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [decidedAt, setDecidedAt] = useState<number>();
  const done = decidedAt === change.requestedAt;
  const pending = change.status === 'pending';

  async function approve() {
    setApproving(true);
    try {
      const { requestedAt } = change;
      await decide({ schoolId: school.id, requestedAt, approve: true });
      setDecidedAt(requestedAt);
      toast.show(t('nameChange.toastApproved'), 'success');
    } catch (err) {
      toast.show(t('nameChange.failed', { message: errorMessage(t, err) }), 'error');
    } finally {
      setApproving(false);
    }
  }

  async function reject(reason: string): Promise<boolean> {
    try {
      const { requestedAt } = change;
      await decide({ schoolId: school.id, requestedAt, approve: false, reason });
      setDecidedAt(requestedAt);
      toast.show(t('nameChange.toastRejected'), 'success');
      setRejecting(false);
      return true;
    } catch (err) {
      toast.show(t('nameChange.failed', { message: errorMessage(t, err) }), 'error');
      return false;
    }
  }

  const rejectButton = (
    <Button key="reject" variant="danger" disabled={approving || done} onClick={() => setRejecting(true)}>
      {t('nameChange.reject')}
    </Button>
  );
  const approveButton = (
    <Button key="approve" variant="primary" loading={approving} disabled={done} onClick={() => void approve()}>
      {t('nameChange.approve')}
    </Button>
  );
  const actions = isPhone ? [approveButton, rejectButton] : [rejectButton, approveButton];

  return (
    <section aria-labelledby="name-change-title" className="mb-5 rounded-[14px] border border-line bg-white px-4 py-4 sm:px-7 sm:py-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 id="name-change-title" className="m-0 text-xl font-bold">
            {t('nameChange.title')}
          </h2>
          <Badge tone={pending ? 'warning' : 'danger'}>{t(pending ? 'nameChange.pending' : 'nameChange.rejected')}</Badge>
        </div>
        {pending ? (
          !isPhone && <div className="flex flex-wrap gap-2.5">{actions}</div>
        ) : (
          change.decidedAt && <p className="m-0 text-[13px] text-ink-soft">{t('nameChange.rejectedOn', { date: formatDate(change.decidedAt, lang) })}</p>
        )}
      </div>
      <dl className="m-0 mt-4">
        <Row label={t('nameChange.moeName')}>{change.moeName ?? t('nameChange.notListed')}</Row>
        <Row label={t('nameChange.current')}>
          <Names names={school} />
        </Row>
        <Row label={t('nameChange.requested')}>
          <Names names={change} />
          <span className="mt-0.5 block text-xs text-ink-muted">{t('nameChange.requestedOn', { date: formatDate(change.requestedAt, lang) })}</span>
        </Row>
      </dl>
      {pending && isPhone && <div className="mt-4 grid grid-cols-2 gap-2 [&>button]:h-11 [&>button]:px-2">{actions}</div>}
      {!pending && change.reason && (
        <div className="mt-4">
          <p className="mb-1.5 mt-0 text-[13px] font-semibold text-ink-muted">{t('nameChange.reasonSent')}</p>
          <p className="m-0 whitespace-pre-wrap rounded-lg border border-line bg-surface-2 px-3.5 py-3 text-sm text-ink-soft">{change.reason}</p>
        </div>
      )}
      {pending && <p className="mb-0 mt-4 border-t border-line-soft pt-3.5 text-[13px] text-ink-muted">{t('nameChange.footer')}</p>}
      {rejecting && (
        <RejectModal
          title={t('nameChange.rejectTitle')}
          body={t('nameChange.rejectBody')}
          confirmLabel={t('nameChange.confirmReject')}
          onClose={() => setRejecting(false)}
          onReject={reject}
        />
      )}
    </section>
  );
}
