// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { isSchoolPendingError, PendingNote, useSchoolPending } from '../../app/PendingReview';
import { ActionMenu } from '../../ui/ActionMenu';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { CopyLink } from '../../ui/CopyLink';
import { FormError } from '../../ui/FormError';
import { Icon } from '../../ui/Icon';
import { Modal } from '../../ui/Modal';
import * as api from './api';
import { CopyRow } from './CopyRow';
import { schoolJoinUrl } from './links';
import { useJoinLink } from './useJoinLink';

type Action = 'create' | 'off';

export function InviteLinkCard({ schoolId, compact = false }: { schoolId: string; compact?: boolean }) {
  const { t } = useTranslation('teachers');

  const headingId = useId();
  const lockedId = useId();
  const pending = useSchoolPending();
  const link = useJoinLink(schoolId);
  const [busy, setBusy] = useState<Action | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);
  const listened = link.data?.token;
  const token = created ?? listened;

  // The listener can still hold the replaced token right after create; show ours until it catches up.
  useEffect(() => {
    if (created && listened === created) setCreated(null);
  }, [created, listened]);

  async function run(action: Action) {
    setBusy(action);
    setFailed(null);
    try {
      const res = await api.setJoinLink(schoolId, action);
      setCreated(action === 'create' && res.token ? res.token : null);
      setConfirming(false);
    } catch (err) {
      setFailed(isSchoolPendingError(err) ? t('shell:review.locked') : t('inviteLink.failed'));
    } finally {
      setBusy(null);
    }
  }

  const confirmOff = confirming && (
    <Modal
      open
      width={460}
      title={t('inviteLink.confirmOffTitle')}
      onClose={() => setConfirming(false)}
      busy={busy !== null}
      footer={
        <>
          <Button onClick={() => setConfirming(false)} disabled={busy !== null}>
            {t('inviteLink.cancel')}
          </Button>
          <Button variant="dangerSolid" loading={busy === 'off'} onClick={() => void run('off')}>
            {t('inviteLink.confirmOff')}
          </Button>
        </>
      }
    >
      <p className="m-0 text-sm text-ink-soft">{t('inviteLink.confirmOffBody')}</p>
      {failed && <FormError className="mt-3">{failed}</FormError>}
    </Modal>
  );

  if (compact && !pending && !link.loading) {
    const url = token ? schoolJoinUrl(window.location.origin, schoolId, token) : null;
    const errors = (
      <>
        {link.error && <FormError className="mt-1">{t('inviteLink.loadFailed')}</FormError>}
        {failed && !confirming && <FormError className="mt-1">{failed}</FormError>}
        {confirmOff}
      </>
    );
    if (url) {
      return (
        <CopyRow
          title={t('inviteLink.title')}
          url={url}
          shown={url.replace(/^https?:\/\/[^/]+/, '…')}
          copyLabel={t('inviteLink.copy')}
          trailing={
            <ActionMenu
              variant="ghost"
              label={t('phone.inviteMore')}
              items={[{ key: 'off', label: t('inviteLink.off'), icon: 'linkOff', tone: 'danger', onSelect: () => setConfirming(true) }]}
            />
          }
        >
          {errors}
        </CopyRow>
      );
    }
    return (
      <section aria-labelledby={headingId} className="mb-5 rounded-[14px] border border-line bg-white py-2.5 pl-4 pr-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 id={headingId} className="m-0 text-[15px] font-semibold text-ink">
              {t('inviteLink.title')}
            </h2>
            {!link.error && <span className="block text-[13px] text-ink-muted">{t('phone.inviteOff')}</span>}
          </div>
          {!link.error && (
            <Button size="lg" variant="primary" loading={busy === 'create'} onClick={() => void run('create')}>
              {t('inviteLink.create')}
            </Button>
          )}
        </div>
        {errors}
      </section>
    );
  }

  return (
    <section aria-labelledby={headingId} className="mb-5 rounded-[14px] border border-line-soft bg-white p-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id={headingId} className="m-0 text-[17px] font-bold">
          {t('inviteLink.title')}
        </h2>
        {pending && (
          <Badge>
            <Icon name="lock" size={11} strokeWidth={2.4} />
            {t('shell:review.afterApproval')}
          </Badge>
        )}
      </div>
      <p className="mb-0 mt-1 text-sm text-ink-soft">{t('inviteLink.body')}</p>
      {pending ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <Button size="sm" variant="primary" disabled aria-describedby={lockedId}>
            {t('inviteLink.create')}
          </Button>
          <PendingNote id={lockedId} text={t('shell:review.teachersCantJoin')} />
        </div>
      ) : link.loading ? null : link.error ? (
        <FormError className="mt-2">{t('inviteLink.loadFailed')}</FormError>
      ) : token ? (
        <>
          <div className="mt-3">
            <CopyLink url={schoolJoinUrl(window.location.origin, schoolId, token)} copyLabel={t('inviteLink.copy')} hint={t('inviteLink.shareHint')} />
          </div>
          <div className="mt-3">
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
              {t('inviteLink.off')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-0 mt-2 text-sm text-ink-muted">{t('inviteLink.isOff')}</p>
          <div className="mt-3">
            <Button size="sm" variant="primary" loading={busy === 'create'} onClick={() => void run('create')}>
              {t('inviteLink.create')}
            </Button>
          </div>
        </>
      )}
      {failed && !confirming && <FormError className="mt-2">{failed}</FormError>}
      {confirmOff}
    </section>
  );
}
