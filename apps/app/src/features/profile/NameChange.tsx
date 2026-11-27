// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Bilingual, School, SchoolNameChange } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toApiError } from '../../lib/callable';
import { Alert } from '../../ui/Alert';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { NameFields } from '../../ui/NameFields';
import { useToast } from '../../ui/Toast';
import * as api from './api';

const names = (n: Bilingual) => [n.nameEn, n.nameSi].map((v) => v?.trim()).filter(Boolean).join(' · ');

export function NameChangeStatus({ change }: { change: SchoolNameChange | undefined }) {
  const { t } = useTranslation('profile');
  if (!change) return null;
  const pending = change.status === 'pending';
  return (
    <Alert tone={pending ? 'warning' : 'danger'} className="mb-4">
      <p className="m-0">{t(pending ? 'nameChange.pendingTitle' : 'nameChange.rejectedTitle')}</p>
      <p className="m-0 mt-1 font-normal">
        {t('nameChange.requested')}: <span className="font-semibold">{names(change)}</span>
      </p>
      {!pending && change.reason && (
        <p className="m-0 mt-1 whitespace-pre-wrap font-normal">
          {t('nameChange.reason')}: {change.reason}
        </p>
      )}
      <p className="m-0 mt-1 font-normal">{t(pending ? 'nameChange.pendingBody' : 'nameChange.rejectedBody')}</p>
    </Alert>
  );
}

export function NameChangeModal({ school, onClose }: { school: School; onClose: () => void }) {
  const { t } = useTranslation('profile');
  const toast = useToast();
  const start = school.nameChange?.status === 'pending' ? school.nameChange : school;
  const [en, setEn] = useState(start.nameEn ?? '');
  const [si, setSi] = useState(start.nameSi ?? '');
  const [busy, setBusy] = useState(false);
  const nameOk = en.trim() !== '' || si.trim() !== '';
  const changed = en.trim() !== (school.nameEn ?? '').trim() || si.trim() !== (school.nameSi ?? '').trim();
  const pendingSame = school.nameChange?.status === 'pending' && en.trim() === school.nameChange.nameEn && si.trim() === (school.nameChange.nameSi ?? '');

  async function send() {
    if (!nameOk || !changed || pendingSame) return;
    setBusy(true);
    try {
      await api.requestNameChange(school.id, { nameEn: en.trim(), ...(si.trim() && { nameSi: si.trim() }) });
      toast.show(t('nameChange.sent'), 'success');
      onClose();
    } catch (err) {
      toast.show(t(toApiError(err).code === 'rate-limited' ? 'nameChange.rateLimited' : 'nameChange.failed'), 'error');
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      width={560}
      title={t('nameChange.title')}
      onClose={onClose}
      busy={busy}
      footer={
        <>
          <Button disabled={busy} onClick={onClose}>
            {t('buttons.cancel', { ns: 'common' })}
          </Button>
          <Button variant="primary" loading={busy} loadingLabel={t('nameChange.sending')} disabled={!nameOk || !changed || pendingSame} onClick={() => void send()}>
            {t('nameChange.send')}
          </Button>
        </>
      }
    >
      <p className="mb-4 mt-0 text-sm leading-normal text-ink-soft">{t('nameChange.body')}</p>
      <NameFields
        legend={t('fields.name')}
        enLabel={t('nameChange.newEn')}
        siLabel={t('nameChange.newSi')}
        en={en}
        si={si}
        onEn={setEn}
        onSi={setSi}
        missing={!nameOk}
        hint={nameOk && !changed ? t('nameChange.unchanged') : undefined}
        siFirst={school.medium?.includes('si')}
      />
    </Modal>
  );
}
